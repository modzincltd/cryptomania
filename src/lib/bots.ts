import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { DEFAULT_RISK, type BotConfig, type RiskConfig } from "./types";
import { getStrategy } from "./strategies";
import { DEX_STRATEGIES, isDexStrategy } from "./dex-strategies";

export type BotRow = typeof schema.bots.$inferSelect;

export function parseBot(row: BotRow): BotConfig & { lastRunAt: number | null; lastSignal: string | null; lastError: string | null; haltedUntil: number | null; createdAt: number } {
  let params: Record<string, number> = {}; let risk: Partial<RiskConfig> = {};
  try { params = JSON.parse(row.params); } catch {}
  try { risk = JSON.parse(row.risk); } catch {}
  const strat = isDexStrategy(row.strategy) ? DEX_STRATEGIES[row.strategy] : getStrategy(row.strategy);
  return {
    id: row.id, name: row.name, symbol: row.symbol, timeframe: row.timeframe as BotConfig["timeframe"],
    intervalSec: row.intervalSec as BotConfig["intervalSec"], strategy: row.strategy as BotConfig["strategy"],
    params: { ...strat.defaultParams, ...params }, risk: { ...DEFAULT_RISK, ...risk },
    mode: row.mode as BotConfig["mode"], status: row.status as BotConfig["status"], allocationUsd: row.allocationUsd, pairId: row.pairId,
    lastRunAt: row.lastRunAt, lastSignal: row.lastSignal, lastError: row.lastError, haltedUntil: row.haltedUntil, createdAt: row.createdAt,
  };
}

export function listBots() { return db.select().from(schema.bots).orderBy(schema.bots.id).all().map(parseBot); }
export function getBot(id: number) { const r = db.select().from(schema.bots).where(eq(schema.bots.id, id)).get(); return r ? parseBot(r) : null; }

export function setBotStatus(id: number, status: BotConfig["status"]) {
  db.update(schema.bots).set({ status, lastError: null }).where(eq(schema.bots.id, id)).run();
}
