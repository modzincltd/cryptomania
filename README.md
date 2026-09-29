# Crypto Mania

Rules-based crypto bot desk with an AI market scanner. Next.js dashboard + bot engine on a shared Supabase (Postgres) DB. Runs on Vercel (engine via Cron) or locally (engine as a process).

- **Paper trading by default** against live exchange prices (Binance public API, switchable). Live mode only unlocks when exchange API keys are present.
- **Bots** poll on a 30s / 1m / 5m interval (no streaming). Each bot = one symbol + one strategy + risk rules.
- **Strategies**: RSI mean-reversion, EMA crossover, Bollinger bounce, Donchian breakout, MACD momentum. Signals fire on closed candles only.
- **Risk rules per bot**: stop-loss, take-profit, trailing stop, max position size, max daily loss (auto-halt), cooldown, max open positions. Plus global caps in Settings.
- **AI scanner**: builds an indicator snapshot of the top-N pairs and asks Claude for structured trade ideas (entry / stop / target / confidence / rationale). One click to paper-buy or spin into a bot. Optional auto-scan every N minutes.

## DEX (paper, phase 1)

- `/dex` — trending/boosted and newly-profiled pairs on Solana / Base / ETH / BSC via DexScreener (no key), plus search and favourites. Every pair gets a 0-100 score and safety flags (liquidity, age, volume, buy/sell skew, socials); flagged pairs are blocked for bots and greyed for manual buys.
- `/dex/[chain]/[pair]` — embedded DexScreener chart, txn flow, your history, AI deep dive (with rug-risk call), quick paper buy, and a DEX bot builder.
- DEX strategies: **Momentum Rider**, **Volume Spike**, **Dip Buyer** — driven by DexScreener 5m/1h/6h stats and buy/sell flow (no OHLCV needed). Engine polls every 30s/1m and records price+liquidity ticks.
- Always-on protections: SL / TP / trailing stop and a **rug guard** (exit if pool liquidity drops 40% from entry). Paper fills model constant-product price impact from pool liquidity + ~0.6% fees.
- Live swaps (Jupiter for Solana, 0x for EVM) are phase 2 — bots/positions with a pairId are paper-only until then.

## Run

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor (idempotent).
2. `cp .env.example .env` and fill `SUPABASE_URL` + `SUPABASE_ROLE` (+ AI key).

```bash
npm install
npm run dev                 # web on :3000 + local engine loop (5s scheduler, bots tick on their own interval)
```

### Vercel
Set the same env vars in the project (plus `CRON_SECRET`, any random string). `vercel.json` schedules `/api/cron/tick` every minute; each call runs one engine pass, and a second pass ~30s later if any running bot is on a 30s interval. The sidebar "Engine" pill shows the last tick. For sub-minute ticks on Hobby (daily crons only) or more headroom, point an external pinger at `https://<app>/api/cron/tick?secret=$CRON_SECRET` every 30-60s.

## Layout

```
src/lib/        db (supabase-js), exchange (ccxt), indicators, strategies, executor (paper/live fills), risk, portfolio, ai
src/engine/     engineLoop(): due-bot ticks, SL/TP + rug guard, equity snapshots, optional auto-scan. Called by the local loop or /api/cron/tick
src/app/api/    REST used by the UI
src/app/        dashboard, bots, ai, markets, trades, settings
supabase/       schema.sql
```

## Env

| var | purpose |
|---|---|
| `EXCHANGE` | `binance` (default) · `kraken` · `coinbase` · `bybit` |
| `EXCHANGE_API_KEY/SECRET(/PASSWORD)` | live trading only |
| `OPEN_AI_KEY` / `ANTHROPIC_API_KEY` | AI scans — provider + model chosen in Settings (models listed live from the API) |
| `SUPABASE_URL` / `SUPABASE_ROLE` | database |
| `CRON_SECRET` | protects the cron tick endpoint |

## Notes

- Spot, long-only, market orders. Paper fills use last price ± 5 bps slippage and 0.1% fee.
- Pause keeps positions open (engine still manages stops). Stop closes them.
- Live mode has had zero real-money testing. Start small.
