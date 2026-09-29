import { q, sb, type EquityRow, type PositionRow } from "./db";
import { fetchTickers } from "./exchange";
import { getGlobal, getPaperCash, getSetting } from "./settings";
import { openPositions, realizedPnlSince, startOfDay } from "./executor";
import { dexPrices, isDexPair, type DexPair } from "./dex";

export async function computeEquity(mode: "paper" | "live" = "paper") {
  const g = await getGlobal();
  const [tickers, open] = await Promise.all([fetchTickers(g.quote), openPositions()]);
  const mine = open.filter((p) => p.mode === mode);
  const dex = await dexPrices(mine.filter((p) => isDexPair(p.pairId)).map((p) => p.pairId!)).catch(() => ({} as Record<string, DexPair>));
  let unrealized = 0, value = 0;
  const positions = mine.map((p) => {
    const price = (isDexPair(p.pairId) ? dex[p.pairId!]?.priceUsd : tickers[p.symbol]?.last) ?? p.entryPrice;
    const mv = price * p.qty, pnl = mv - p.entryPrice * p.qty; unrealized += pnl; value += mv;
    return { ...p, price, marketValue: mv, unrealizedPnl: pnl, unrealizedPct: (pnl / (p.entryPrice * p.qty)) * 100 };
  });
  const cash = mode === "paper" ? await getPaperCash() : 0;
  return { cash, positionsValue: value, equity: cash + value, unrealized, positions };
}
export async function snapshotEquity(mode: "paper" | "live", equity: number, cash: number) { await q(sb.from("equity_snapshots").insert({ ts: Date.now(), mode, equity, cash })); }
export async function equityHistory(mode: "paper" | "live", sinceMs: number) { return q<EquityRow[]>(sb.from("equity_snapshots").select("*").eq("mode", mode).gte("ts", sinceMs).order("ts").limit(5000)); }

export async function stats(mode: "paper" | "live" = "paper") {
  const closed = await q<PositionRow[]>(sb.from("positions").select("*").eq("status", "closed").eq("mode", mode).order("exitAt", { ascending: false }).limit(5000));
  const wins = closed.filter((p) => (p.pnl ?? 0) > 0), losses = closed.filter((p) => (p.pnl ?? 0) <= 0);
  const grossWin = wins.reduce((a, p) => a + (p.pnl ?? 0), 0), grossLoss = Math.abs(losses.reduce((a, p) => a + (p.pnl ?? 0), 0));
  return {
    totalTrades: closed.length, winRate: closed.length ? (wins.length / closed.length) * 100 : 0, realized: closed.reduce((a, p) => a + (p.pnl ?? 0), 0),
    realizedToday: await realizedPnlSince(startOfDay()), profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgWin: wins.length ? grossWin / wins.length : 0, avgLoss: losses.length ? grossLoss / losses.length : 0, startCash: Number(await getSetting<number>("paper_start_cash", 10000)),
  };
}

export async function withLivePnl<T extends { status: string; symbol: string; qty: number; entryPrice: number; pnl: number | null; pnlPct: number | null; exitPrice: number | null; pairId?: string | null }>(rows: T[]) {
  if (!rows.some((r) => r.status === "open")) return rows.map((r) => ({ ...r, live: false as const, price: r.exitPrice }));
  const tickers = await fetchTickers((await getGlobal()).quote).catch(() => ({} as Record<string, { last: number }>));
  const dex = await dexPrices(rows.filter((r) => r.status === "open" && isDexPair(r.pairId)).map((r) => r.pairId!)).catch(() => ({} as Record<string, DexPair>));
  return rows.map((r) => {
    if (r.status !== "open") return { ...r, live: false as const, price: r.exitPrice };
    const price = (isDexPair(r.pairId) ? dex[r.pairId!]?.priceUsd : tickers[r.symbol]?.last) ?? r.entryPrice;
    const pnl = (price - r.entryPrice) * r.qty;
    return { ...r, live: true as const, price, pnl, pnlPct: (pnl / (r.entryPrice * r.qty)) * 100 };
  });
}
