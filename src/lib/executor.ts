import { one, q, sb, type PositionRow, type TradeRow } from "./db";
import { FEE_RATE, type Mode, type RiskConfig } from "./types";
import { adjustPaperCash, getPaperCash, getGlobal } from "./settings";
import { fetchPrice, marketPrecision, privateExchange } from "./exchange";
import { log } from "./log";
import { dexPair, dexSlippagePct, DEX_FEE_RATE, isDexPair } from "./dex";

export type Position = PositionRow;

export interface OpenOpts {
  botId?: number | null; symbol: string; notionalUsd: number; mode: Mode; risk?: Partial<RiskConfig>; reason: string;
  source?: "bot" | "manual" | "ai"; stopLoss?: number; takeProfit?: number; pairId?: string | null;
}

export async function openPositions(botId?: number | null): Promise<Position[]> {
  let qb = sb.from("positions").select("*").eq("status", "open");
  if (botId != null) qb = qb.eq("botId", botId);
  return q<Position[]>(qb.order("id"));
}
export async function realizedPnlSince(ts: number, botId?: number | null): Promise<number> {
  let qb = sb.from("positions").select("pnl").eq("status", "closed").gte("exitAt", ts);
  if (botId != null) qb = qb.eq("botId", botId);
  const rows = await q<{ pnl: number | null }[]>(qb);
  return rows.reduce((a, r) => a + (r.pnl ?? 0), 0);
}
export function startOfDay() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); }

async function fill(mode: Mode, symbol: string, side: "buy" | "sell", qty: number, pairId?: string | null): Promise<{ price: number; qty: number; fee: number; orderId?: string }> {
  if (isDexPair(pairId)) {
    if (mode !== "paper") throw new Error("Live DEX execution not wired yet (phase 2: Jupiter/0x)");
    const p = await dexPair(pairId!, 3_000);
    const slip = dexSlippagePct(p.priceUsd * qty, p.liquidityUsd) / 100;
    const price = p.priceUsd * (side === "buy" ? 1 + slip : 1 - slip);
    return { price, qty, fee: price * qty * DEX_FEE_RATE };
  }
  if (mode === "paper") {
    const price = await fetchPrice(symbol);
    const p = price + price * 0.0005 * (side === "buy" ? 1 : -1);
    return { price: p, qty, fee: p * qty * FEE_RATE };
  }
  const ex = privateExchange(); await ex.loadMarkets();
  const order = await ex.createMarketOrder(symbol, side, qty);
  const filled = order.filled ?? qty; const price = order.average ?? order.price ?? (await fetchPrice(symbol));
  return { price: Number(price), qty: Number(filled), fee: Number(order.fee?.cost ?? price * filled * FEE_RATE), orderId: order.id };
}

