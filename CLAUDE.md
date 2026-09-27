# Crypto Mania — notes for agents
- Next 16 app router + separate engine process (`src/engine`) sharing SQLite via drizzle. Both import from `src/lib`.
- Schema changes: edit `src/lib/db/schema.ts` AND the raw `BOOTSTRAP` SQL in `src/lib/db/index.ts` (no migrations; add `ALTER TABLE` guards there if changing existing tables).
- Strategies live in `src/lib/strategies/index.ts`; add to `STRATEGIES` and the zod enum in `src/lib/validation.ts`.
- Route files export only HTTP handlers; shared schemas go in `src/lib/validation.ts`.
- `npm run typecheck` then `npm run build` before calling anything done.
