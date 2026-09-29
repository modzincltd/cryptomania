import { q, sb } from "@/lib/db";
import { listBots, updateBot, type Bot } from "@/lib/bots";
import { getStrategy } from "@/lib/strategies";
import { fetchCandles, fetchTickers } from "@/lib/exchange";
import { checkExit, closePosition, openPosition, openPositions, realizedPnlSince, startOfDay, updateHighWater } from "@/lib/executor";
import { computeEquity, snapshotEquity } from "@/lib/portfolio";
import { runScan } from "@/lib/ai";
import { getGlobal, getSetting, setSetting } from "@/lib/settings";
import { log } from "@/lib/log";
import { dexPair, dexPrices, isDexPair, type DexPair } from "@/lib/dex";
import { DEX_STRATEGIES } from "@/lib/dex-strategies";

const running = new Set<number>();
const RUG_LIQ_DROP = 0.4;

async function recordTick(pairId: string, price: number, liq: number) {
  await sb.from("dex_ticks").upsert({ pairId, ts: Date.now(), price, liq }, { onConflict: "pairId,ts", ignoreDuplicates: true });
}

async function guardEntry(bot: Bot, signalReason: string): Promise<boolean> {
  const dayPnl = await realizedPnlSince(startOfDay(), bot.id);
  if (dayPnl <= -bot.risk.maxDailyLossUsd) { await updateBot(bot.id, { haltedUntil: startOfDay() + 86_400_000 }); log(`Daily loss limit hit (${dayPnl.toFixed(2)}). Halted until tomorrow.`, { level: "warn", botId: bot.id }); return false; }
  if (await inCooldown(bot)) { log(`Buy signal ignored — cooldown (${signalReason})`, { botId: bot.id }); return false; }
  return true;
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
    const price = candles[candles.length - 1].close;
    const signal = strat.evaluate(candles.slice(0, -1), bot.params);
    for (const pos of await openPositions(bot.id)) {
      const ex = checkExit(pos, price);
      if (ex.reason) { await closePosition(pos.id, ex.reason); continue; }
      if (ex.highWater !== pos.highWater) await updateHighWater(pos.id, ex.highWater);
      if (signal.action === "sell") await closePosition(pos.id, `Signal: ${signal.reason}`);
    }
    if (signal.action === "buy" && (await openPositions(bot.id)).length < bot.risk.maxOpenPositions && (await guardEntry(bot, signal.reason))) {
      try { await openPosition({ botId: bot.id, symbol: bot.symbol, notionalUsd: bot.allocationUsd, mode: bot.mode, risk: bot.risk, reason: signal.reason, source: "bot" }); }
      catch (e) { log(`Entry blocked: ${(e as Error).message}`, { level: "warn", botId: bot.id }); }
    }
    await updateBot(bot.id, { lastRunAt: now, lastError: null, lastSignal: { action: signal.action, reason: signal.reason, indicators: signal.indicators, price, at: now } });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    await updateBot(bot.id, { lastRunAt: now, lastError: msg.slice(0, 300) }).catch(() => {});
    log(`Tick error: ${msg.slice(0, 200)}`, { level: "error", botId: bot.id });
  } finally { running.delete(bot.id); }
}

async function tickDexBot(bot: Bot) {
  const now = Date.now();
  const strat = DEX_STRATEGIES[bot.strategy];
  if (!strat) throw new Error(`Unknown DEX strategy ${bot.strategy}`);
  const p = await dexPair(bot.pairId!, 5_000);
  await recordTick(p.pairId, p.priceUsd, p.liquidityUsd);
  const open = await openPositions(bot.id);
  const signal = strat.evaluate(p, bot.params, open.length > 0);
  for (const pos of open) {
    if (pos.entryLiquidity && p.liquidityUsd < pos.entryLiquidity * (1 - RUG_LIQ_DROP)) { await closePosition(pos.id, `Liquidity dropped ${Math.round((1 - p.liquidityUsd / pos.entryLiquidity) * 100)}% — rug guard`); continue; }
    const ex = checkExit(pos, p.priceUsd);
    if (ex.reason) { await closePosition(pos.id, ex.reason); continue; }
    if (ex.highWater !== pos.highWater) await updateHighWater(pos.id, ex.highWater);
    if (signal.action === "sell") await closePosition(pos.id, `Signal: ${signal.reason}`);
  }
  if (signal.action === "buy" && (await openPositions(bot.id)).length < bot.risk.maxOpenPositions) {
    if (!p.tradable) log(`Buy signal ignored — safety flags: ${p.flags.join(", ")}`, { level: "warn", botId: bot.id });
    else if (await guardEntry(bot, signal.reason)) {
      try { await openPosition({ botId: bot.id, symbol: bot.symbol, pairId: bot.pairId, notionalUsd: bot.allocationUsd, mode: bot.mode, risk: bot.risk, reason: signal.reason, source: "bot" }); }
      catch (e) { log(`Entry blocked: ${(e as Error).message}`, { level: "warn", botId: bot.id }); }
    }
  }
  await updateBot(bot.id, { lastRunAt: now, lastError: null, lastSignal: { action: signal.action, reason: signal.reason, indicators: signal.indicators, price: p.priceUsd, at: now } });
}

