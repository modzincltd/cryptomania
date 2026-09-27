import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "./db";
import { FEE_RATE, type Mode, type RiskConfig } from "./types";
import { adjustPaperCash, getPaperCash, getGlobal } from "./settings";
import { fetchPrice, marketPrecision, privateExchange } from "./exchange";
import { log } from "./log";
import { dexPair, dexSlippagePct, DEX_FEE_RATE, isDexPair } from "./dex";

export type Position = typeof schema.positions.$inferSelect;

export interface OpenOpts {
  botId?: number | null;
  symbol: string;
  notionalUsd: number;
  mode: Mode;
  risk?: Partial<RiskConfig>;
  reason: string;
  source?: "bot" | "manual" | "ai";
  stopLoss?: number; // absolute overrides
  takeProfit?: number;
  pairId?: string | null; // DEX pair (chain:address) — paper only for now
}

export function openPositions(botId?: number | null): Position[] {
  const q = db.select().from(schema.positions);
  if (botId != null) return q.where(and(eq(schema.positions.status, "open"), eq(schema.positions.botId, botId))).all();
  return q.where(eq(schema.positions.status, "open")).all();
}

export function realizedPnlSince(ts: number, botId?: number | null): number {
  const rows = botId != null
    ? db.select().from(schema.positions).where(and(eq(schema.positions.status, "closed"), gte(schema.positions.exitAt, ts), eq(schema.positions.botId, botId))).all()
    : db.select().from(schema.positions).where(and(eq(schema.positions.status, "closed"), gte(schema.positions.exitAt, ts))).all();
  return rows.reduce((a, r) => a + (r.pnl ?? 0), 0);
}

export function startOfDay() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

async function fill(mode: Mode, symbol: string, side: "buy" | "sell", qty: number, pairId?: string | null): Promise<{ price: number; qty: number; fee: number; orderId?: string }> {
  if (isDexPair(pairId)) {
    if (mode !== "paper") throw new Error("Live DEX execution not wired yet (phase 2: Jupiter/0x)");
    const p = await dexPair(pairId!, 3_000);
    const notional = p.priceUsd * qty;
    const slip = dexSlippagePct(notional, p.liquidityUsd) / 100;
    const price = p.priceUsd * (side === "buy" ? 1 + slip : 1 - slip);
    return { price, qty, fee: price * qty * DEX_FEE_RATE };
  }
  if (mode === "paper") {
    const price = await fetchPrice(symbol);
    const slip = price * 0.0005 * (side === "buy" ? 1 : -1); // 5bps slippage
    const p = price + slip;
    return { price: p, qty, fee: p * qty * FEE_RATE };
  }
  const ex = privateExchange();
  await ex.loadMarkets();
  const order = await ex.createMarketOrder(symbol, side, qty);
  const filled = order.filled ?? qty;
  const price = order.average ?? order.price ?? (await fetchPrice(symbol));
  const fee = order.fee?.cost ?? price * filled * FEE_RATE;
  return { price: Number(price), qty: Number(filled), fee: Number(fee), orderId: order.id };
}

