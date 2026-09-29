import { one, q, sb } from "./db";

export interface GlobalSettings {
  maxOpenPositions: number; maxDailyLossUsd: number; quote: string; universeSize: number;
  aiAutoScanMin: number; aiModel: string; aiProvider: "anthropic" | "openai";
}
const DEFAULT_GLOBAL: GlobalSettings = { maxOpenPositions: 5, maxDailyLossUsd: 300, quote: "USDT", universeSize: 30, aiAutoScanMin: 0, aiModel: "", aiProvider: "openai" };

// tiny per-process cache so hot paths don't hit PostgREST for every setting read
const cache = new Map<string, { at: number; v: unknown }>();
const TTL = 3000;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const c = cache.get(key); if (c && Date.now() - c.at < TTL) return c.v as T;
  const row = await one<{ value: T }>(sb.from("settings").select("value").eq("key", key).single());
  const v = row ? row.value : fallback;
  cache.set(key, { at: Date.now(), v });
  return v;
}
export async function setSetting(key: string, value: unknown) {
  await q(sb.from("settings").upsert({ key, value }, { onConflict: "key" }));
  cache.set(key, { at: Date.now(), v: value });
}
export async function getGlobal(): Promise<GlobalSettings> { return { ...DEFAULT_GLOBAL, ...(await getSetting<Partial<GlobalSettings>>("global", {})) }; }
export async function getPaperCash() { return Number(await getSetting<number>("paper_cash", 10000)); }
export async function setPaperCash(v: number) { await setSetting("paper_cash", Math.round(v * 100) / 100); }
export async function adjustPaperCash(delta: number) { cache.delete("paper_cash"); await setPaperCash((await getPaperCash()) + delta); }
