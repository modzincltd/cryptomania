# Crypto Mania — notes for agents
- Next 16 app router. Data layer is supabase-js (`src/lib/db`), service-role key, camelCase quoted columns; schema lives in `supabase/schema.sql` (idempotent — apply via Supabase SQL editor / MCP). No ORM, no migrations tool: edit schema.sql and add `alter table ... add column if not exists`.
- Engine: `engineLoop()` in `src/engine/runner.ts`. Locally `npm run engine` loops it; on Vercel `/api/cron/tick` (vercel.json cron, 1/min, double pass for 30s bots).
- Strategies: CEX in `src/lib/strategies/index.ts` (candle-based), DEX in `src/lib/dex-strategies.ts` (DexScreener stats). Add ids to the zod enum in `src/lib/validation.ts` and the union in `src/lib/types.ts`.
- Route files export only HTTP handlers; shared schemas go in `src/lib/validation.ts`.
- `npm run typecheck && npx eslint src` before calling anything done. Commit + push to modzincltd/cryptomania (Vercel auto-deploys main).
