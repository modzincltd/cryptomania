import { eq } from "drizzle-orm";
import { db, schema } from "./db";

export interface GlobalSettings {
  maxOpenPositions: number;
  maxDailyLossUsd: number;
  quote: string;
  universeSize: number;
  aiAutoScanMin: number; // 0 = off
  aiModel: string;
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

export function setSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  db.insert(schema.settings).values({ key, value: v })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: v } }).run();
}

export function getGlobal(): GlobalSettings {
  return {
    maxOpenPositions: 5, maxDailyLossUsd: 300, quote: "USDT", universeSize: 30, aiAutoScanMin: 0, aiModel: "claude-sonnet-5",
    ...getSetting<Partial<GlobalSettings>>("global", {}),
  };
}

export function getPaperCash(): number { return getSetting<number>("paper_cash", 10000); }
export function setPaperCash(v: number) { setSetting("paper_cash", Math.round(v * 100) / 100); }
export function adjustPaperCash(delta: number) { setPaperCash(getPaperCash() + delta); }