export async function openPosition(o: OpenOpts): Promise<Position> {
  const g = await getGlobal();
  if ((await openPositions()).length >= g.maxOpenPositions) throw new Error(`Global max open positions (${g.maxOpenPositions}) reached`);
  const dayPnl = await realizedPnlSince(startOfDay());
  if (dayPnl <= -g.maxDailyLossUsd) throw new Error(`Global daily loss limit hit (${dayPnl.toFixed(2)} USD)`);
  const notional = Math.min(o.notionalUsd, o.risk?.maxPositionUsd ?? o.notionalUsd);
  if (o.mode === "paper" && notional > (await getPaperCash())) throw new Error(`Insufficient paper cash (${(await getPaperCash()).toFixed(2)})`);
  let qty: number; let entryLiquidity: number | null = null;
  if (isDexPair(o.pairId)) {
    const p = await dexPair(o.pairId!, 3_000);
    if (!p.tradable) throw new Error(`Pair blocked by safety filters: ${p.flags.join(", ")}`);
    if (notional < 5) throw new Error("Notional below $5");
    qty = notional / p.priceUsd; entryLiquidity = p.liquidityUsd;
  } else {
    const price = await fetchPrice(o.symbol); const prec = await marketPrecision(o.symbol);
    if (notional < Math.max(prec.minCost, 5)) throw new Error(`Notional ${notional} below exchange minimum`);
    qty = prec.amountToPrecision(notional / price);
    if (qty < prec.minAmount) throw new Error(`Qty ${qty} below exchange minimum ${prec.minAmount}`);
  }
  const f = await fill(o.mode, o.symbol, "buy", qty, o.pairId); qty = f.qty;
  if (o.mode === "paper") await adjustPaperCash(-(f.price * qty + f.fee));
  const sl = o.stopLoss ?? (o.risk?.stopLossPct ? f.price * (1 - o.risk.stopLossPct / 100) : null);
  const tp = o.takeProfit ?? (o.risk?.takeProfitPct ? f.price * (1 + o.risk.takeProfitPct / 100) : null);
  const now = Date.now();
  const pos = await q<Position>(sb.from("positions").insert({
    botId: o.botId ?? null, symbol: o.symbol, side: "long", qty, entryPrice: f.price, entryAt: now, stopLoss: sl, takeProfit: tp,
    trailingStopPct: o.risk?.trailingStopPct || null, highWater: f.price, status: "open", mode: o.mode, source: o.source ?? (o.botId ? "bot" : "manual"),
    pairId: o.pairId ?? null, entryLiquidity,
  }).select().single());
  await q(sb.from("trades").insert({ botId: o.botId ?? null, positionId: pos.id, symbol: o.symbol, side: "buy", qty, price: f.price, fee: f.fee, mode: o.mode, reason: o.reason, exchangeOrderId: f.orderId ?? null, createdAt: now, pairId: o.pairId ?? null }));
  log(`BUY ${qty} ${o.symbol} @ ${f.price.toFixed(4)} (${o.mode}) — ${o.reason}`, { level: "trade", botId: o.botId ?? null });
  return pos;
}

export async function closePosition(posId: number, reason: string): Promise<Position> {
  const pos = await one<Position>(sb.from("positions").select("*").eq("id", posId).single());
  if (!pos || pos.status !== "open") throw new Error("Position not open");
  const f = await fill(pos.mode as Mode, pos.symbol, "sell", pos.qty, pos.pairId);
  const proceeds = f.price * f.qty - f.fee;
  if (pos.mode === "paper") await adjustPaperCash(proceeds);
  const entryTrade = await one<TradeRow>(sb.from("trades").select("*").eq("positionId", pos.id).eq("side", "buy").limit(1).single());
  const entryCost = pos.entryPrice * pos.qty;
  const pnl = proceeds - entryCost - (entryTrade?.fee ?? 0); const pnlPct = (pnl / entryCost) * 100; const now = Date.now();
  const updated = await q<Position>(sb.from("positions").update({ status: "closed", exitPrice: f.price, exitAt: now, exitReason: reason, pnl, pnlPct }).eq("id", posId).select().single());
  await q(sb.from("trades").insert({ botId: pos.botId, positionId: pos.id, symbol: pos.symbol, side: "sell", qty: f.qty, price: f.price, fee: f.fee, mode: pos.mode, reason, exchangeOrderId: f.orderId ?? null, createdAt: now, pairId: pos.pairId }));
  log(`SELL ${f.qty} ${pos.symbol} @ ${f.price.toFixed(4)} pnl ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) — ${reason}`, { level: "trade", botId: pos.botId });
  return updated;
}

export function checkExit(pos: Position, price: number): { reason: string | null; highWater: number } {
  const hw = Math.max(pos.highWater ?? pos.entryPrice, price);
  if (pos.stopLoss && price <= pos.stopLoss) return { reason: `Stop-loss hit @ ${price}`, highWater: hw };
  if (pos.takeProfit && price >= pos.takeProfit) return { reason: `Take-profit hit @ ${price}`, highWater: hw };
  if (pos.trailingStopPct && pos.trailingStopPct > 0 && price <= hw * (1 - pos.trailingStopPct / 100) && hw > pos.entryPrice) return { reason: `Trailing stop hit @ ${price} (peak ${hw})`, highWater: hw };
  return { reason: null, highWater: Math.round(hw * 1e8) / 1e8 };
}
export async function updateHighWater(posId: number, hw: number) { await q(sb.from("positions").update({ highWater: hw }).eq("id", posId)); }
