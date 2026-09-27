# Crypto Mania

Rules-based crypto bot desk with an AI market scanner. Next.js dashboard + a separate bot engine sharing one SQLite DB.

- **Paper trading by default** against live exchange prices (Binance public API, switchable). Live mode only unlocks when exchange API keys are present.
- **Bots** poll on a 30s / 1m / 5m interval (no streaming). Each bot = one symbol + one strategy + risk rules.
- **Strategies**: RSI mean-reversion, EMA crossover, Bollinger bounce, Donchian breakout, MACD momentum. Signals fire on closed candles only.
- **Risk rules per bot**: stop-loss, take-profit, trailing stop, max position size, max daily loss (auto-halt), cooldown, max open positions. Plus global caps in Settings.
- **AI scanner**: builds an indicator snapshot of the top-N pairs and asks Claude for structured trade ideas (entry / stop / target / confidence / rationale). One click to paper-buy or spin into a bot. Optional auto-scan every N minutes.

## Run

```bash
cp .env.example .env        # add ANTHROPIC_API_KEY for scans; exchange keys only for live
npm install                 # (see note below if node_modules already exists)
npm run dev                 # web on :3000 + engine, both with hot reload
```

Or separately: `npm run web` and `npm run engine`. The engine must be running for bots to trade and for stops on manual/AI positions to be enforced — the sidebar shows its heartbeat.

> **Note:** `node_modules` was installed from a Linux VM. On macOS run `rm -rf node_modules && npm install` once so native modules (better-sqlite3, Next SWC) match your platform.

## Layout

```
src/lib/        db (drizzle + better-sqlite3), exchange (ccxt), indicators, strategies, executor (paper/live fills), risk, portfolio, ai
src/engine/     long-running runner: due-bot ticks, SL/TP management, equity snapshots, optional auto-scan
src/app/api/    REST used by the UI
src/app/        dashboard, bots, ai, markets, trades, settings
data/           cryptomania.db (gitignored)
```

## Env

| var | purpose |
|---|---|
| `EXCHANGE` | `binance` (default) · `kraken` · `coinbase` · `bybit` |
| `EXCHANGE_API_KEY/SECRET(/PASSWORD)` | live trading only |
| `OPEN_AI_KEY` / `ANTHROPIC_API_KEY` | AI scans — provider + model chosen in Settings (models listed live from the API) |
| `DB_PATH` | override sqlite location |

## Notes

- Spot, long-only, market orders. Paper fills use last price ± 5 bps slippage and 0.1% fee.
- Pause keeps positions open (engine still manages stops). Stop closes them.
- Live mode has had zero real-money testing. Start small.
