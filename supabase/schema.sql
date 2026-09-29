-- Crypto Mania schema (Postgres / Supabase). Idempotent — safe to re-run.
create table if not exists settings ("key" text primary key, "value" jsonb not null);
create table if not exists bots (
  id bigserial primary key, name text not null, symbol text not null, timeframe text not null default '5m',
  "intervalSec" int not null default 60, strategy text not null, params jsonb not null default '{}', risk jsonb not null default '{}',
  mode text not null default 'paper', status text not null default 'stopped', "allocationUsd" double precision not null default 500,
  "pairId" text, "createdAt" bigint not null, "lastRunAt" bigint, "lastSignal" jsonb, "lastError" text, "haltedUntil" bigint
);
create table if not exists positions (
  id bigserial primary key, "botId" bigint, symbol text not null, side text not null default 'long', qty double precision not null,
  "entryPrice" double precision not null, "entryAt" bigint not null, "stopLoss" double precision, "takeProfit" double precision,
  "trailingStopPct" double precision, "highWater" double precision, status text not null default 'open', "exitPrice" double precision,
  "exitAt" bigint, "exitReason" text, pnl double precision, "pnlPct" double precision, mode text not null default 'paper',
  source text not null default 'bot', "pairId" text, "entryLiquidity" double precision
);
create table if not exists trades (
  id bigserial primary key, "botId" bigint, "positionId" bigint, symbol text not null, side text not null, qty double precision not null,
  price double precision not null, fee double precision not null default 0, mode text not null default 'paper', reason text,
  "exchangeOrderId" text, "createdAt" bigint not null, "pairId" text
);
create table if not exists suggestions (
  id bigserial primary key, "scanId" bigint, symbol text not null, side text not null, entry double precision not null,
  "stopLoss" double precision not null, "takeProfit" double precision not null, confidence int not null, timeframe text not null,
  rationale text not null, "riskReward" double precision, status text not null default 'new', "createdAt" bigint not null, "pairId" text
);
create table if not exists scans (
  id bigserial primary key, "createdAt" bigint not null, summary text not null, regime text, universe jsonb not null,
  model text, "inputTokens" int, "outputTokens" int
);
create table if not exists logs (id bigserial primary key, ts bigint not null, level text not null default 'info', "botId" bigint, message text not null);
create table if not exists equity_snapshots (id bigserial primary key, ts bigint not null, mode text not null, equity double precision not null, cash double precision not null);
create table if not exists engine_state (id int primary key, "startedAt" bigint, heartbeat bigint, pid int, ticks int not null default 0);
create table if not exists dex_ticks ("pairId" text not null, ts bigint not null, price double precision not null, liq double precision, primary key ("pairId", ts));
create index if not exists idx_positions_status on positions(status);
create index if not exists idx_positions_symbol on positions(symbol);
create index if not exists idx_positions_pair on positions("pairId");
create index if not exists idx_trades_created on trades("createdAt" desc);
create index if not exists idx_logs_ts on logs(ts desc);
create index if not exists idx_logs_bot on logs("botId");
create index if not exists idx_equity_ts on equity_snapshots(ts);
create index if not exists idx_sugg_created on suggestions("createdAt" desc);
insert into engine_state (id) values (1) on conflict do nothing;
insert into settings ("key","value") values ('paper_cash','10000') on conflict do nothing;
insert into settings ("key","value") values ('paper_start_cash','10000') on conflict do nothing;
insert into settings ("key","value") values ('global','{"maxOpenPositions":5,"maxDailyLossUsd":300,"quote":"USDT","universeSize":30,"aiAutoScanMin":0,"aiModel":"","aiProvider":"openai"}') on conflict do nothing;
-- Only the service role (server) touches these tables; RLS with no policies blocks the anon key.
alter table settings enable row level security; alter table bots enable row level security; alter table positions enable row level security;
alter table trades enable row level security; alter table suggestions enable row level security; alter table scans enable row level security;
alter table logs enable row level security; alter table equity_snapshots enable row level security; alter table engine_state enable row level security;
alter table dex_ticks enable row level security;
