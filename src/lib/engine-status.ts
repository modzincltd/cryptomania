import { one, sb, type EngineStateRow } from "./db";
import { exchangeId, hasLiveKeys } from "./exchange";
import { activeProvider, providerKeys } from "./llm";

export async function engineStatus() {
  const s = await one<EngineStateRow>(sb.from("engine_state").select("*").eq("id", 1).single());
  const hb = s?.heartbeat ?? 0;
  const cron = !!process.env.VERCEL || !!process.env.CRON_SECRET;
  return { online: Date.now() - hb < (cron ? 150_000 : 20_000), heartbeat: hb, startedAt: s?.startedAt ?? null, ticks: s?.ticks ?? 0, pid: s?.pid ?? null, mode: cron ? "cron" : "process", exchange: exchangeId(), liveKeys: hasLiveKeys(), aiKey: Object.values(providerKeys()).some(Boolean), ai: await activeProvider() };
}
