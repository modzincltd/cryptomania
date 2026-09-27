import { desc, gte, and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { fetchTickers } from "./exchange";
import { getGlobal, getPaperCash, getSetting } from "./settings";
import { openPositions, realizedPnlSince, startOfDay } from "./executor";

export async function computeEquity(mode: "paper" | "live" = "paper") {
  const g = getGlobal();
  const tickers = await fetchTickers(g.quote);
  const open = openPositions().filter((p) => p.mode === mode);
  let unrealized = 0, value = 0;
  const positions = open.map((p) => {
    const price = tickers[p.symbol]?.last ?? p.entryPrice;
    const mv = price * p.qty;
    const pnl = mv - p.entryPrice * p.qty;
    unrealized += pnl; value += mv;
    return { ...p, price, marketValue: mv, unrealizedPnl: pnl, unrealizedPct: (pnl / (p.entryPrice * p.qty)) * 100 };
  });
  const cash = mode === "paper" ? getPaperCash() : 0;
  return { cash, positionsValue: value, equity: cash + value, unrealized, positions };
}

export function snapshotEquity(mode: "paper" | "live", equity: number, cash: number) {
  db.insert(schema.equitySnapshots).values({ ts: Date.now(), mode, equity, cash }).run();
}

export function equityHistory(mode: "paper" | "live", sinceMs: number) {
  return db.select().from(schema.equitySnapshots).where(and(eq(schema.equitySnapshots.mode, mode), gte(schema.equitySnapshots.ts, sinceMs))).orderBy(schema.equitySnapshots.ts).all();
}

export function stats(mode: "paper" | "live" = "paper") {
  const closed = db.select().from(schema.positions).where(and(eq(schema.positions.status, "closed"), eq(schema.positions.mode, mode))).orderBy(desc(schema.positions.exitAt)).all();
  const wins = closed.filter((p) => (p.pnl ?? 0) > 0);
  const losses = closed.filter((p) => (p.pnl ?? 0) <= 0);
  const grossWin = wins.reduce((a, p) => a + (p.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((a, p) => a + (p.pnl ?? 0), 0));
  return {
    totalTrades: closed.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    realized: closed.reduce((a, p) => a + (p.pnl ?? 0), 0),
    realizedToday: realizedPnlSince(startOfDay()),
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    startCash: getSetting<number>("paper_start_cash", 10000),
  };
}
