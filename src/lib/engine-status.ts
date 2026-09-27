import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { exchangeId, hasLiveKeys } from "./exchange";

export function engineStatus() {
  const s = db.select().from(schema.engineState).where(eq(schema.engineState.id, 1)).get();
  const hb = s?.heartbeat ?? 0;
  return { online: Date.now() - hb < 20_000, heartbeat: hb, startedAt: s?.startedAt ?? null, ticks: s?.ticks ?? 0, pid: s?.pid ?? null, exchange: exchangeId(), liveKeys: hasLiveKeys(), aiKey: !!process.env.ANTHROPIC_API_KEY };
}
