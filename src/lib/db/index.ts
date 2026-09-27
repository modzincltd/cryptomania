import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "cryptomania.db");

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '5m', interval_sec INTEGER NOT NULL DEFAULT 60,
  strategy TEXT NOT NULL, params TEXT NOT NULL DEFAULT '{}', risk TEXT NOT NULL DEFAULT '{}',
  mode TEXT NOT NULL DEFAULT 'paper', status TEXT NOT NULL DEFAULT 'stopped',
  allocation_usd REAL NOT NULL DEFAULT 500, created_at INTEGER NOT NULL,
  last_run_at INTEGER, last_signal TEXT, last_error TEXT, halted_until INTEGER
);
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id INTEGER, symbol TEXT NOT NULL, side TEXT NOT NULL DEFAULT 'long',
  qty REAL NOT NULL, entry_price REAL NOT NULL, entry_at INTEGER NOT NULL,
  stop_loss REAL, take_profit REAL, trailing_stop_pct REAL, high_water REAL,
  status TEXT NOT NULL DEFAULT 'open', exit_price REAL, exit_at INTEGER, exit_reason TEXT,
  pnl REAL, pnl_pct REAL, mode TEXT NOT NULL DEFAULT 'paper', source TEXT NOT NULL DEFAULT 'bot'
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id INTEGER, position_id INTEGER, symbol TEXT NOT NULL,
  side TEXT NOT NULL, qty REAL NOT NULL, price REAL NOT NULL, fee REAL NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'paper', reason TEXT, exchange_order_id TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, scan_id INTEGER, symbol TEXT NOT NULL, side TEXT NOT NULL,
  entry REAL NOT NULL, stop_loss REAL NOT NULL, take_profit REAL NOT NULL, confidence INTEGER NOT NULL,
  timeframe TEXT NOT NULL, rationale TEXT NOT NULL, risk_reward REAL,
  status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, summary TEXT NOT NULL,
  regime TEXT, universe TEXT NOT NULL, model TEXT, input_tokens INTEGER, output_tokens INTEGER
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, level TEXT NOT NULL DEFAULT 'info',
  bot_id INTEGER, message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS equity_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, mode TEXT NOT NULL, equity REAL NOT NULL, cash REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS engine_state (
  id INTEGER PRIMARY KEY, started_at INTEGER, heartbeat INTEGER, pid INTEGER, ticks INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
CREATE INDEX IF NOT EXISTS idx_equity_ts ON equity_snapshots(ts);
INSERT OR IGNORE INTO engine_state (id) VALUES (1);
INSERT OR IGNORE INTO settings (key, value) VALUES ('paper_cash', '10000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('paper_start_cash', '10000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('global', '{"maxOpenPositions":5,"maxDailyLossUsd":300,"quote":"USDT","universeSize":30,"aiAutoScanMin":0,"aiModel":"claude-sonnet-5"}');
`;

declare global {
  // eslint-disable-next-line no-var
  var __cm_db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __cm_sqlite: Database.Database | undefined;
}

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.exec(BOOTSTRAP);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

if (!globalThis.__cm_db) {
  const { sqlite, db } = open();
  globalThis.__cm_db = db;
  globalThis.__cm_sqlite = sqlite;
}

export const db = globalThis.__cm_db!;
export const sqlite = globalThis.__cm_sqlite!;
export { schema };
