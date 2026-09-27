import { db, schema } from "./db";
import { callStructured } from "./llm";
import { dexPair, dexTrending, type DexPair } from "./dex";
import { newsFor } from "./news";
import { log } from "./log";
import type { Suggestion } from "./types";

const compact = (p: DexPair) => ({
  pairId: p.pairId, symbol: p.symbol, chain: p.chainId, dex: p.dexId, price: p.priceUsd, liqUsd: Math.round(p.liquidityUsd), mcap: Math.round(p.marketCap || p.fdv),
  ageH: Math.round(p.ageMin / 60), chg: p.change, vol: { h1: Math.round(p.volume.h1), h6: Math.round(p.volume.h6), h24: Math.round(p.volume.h24) },
  tx1h: p.txns.h1, tx24h: p.txns.h24, socials: p.hasSocials, boosts: p.boosts, score: p.score, flags: p.flags,
});

const SYSTEM = `You are a ruthless, risk-first DEX/memecoin analyst for a retail trader paper-trading on Solana/Base/EVM DEXs (long-only, spot swaps).
Reality check you must apply: most of these tokens go to zero; edges come from momentum with buyers in control, real liquidity relative to position size, and fast exits. Never recommend anything with a honeypot/low-liquidity flag. Prefer liquidity > $250k and age > 6h unless momentum is exceptional.
Position sizing guidance: assume $50-$250 per trade; stops 12-25% (or below the last hourly low), targets 1.5-3R, trailing stop advised.
Use ONLY the data provided. Reference actual numbers. Be blunt about low confidence.`;

const SCAN_TOOL = {
  name: "submit_dex_scan", description: "Structured DEX scan output.",
  input_schema: { type: "object" as const, properties: {
    regime: { type: "string", enum: ["risk-on", "risk-off", "ranging", "mixed"] }, summary: { type: "string" },
    suggestions: { type: "array", items: { type: "object", properties: {
      pairId: { type: "string" }, symbol: { type: "string" }, side: { type: "string", enum: ["long", "avoid"] }, entry: { type: "number" }, stopLoss: { type: "number" }, takeProfit: { type: "number" },
      confidence: { type: "integer", minimum: 0, maximum: 100 }, timeframe: { type: "string" }, rationale: { type: "string" }, riskReward: { type: "number" } },
      required: ["pairId", "symbol", "side", "entry", "stopLoss", "takeProfit", "confidence", "timeframe", "rationale", "riskReward"] } } },
    required: ["regime", "summary", "suggestions"] },
};

export async function runDexScan() {
  const pairs = (await dexTrending()).slice(0, 40);
  if (!pairs.length) throw new Error("No DEX pairs from trending feed");
  const res = await callStructured<{ regime: string; summary: string; suggestions: (Suggestion & { pairId: string })[] }>({
    system: SYSTEM, tool: SCAN_TOOL, maxTokens: 4000,
    user: `UTC ${new Date().toISOString()}\nTrending/boosted DEX pairs (pre-scored, flags = our safety filters):\n${JSON.stringify(pairs.map(compact))}\n\nReturn 3-6 suggestions (longs and avoids). Call submit_dex_scan.`,
  });
  const now = Date.now(); const model = `${res.provider}/${res.model}`;
  const scan = db.insert(schema.scans).values({ createdAt: now, summary: `[DEX] ${res.data.summary}`, regime: res.data.regime, universe: JSON.stringify(pairs.map((p) => p.pairId)), model, inputTokens: res.inputTokens, outputTokens: res.outputTokens }).returning().get();
  const valid = new Map(pairs.map((p) => [p.pairId, p]));
  const rows = res.data.suggestions.filter((s) => valid.has(s.pairId)).map((s) => ({
    scanId: scan.id, pairId: s.pairId, symbol: valid.get(s.pairId)!.symbol, side: s.side, entry: s.entry, stopLoss: s.stopLoss, takeProfit: s.takeProfit,
    confidence: Math.max(0, Math.min(100, Math.round(s.confidence))), timeframe: s.timeframe, rationale: s.rationale, riskReward: s.riskReward, status: "new", createdAt: now,
  }));
  if (rows.length) db.insert(schema.suggestions).values(rows).run();
  log(`AI DEX scan: ${res.data.regime}, ${rows.length} suggestions (${model})`);
  return { scan, suggestions: rows };
}

const PAIR_TOOL = {
  name: "submit_dex_analysis", description: "Deep-dive on one DEX pair.",
  input_schema: { type: "object" as const, properties: {
    bias: { type: "string", enum: ["bullish", "bearish", "neutral"] }, thesis: { type: "string" }, rugRisk: { type: "string", enum: ["low", "medium", "high"] },
    risks: { type: "array", items: { type: "string" } },
    suggestion: { type: "object", properties: { side: { type: "string", enum: ["long", "avoid"] }, entry: { type: "number" }, stopLoss: { type: "number" }, takeProfit: { type: "number" }, confidence: { type: "integer" }, timeframe: { type: "string" }, rationale: { type: "string" }, riskReward: { type: "number" } },
      required: ["side", "entry", "stopLoss", "takeProfit", "confidence", "timeframe", "rationale", "riskReward"] } },
    required: ["bias", "thesis", "rugRisk", "risks", "suggestion"] },
};

export async function analyseDexPair(pairId: string) {
  const p = await dexPair(pairId, 5_000);
  const news = await newsFor(p.symbol).catch(() => []);
  const res = await callStructured<{ bias: string; thesis: string; rugRisk: string; risks: string[]; suggestion: Suggestion }>({
    system: SYSTEM, tool: PAIR_TOOL, maxTokens: 2500,
    user: `Pair: ${JSON.stringify(compact(p))}\nToken: ${p.baseName} (${p.baseAddress})\nHeadlines: ${news.slice(0, 8).map((n) => n.title).join(" | ") || "none"}\n\nCall submit_dex_analysis.`,
  });
  const now = Date.now(); const s = res.data.suggestion;
  const row = db.insert(schema.suggestions).values({ scanId: null, pairId, symbol: p.symbol, side: s.side, entry: s.entry, stopLoss: s.stopLoss, takeProfit: s.takeProfit, confidence: Math.max(0, Math.min(100, Math.round(s.confidence))), timeframe: s.timeframe, rationale: s.rationale, riskReward: s.riskReward, status: "new", createdAt: now }).returning().get();
  log(`AI DEX deep-dive ${p.symbol}: ${res.data.bias}, rug ${res.data.rugRisk}`);
  return { ...res.data, suggestion: row, model: `${res.provider}/${res.model}`, tokens: res.inputTokens + res.outputTokens, createdAt: now };
}