async function inCooldown(bot: Bot) {
  if (!bot.risk.cooldownSec) return false;
  const last = await q<{ exitAt: number }[]>(sb.from("positions").select("exitAt").eq("botId", bot.id).eq("status", "closed").order("exitAt", { ascending: false }).limit(1));
  return !!last[0] && Date.now() - last[0].exitAt < bot.risk.cooldownSec * 1000;
}

async function tickManualPositions() {
  const manual = (await openPositions()).filter((p) => p.botId == null && (p.stopLoss || p.takeProfit || p.trailingStopPct));
  if (!manual.length) return;
  const tickers = await fetchTickers((await getGlobal()).quote);
  const dex = await dexPrices(manual.filter((p) => isDexPair(p.pairId)).map((p) => p.pairId!)).catch(() => ({} as Record<string, DexPair>));
  for (const pos of manual) {
    if (isDexPair(pos.pairId)) {
      const d = dex[pos.pairId!]; if (!d) continue;
      await recordTick(d.pairId, d.priceUsd, d.liquidityUsd);
      if (pos.entryLiquidity && d.liquidityUsd < pos.entryLiquidity * (1 - RUG_LIQ_DROP)) { await closePosition(pos.id, "Liquidity collapse — rug guard").catch(() => {}); continue; }
    }
    const price = isDexPair(pos.pairId) ? dex[pos.pairId!]?.priceUsd : tickers[pos.symbol]?.last; if (!price) continue;
    const ex = checkExit(pos, price);
    if (ex.reason) await closePosition(pos.id, ex.reason).catch((e) => log(`Close failed: ${e.message}`, { level: "error" }));
    else if (ex.highWater !== pos.highWater) await updateHighWater(pos.id, ex.highWater);
  }
}

/** One engine pass. Safe to call from a long-running loop or a cron endpoint. */
export async function engineLoop(opts: { force?: boolean } = {}) {
  const now = Date.now();
  const state = (await q<{ ticks: number }[]>(sb.from("engine_state").select("ticks").eq("id", 1)))[0];
  await sb.from("engine_state").upsert({ id: 1, heartbeat: now, ticks: (state?.ticks ?? 0) + 1, pid: process.pid });

  const bots = (await listBots()).filter((b) => b.status === "running");
  const due = bots.filter((b) => opts.force || !b.lastRunAt || now - b.lastRunAt >= b.intervalSec * 1000 - 1500);
  await Promise.all(due.map((b) => tickBot(b)));

  const lastManual = await getSetting<number>("_last_manual_tick", 0);
  if (now - lastManual > 25_000) { await setSetting("_last_manual_tick", now); await tickManualPositions().catch((e) => log(`manual tick: ${e.message}`, { level: "error" })); }

  const lastSnap = await getSetting<number>("_last_equity_snapshot", 0);
  if (now - lastSnap > 55_000) {
    await setSetting("_last_equity_snapshot", now);
    try { const eq = await computeEquity("paper"); await snapshotEquity("paper", eq.equity, eq.cash); } catch (e) { log(`equity snapshot: ${(e as Error).message}`, { level: "warn" }); }
  }

  const g = await getGlobal();
  if (g.aiAutoScanMin > 0 && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY)) {
    const lastScan = await getSetting<number>("last_auto_scan", 0);
    if (now - lastScan > g.aiAutoScanMin * 60_000) { await setSetting("last_auto_scan", now); await runScan().catch((e) => log(`auto scan failed: ${e.message}`, { level: "error" })); }
  }
  return { ticked: due.length, running: bots.length };
}

/** Local long-running mode (`npm run engine`). */
export async function startEngine() {
  await sb.from("engine_state").upsert({ id: 1, startedAt: Date.now(), heartbeat: Date.now(), pid: process.pid, ticks: 0 });
  log(`Engine started (pid ${process.pid})`);
  const loop = async () => { try { await engineLoop(); } catch (e) { log(`loop error: ${(e as Error).message}`, { level: "error" }); } setTimeout(loop, 5000); };
  loop();
}
