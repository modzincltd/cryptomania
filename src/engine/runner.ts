import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listBots, type BotRow } from "@/lib/bots";
import { parseBot } from "@/lib/bots";
import { getStrategy } from "@/lib/strategies";
import { fetchCandles } from "@/lib/exchange";
import { checkExit, closePosition, openPosition, openPositions, realizedPnlSince, startOfDay, updateHighWater } from "@/lib/executor";
import { computeEquity, snapshotEquity } from "@/lib/portfolio";
import { runScan } from "@/lib/ai";
import { getGlobal, getSetting, setSetting } from "@/lib/settings";
import { log } from "@/lib/log";
import { dexPair, dexPrices, isDexPair } from "@/lib/dex";
import { DEX_STRATEGIES } from "@/lib/dex-strategies";
import { sqlite } from "@/lib/db";

type Bot = ReturnType<typeof parseBot>;
const running = new Set<number>(); // bots mid-tick (avoid overlap)

function setBot(id: number, patch: Partial<BotRow>) {
  db.update(schema.bots).set(patch).where(eq(schema.bots.id, id)).run();
}

export async function tickBot(bot: Bot) {
  if (running.has(bot.id)) return;
  running.add(bot.id);
  const now = Date.now();
  try {
    if (bot.haltedUntil && bot.haltedUntil > now) return;
    if (isDexPair(bot.pairId)) { await tickDexBot(bot); return; }
    const strat = getStrategy(bot.strategy);
    const candles = await fetchCandles(bot.symbol, bot.timeframe, Math.max(strat.minCandles + 20, 200));
    if (candles.length < strat.minCandles) throw new Error(`Only ${candles.length} candles, need ${strat.minCandles}`);
    const price = candles[candles.length - 1].close; // live price incl. forming candle
    const signal = strat.evaluate(candles.slice(0, -1), bot.params); // signals only on closed candles
    const open = openPositions(bot.id);

    // 1) manage open positions: hard exits first
    for (const pos of open) {
      const ex = checkExit(pos, price);
      if (ex.reason) { await closePosition(pos.id, ex.reason); continue; }
      if (ex.highWater !== pos.highWater) updateHighWater(pos.id, ex.highWater);
      if (signal.action === "sell") await closePosition(pos.id, `Signal: ${signal.reason}`);
    }

    // 2) entries
    const stillOpen = openPositions(bot.id);
    if (signal.action === "buy" && stillOpen.length < bot.risk.maxOpenPositions) {
      // per-bot daily loss guard
      const dayPnl = realizedPnlSince(startOfDay(), bot.id);
      if (dayPnl <= -bot.risk.maxDailyLossUsd) {
        const until = startOfDay() + 86_400_000;
        setBot(bot.id, { haltedUntil: until });
        log(`Daily loss limit hit (${dayPnl.toFixed(2)}). Halted until tomorrow.`, { level: "warn", botId: bot.id });
      } else if (inCooldown(bot)) {
        log(`Buy signal ignored — cooldown (${signal.reason})`, { botId: bot.id });
      } else {
        try {
          await openPosition({ botId: bot.id, symbol: bot.symbol, notionalUsd: bot.allocationUsd, mode: bot.mode, risk: bot.risk, reason: signal.reason, source: "bot" });
        } catch (e) {
          log(`Entry blocked: ${(e as Error).message}`, { level: "warn", botId: bot.id });
        }
      }
    }

    setBot(bot.id, {
      lastRunAt: now, lastError: null,
      lastSignal: JSON.stringify({ action: signal.action, reason: signal.reason, indicators: signal.indicators, price, at: now }),
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    setBot(bot.id, { lastRunAt: now, lastError: msg.slice(0, 300) });
    log(`Tick error: ${msg.slice(0, 200)}`, { level: "error", botId: bot.id });
  } finally {
    running.delete(bot.id);
  }
}

const RUG_LIQ_DROP = 0.4; // exit if pool liquidity falls 40% from entry

function recordTick(pairId: string, price: number, liq: number) {
  try { sqlite.prepare("INSERT OR IGNORE INTO dex_ticks (pair_id, ts, price, liq) VALUES (?, ?, ?, ?)").run(pairId, Date.now(), price, liq); } catch {}
}

async function tickDexBot(bot: Bot) {
  const now = Date.now();
  const strat = DEX_STRATEGIES[bot.strategy];
  if (!strat) throw new Error(`Unknown DEX strategy ${bot.strategy}`);
  const p = await dexPair(bot.pairId!, 5_000);
  recordTick(p.pairId, p.priceUsd, p.liquidityUsd);
  const open = openPositions(bot.id);
  const signal = strat.evaluate(p, bot.params, open.length > 0);

  for (const pos of open) {
    if (pos.entryLiquidity && p.liquidityUsd < pos.entryLiquidity * (1 - RUG_LIQ_DROP)) { await closePosition(pos.id, `Liquidity dropped ${Math.round((1 - p.liquidityUsd / pos.entryLiquidity) * 100)}% — rug guard`); continue; }
    const ex = checkExit(pos, p.priceUsd);
    if (ex.reason) { await closePosition(pos.id, ex.reason); continue; }
    if (ex.highWater !== pos.highWater) updateHighWater(pos.id, ex.highWater);
    if (signal.action === "sell") await closePosition(pos.id, `Signal: ${signal.reason}`);
  }
  const stillOpen = openPositions(bot.id);
  if (signal.action === "buy" && stillOpen.length < bot.risk.maxOpenPositions) {
    const dayPnl = realizedPnlSince(startOfDay(), bot.id);
    if (dayPnl <= -bot.risk.maxDailyLossUsd) { setBot(bot.id, { haltedUntil: startOfDay() + 86_400_000 }); log(`Daily loss limit hit (${dayPnl.toFixed(2)}). Halted until tomorrow.`, { level: "warn", botId: bot.id }); }
    else if (inCooldown(bot)) log(`Buy signal ignored — cooldown (${signal.reason})`, { botId: bot.id });
    else if (!p.tradable) log(`Buy signal ignored — safety flags: ${p.flags.join(", ")}`, { level: "warn", botId: bot.id });
    else {
      try { await openPosition({ botId: bot.id, symbol: bot.symbol, pairId: bot.pairId, notionalUsd: bot.allocationUsd, mode: bot.mode, risk: bot.risk, reason: signal.reason, source: "bot" }); }
      catch (e) { log(`Entry blocked: ${(e as Error).message}`, { level: "warn", botId: bot.id }); }
    }
  }
  setBot(bot.id, { lastRunAt: now, lastError: null, lastSignal: JSON.stringify({ action: signal.action, reason: signal.reason, indicators: signal.indicators, price: p.priceUsd, at: now }) });
}

function inCooldown(bot: Bot) {
  if (!bot.risk.cooldownSec) return false;
  const lastClosed = db.select().from(schema.positions).where(eq(schema.positions.botId, bot.id)).all()
    .filter((p) => p.status === "closed").sort((a, b) => (b.exitAt ?? 0) - (a.exitAt ?? 0))[0];
  return !!lastClosed && Date.now() - (lastClosed.exitAt ?? 0) < bot.risk.cooldownSec * 1000;
}

/** Positions opened manually / from AI (no bot) still need SL/TP management. */
async function tickManualPositions() {
  const manual = openPositions().filter((p) => p.botId == null && (p.stopLoss || p.takeProfit || p.trailingStopPct));
  if (!manual.length) return;
  const { fetchTickers } = await import("@/lib/exchange");
  const tickers = await fetchTickers(getGlobal().quote);
  const dex = await dexPrices(manual.filter((p) => isDexPair(p.pairId)).map((p) => p.pairId!)).catch(() => ({} as Record<string, import("@/lib/dex").DexPair>));
  for (const pos of manual) {
    if (isDexPair(pos.pairId)) {
      const d = dex[pos.pairId!]; if (!d) continue;
      recordTick(d.pairId, d.priceUsd, d.liquidityUsd);
      if (pos.entryLiquidity && d.liquidityUsd < pos.entryLiquidity * (1 - RUG_LIQ_DROP)) { await closePosition(pos.id, "Liquidity collapse — rug guard").catch(() => {}); continue; }
    }
    const price = isDexPair(pos.pairId) ? dex[pos.pairId!]?.priceUsd : tickers[pos.symbol]?.last; if (!price) continue;
    const ex = checkExit(pos, price);
    if (ex.reason) await closePosition(pos.id, ex.reason).catch((e) => log(`Close failed: ${e.message}`, { level: "error" }));
    else if (ex.highWater !== pos.highWater) updateHighWater(pos.id, ex.highWater);
  }
}

let ticks = 0, lastSnapshot = 0, lastManual = 0;

export async function engineLoop() {
  const now = Date.now();
  ticks++;
  db.update(schema.engineState).set({ heartbeat: now, ticks }).where(eq(schema.engineState.id, 1)).run();

  const bots = listBots().filter((b) => b.status === "running");
  const due = bots.filter((b) => !b.lastRunAt || now - b.lastRunAt >= b.intervalSec * 1000 - 500);
  await Promise.all(due.map((b) => tickBot(b)));

  if (now - lastManual > 30_000) { lastManual = now; await tickManualPositions().catch((e) => log(`manual tick: ${e.message}`, { level: "error" })); }

  if (now - lastSnapshot > 60_000) {
    lastSnapshot = now;
    try { const eq = await computeEquity("paper"); snapshotEquity("paper", eq.equity, eq.cash); } catch (e) { log(`equity snapshot: ${(e as Error).message}`, { level: "warn" }); }
  }

  // optional scheduled AI scan
  const g = getGlobal();
  if (g.aiAutoScanMin > 0 && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY)) {
    const lastScan = getSetting<number>("last_auto_scan", 0);
    if (now - lastScan > g.aiAutoScanMin * 60_000) {
      setSetting("last_auto_scan", now);
      runScan().catch((e) => log(`auto scan failed: ${e.message}`, { level: "error" }));
    }
  }
}

export function startEngine() {
  const now = Date.now();
  db.update(schema.engineState).set({ startedAt: now, heartbeat: now, pid: process.pid, ticks: 0 }).where(eq(schema.engineState.id, 1)).run();
  log(`Engine started (pid ${process.pid})`);
  const loop = async () => {
    try { await engineLoop(); } catch (e) { log(`loop error: ${(e as Error).message}`, { level: "error" }); }
    setTimeout(loop, 5000);
  };
  loop();
}
