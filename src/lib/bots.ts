import { one, q, sb, type BotRow } from "./db";
import { DEFAULT_RISK, type BotConfig, type RiskConfig } from "./types";
import { getStrategy } from "./strategies";
import { DEX_STRATEGIES, isDexStrategy } from "./dex-strategies";

export type { BotRow };
export type Bot = BotConfig & { lastRunAt: number | null; lastSignal: Record<string, unknown> | null; lastError: string | null; haltedUntil: number | null; createdAt: number };

export function parseBot(row: BotRow): Bot {
  const strat = isDexStrategy(row.strategy) ? DEX_STRATEGIES[row.strategy] : getStrategy(row.strategy);
  return {
    id: row.id, name: row.name, symbol: row.symbol, timeframe: row.timeframe as BotConfig["timeframe"], intervalSec: row.intervalSec as BotConfig["intervalSec"],
    strategy: row.strategy as BotConfig["strategy"], params: { ...strat.defaultParams, ...(row.params ?? {}) }, risk: { ...DEFAULT_RISK, ...(row.risk ?? {}) } as RiskConfig,
    mode: row.mode as BotConfig["mode"], status: row.status as BotConfig["status"], allocationUsd: row.allocationUsd, pairId: row.pairId,
    lastRunAt: row.lastRunAt, lastSignal: row.lastSignal, lastError: row.lastError, haltedUntil: row.haltedUntil, createdAt: row.createdAt,
  };
}
export async function listBots() { return (await q<BotRow[]>(sb.from("bots").select("*").order("id"))).map(parseBot); }
export async function getBot(id: number) { const r = await one<BotRow>(sb.from("bots").select("*").eq("id", id).single()); return r ? parseBot(r) : null; }
export async function updateBot(id: number, patch: Partial<BotRow>) { await q(sb.from("bots").update(patch).eq("id", id)); }
export async function setBotStatus(id: number, status: BotConfig["status"]) { await updateBot(id, { status, lastError: null }); }