export async function openPosition(o: OpenOpts): Promise<Position> {
  const g = getGlobal();
  const open = openPositions();
  if (open.length >= g.maxOpenPositions) throw new Error(`Global max open positions (${g.maxOpenPositions}) reached`);
  const dayPnl = realizedPnlSince(startOfDay());
  if (dayPnl <= -g.maxDailyLossUsd) throw new Error(`Global daily loss limit hit (${dayPnl.toFixed(2)} USD)`);

  const notional = Math.min(o.notionalUsd, o.risk?.maxPositionUsd ?? o.notionalUsd);
  if (o.mode === "paper" && notional > getPaperCash()) throw new Error(`Insufficient paper cash (${getPaperCash().toFixed(2)})`);
  let qty: number; let entryLiquidity: number | null = null;
  if (isDexPair(o.pairId)) {
    const p = await dexPair(o.pairId!, 3_000);
    if (!p.tradable) throw new Error(`Pair blocked by safety filters: ${p.flags.join(", ")}`);
    if (notional < 5) throw new Error("Notional below $5");
    qty = notional / p.priceUsd; entryLiquidity = p.liquidityUsd;
  } else {
    const price = await fetchPrice(o.symbol);
    const prec = await marketPrecision(o.symbol);
    if (notional < Math.max(prec.minCost, 5)) throw new Error(`Notional ${notional} below exchange minimum`);
    qty = prec.amountToPrecision(notional / price);
    if (qty < prec.minAmount) throw new Error(`Qty ${qty} below exchange minimum ${prec.minAmount}`);
  }

  const f = await fill(o.mode, o.symbol, "buy", qty, o.pairId);
  qty = f.qty;
  const cost = f.price * qty + f.fee;
  if (o.mode === "paper") adjustPaperCash(-cost);

  const sl = o.stopLoss ?? (o.risk?.stopLossPct ? f.price * (1 - o.risk.stopLossPct / 100) : null);
  const tp = o.takeProfit ?? (o.risk?.takeProfitPct ? f.price * (1 + o.risk.takeProfitPct / 100) : null);
  const now = Date.now();
  const pos = db.insert(schema.positions).values({
    botId: o.botId ?? null, symbol: o.symbol, side: "long", qty, entryPrice: f.price, entryAt: now,
    stopLoss: sl, takeProfit: tp, trailingStopPct: o.risk?.trailingStopPct || null, highWater: f.price,
    status: "open", mode: o.mode, source: o.source ?? (o.botId ? "bot" : "manual"), pairId: o.pairId ?? null, entryLiquidity,
  }).returning().get();
  db.insert(schema.trades).values({ botId: o.botId ?? null, positionId: pos.id, symbol: o.symbol, side: "buy", qty, price: f.price, fee: f.fee, mode: o.mode, reason: o.reason, exchangeOrderId: f.orderId, createdAt: now, pairId: o.pairId ?? null }).run();
  log(`BUY ${qty} ${o.symbol} @ ${f.price.toFixed(4)} (${o.mode}) — ${o.reason}`, { level: "trade", botId: o.botId ?? null });
  return pos;
}

export async function closePosition(posId: number, reason: string): Promise<Position> {
  const pos = db.select().from(schema.positions).where(eq(schema.positions.id, posId)).get();
  if (!pos || pos.status !== "open") throw new Error("Position not open");
  const f = await fill(pos.mode as Mode, pos.symbol, "sell", pos.qty, pos.pairId);
  const proceeds = f.price * f.qty - f.fee;
  if (pos.mode === "paper") adjustPaperCash(proceeds);
  const entryCost = pos.entryPrice * pos.qty;
  const pnl = proceeds - entryCost - entryFee(pos);
  const pnlPct = (pnl / entryCost) * 100;
  const now = Date.now();
  const updated = db.update(schema.positions).set({ status: "closed", exitPrice: f.price, exitAt: now, exitReason: reason, pnl, pnlPct }).where(eq(schema.positions.id, posId)).returning().get();
  db.insert(schema.trades).values({ botId: pos.botId, positionId: pos.id, symbol: pos.symbol, side: "sell", qty: f.qty, price: f.price, fee: f.fee, mode: pos.mode, reason, exchangeOrderId: f.orderId, createdAt: now, pairId: pos.pairId }).run();
  log(`SELL ${f.qty} ${pos.symbol} @ ${f.price.toFixed(4)} pnl ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) — ${reason}`, { level: "trade", botId: pos.botId });
  return updated;
}

function entryFee(pos: Position) {
  const t = db.select().from(schema.trades).where(and(eq(schema.trades.positionId, pos.id), eq(schema.trades.side, "buy"))).get();
  return t?.fee ?? 0;
}

/** Check SL / TP / trailing stop for a position against the current price. Returns exit reason or null. */
export function checkExit(pos: Position, price: number): { reason: string | null; highWater: number } {
  let hw = Math.max(pos.highWater ?? pos.entryPrice, price);
  if (pos.stopLoss && price <= pos.stopLoss) return { reason: `Stop-loss hit @ ${price}`, highWater: hw };
  if (pos.takeProfit && price >= pos.takeProfit) return { reason: `Take-profit hit @ ${price}`, highWater: hw };
  if (pos.trailingStopPct && pos.trailingStopPct > 0) {
    const trail = hw * (1 - pos.trailingStopPct / 100);
    if (price <= trail && hw > pos.entryPrice) return { reason: `Trailing stop hit @ ${price} (peak ${hw})`, highWater: hw };
  }
  hw = Math.round(hw * 1e8) / 1e8;
  return { reason: null, highWater: hw };
}

export function updateHighWater(posId: number, hw: number) {
  db.update(schema.positions).set({ highWater: hw }).where(eq(schema.positions.id, posId)).run();
}
