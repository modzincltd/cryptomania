import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
});

export const bots = sqliteTable("bots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull().default("5m"),
  intervalSec: integer("interval_sec").notNull().default(60),
  strategy: text("strategy").notNull(),
  params: text("params").notNull().default("{}"),
  risk: text("risk").notNull().default("{}"),
  mode: text("mode").notNull().default("paper"),
  status: text("status").notNull().default("stopped"),
  allocationUsd: real("allocation_usd").notNull().default(500),
  pairId: text("pair_id"),
  createdAt: integer("created_at").notNull(),
  lastRunAt: integer("last_run_at"),
  lastSignal: text("last_signal"),
  lastError: text("last_error"),
  haltedUntil: integer("halted_until"),
});

export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull().default("long"),
  qty: real("qty").notNull(),
  entryPrice: real("entry_price").notNull(),
  entryAt: integer("entry_at").notNull(),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  trailingStopPct: real("trailing_stop_pct"),
  highWater: real("high_water"),
  status: text("status").notNull().default("open"),
  exitPrice: real("exit_price"),
  exitAt: integer("exit_at"),
  exitReason: text("exit_reason"),
  pnl: real("pnl"),
  pnlPct: real("pnl_pct"),
  mode: text("mode").notNull().default("paper"),
  source: text("source").notNull().default("bot"), // bot | manual | ai
  pairId: text("pair_id"),
  entryLiquidity: real("entry_liquidity"),
});

export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: integer("bot_id"),
  positionId: integer("position_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // buy | sell
  qty: real("qty").notNull(),
  price: real("price").notNull(),
  fee: real("fee").notNull().default(0),
  mode: text("mode").notNull().default("paper"),
  reason: text("reason"),
  exchangeOrderId: text("exchange_order_id"),
  createdAt: integer("created_at").notNull(),
  pairId: text("pair_id"),
});

export const suggestions = sqliteTable("suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: integer("scan_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entry: real("entry").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  confidence: integer("confidence").notNull(),
  timeframe: text("timeframe").notNull(),
  rationale: text("rationale").notNull(),
  riskReward: real("risk_reward"),
  status: text("status").notNull().default("new"),
  createdAt: integer("created_at").notNull(),
  pairId: text("pair_id"),
});

export const scans = sqliteTable("scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at").notNull(),
  summary: text("summary").notNull(),
  regime: text("regime"),
  universe: text("universe").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
});

export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts").notNull(),
  level: text("level").notNull().default("info"),
  botId: integer("bot_id"),
  message: text("message").notNull(),
});

export const equitySnapshots = sqliteTable("equity_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts").notNull(),
  mode: text("mode").notNull(),
  equity: real("equity").notNull(),
  cash: real("cash").notNull(),
});

export const engineState = sqliteTable("engine_state", {
  id: integer("id").primaryKey(),
  startedAt: integer("started_at"),
  heartbeat: integer("heartbeat"),
  pid: integer("pid"),
  ticks: integer("ticks").notNull().default(0),
});
