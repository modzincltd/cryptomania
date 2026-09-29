import { callStructured } from "./llm";
import { q, sb, type ScanRow } from "./db";
import { fetchCandles, topSymbols, exchangeId } from "./exchange";
import { atr, ema, rsi, last, round, sma } from "./indicators";
import { getGlobal } from "./settings";
import { openPositions } from "./executor";
import { listBots } from "./bots";
import { log } from "./log";
import type { Suggestion } from "./types";

interface SymbolSnapshot {
  symbol: string; price: number; change24h: number; change7d: number; quoteVolumeM: number;
  rsi1h: number; rsi4h: number; ema20vs50_1h: string; ema50vs200_4h: string; atrPct1h: number; volRatio1h: number;
  distHigh7d: number; distLow7d: number;
}

export async function buildMarketSnapshot(n?: number): Promise<SymbolSnapshot[]> {
  const g = await getGlobal();
  const top = await topSymbols(g.quote, n ?? g.universeSize);
  const out: SymbolSnapshot[] = [];
  for (const t of top) {
    try {
      const [h1, h4] = await Promise.all([fetchCandles(t.symbol, "1h", 200, 60_000), fetchCandles(t.symbol, "4h", 200, 60_000)]);
      const c1 = h1.map((c) => c.close), c4 = h4.map((c) => c.close);
      const e20 = last(ema(c1, 20)), e50 = last(ema(c1, 50));
      const e50_4 = last(ema(c4, 50)), e200_4 = last(ema(c4, 200));
      const week = h1.slice(-168);
      const hi7 = Math.max(...week.map((c) => c.high)), lo7 = Math.min(...week.map((c) => c.low));
      const vols = h1.map((c) => c.volume);
      out.push({
        symbol: t.symbol, price: t.last, change24h: round(t.changePct, 2),
        change7d: round(((t.last - week[0].open) / week[0].open) * 100, 2),
        quoteVolumeM: round(t.quoteVolume / 1e6, 1),
        rsi1h: round(last(rsi(c1, 14)), 1), rsi4h: round(last(rsi(c4, 14)), 1),
        ema20vs50_1h: e20 > e50 ? "bullish" : "bearish",
        ema50vs200_4h: isNaN(e200_4) ? "n/a" : e50_4 > e200_4 ? "bullish" : "bearish",
        atrPct1h: round((last(atr(h1, 14)) / t.last) * 100, 2),
        volRatio1h: round(last(vols, 2) / (last(sma(vols, 24), 3) || 1), 2), // last closed candle vs prior 24h avg
        distHigh7d: round(((t.last - hi7) / hi7) * 100, 2), distLow7d: round(((t.last - lo7) / lo7) * 100, 2),
      });
    } catch (e) {
      log(`snapshot failed for ${t.symbol}: ${String(e).slice(0, 100)}`, { level: "warn" });
    }
  }
  return out;
}

const TOOL = {
  name: "submit_scan",
  description: "Submit the market scan result with concrete trade suggestions.",
  input_schema: {
    type: "object" as const,
    properties: {
      regime: { type: "string", enum: ["risk-on", "risk-off", "ranging", "mixed"] },
      summary: { type: "string", description: "3-5 sentence market overview a trader can read in 20 seconds." },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            side: { type: "string", enum: ["long", "avoid"] },
            entry: { type: "number" }, stopLoss: { type: "number" }, takeProfit: { type: "number" },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            timeframe: { type: "string", description: "e.g. 1h-4h swing, 15m scalp" },
            rationale: { type: "string", description: "2-3 sentences referencing the actual numbers." },
            riskReward: { type: "number" },
          },
          required: ["symbol", "side", "entry", "stopLoss", "takeProfit", "confidence", "timeframe", "rationale", "riskReward"],
        },
      },
    },
    required: ["regime", "summary", "suggestions"],
  },
};

export async function runScan(opts: { universe?: number } = {}) {
  const g = await getGlobal();
  const snap = await buildMarketSnapshot(opts.universe);
  if (!snap.length) throw new Error("No market data available");
  const open = (await openPositions()).map((p) => `${p.symbol} long @ ${p.entryPrice}`);
  const bots = (await listBots()).filter((b) => b.status === "running").map((b) => `${b.name} (${b.symbol}, ${b.strategy})`);

  const system = `You are a disciplined spot crypto analyst producing actionable, risk-managed trade ideas for a retail trader using ${exchangeId()} spot markets (long-only, no leverage).
Rules:
- Use ONLY the provided data. Do not invent news or prices.
- Prefer setups where trend (EMA alignment), momentum (RSI not extreme in the wrong direction) and volume agree. Flag overextended names as "avoid".
- Stops go below recent structure/ATR (roughly 1-2x ATR%), targets at least 1.5R. Entries near current price (limit within ~1%).
- Return 3-6 suggestions. Be honest about low-confidence conditions; a scan with 1-2 ideas and several "avoid" is fine.
- Confidence must reflect setup quality: >70 only when multiple factors align.`;
  const user = `Current UTC time: ${new Date().toISOString()}
Open positions: ${open.length ? open.join("; ") : "none"}
Running bots: ${bots.length ? bots.join("; ") : "none"}

Market snapshot (top ${snap.length} by 24h volume, quote ${g.quote}):
${JSON.stringify(snap)}

Analyse the snapshot and call submit_scan.`;

  const res = await callStructured<{ regime: string; summary: string; suggestions: Suggestion[] }>({ system, user, tool: TOOL, maxTokens: 4000 });
  const data = res.data, model = `${res.provider}/${res.model}`;

  const now = Date.now();
  const scan = await q<ScanRow>(sb.from("scans").insert({ createdAt: now, summary: data.summary, regime: data.regime, universe: snap.map((s) => s.symbol), model, inputTokens: res.inputTokens, outputTokens: res.outputTokens }).select().single());
  const validSymbols = new Set(snap.map((s) => s.symbol));
  const rows = data.suggestions.filter((s) => validSymbols.has(s.symbol)).map((s) => ({
    scanId: scan.id, symbol: s.symbol, side: s.side, entry: s.entry, stopLoss: s.stopLoss, takeProfit: s.takeProfit,
    confidence: Math.max(0, Math.min(100, Math.round(s.confidence))), timeframe: s.timeframe, rationale: s.rationale,
    riskReward: s.riskReward, status: "new", createdAt: now,
  }));
  if (rows.length) await q(sb.from("suggestions").insert(rows));
  log(`AI scan complete: ${data.regime}, ${rows.length} suggestions (${model}, ${res.inputTokens}+${res.outputTokens} tokens)`);
  return { scan, suggestions: rows };
}

// ---------- single-asset deep dive ----------
const ASSET_TOOL = {
  name: "submit_analysis",
  description: "Submit a structured deep-dive on one asset.",
  input_schema: {
    type: "object" as const,
    properties: {
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      thesis: { type: "string", description: "4-6 sentences: trend, momentum, volatility, key levels, and how the news flow fits." },
      keyLevels: { type: "object", properties: { support: { type: "array", items: { type: "number" } }, resistance: { type: "array", items: { type: "number" } } }, required: ["support", "resistance"] },
      risks: { type: "array", items: { type: "string" } },
      suggestion: {
        type: "object", description: "Only if a long setup exists; otherwise side=avoid.",
        properties: { side: { type: "string", enum: ["long", "avoid"] }, entry: { type: "number" }, stopLoss: { type: "number" }, takeProfit: { type: "number" }, confidence: { type: "integer" }, timeframe: { type: "string" }, rationale: { type: "string" }, riskReward: { type: "number" } },
        required: ["side", "entry", "stopLoss", "takeProfit", "confidence", "timeframe", "rationale", "riskReward"],
      },
    },
    required: ["bias", "thesis", "keyLevels", "risks", "suggestion"],
  },
};

export async function analyseAsset(symbol: string) {
  const { assetOverview } = await import("./asset");
  const { newsFor } = await import("./news");
  const [a, news] = await Promise.all([assetOverview(symbol), newsFor(symbol).catch(() => [])]);
  const res = await callStructured<{ bias: string; thesis: string; keyLevels: { support: number[]; resistance: number[] }; risks: string[]; suggestion: Suggestion }>({
    maxTokens: 2500,
    system: `You are a disciplined spot crypto analyst (long-only, no leverage) writing a deep-dive for one asset. Use ONLY the data provided. Reference concrete numbers. Headlines are context for sentiment/catalysts only; do not treat them as verified facts. Stops ~1-2x ATR below structure, targets >= 1.5R. If nothing is actionable, say so and set side=avoid.`,
    tool: ASSET_TOOL,
    user: `Asset: ${a.symbol} (${a.name}) price ${a.price}\nPerformance: ${JSON.stringify(a.perf)}\nIndicators: ${JSON.stringify(a.indicators)}\nMy open/closed positions here: ${a.positions.length}\nRecent headlines (newest first):\n${news.slice(0, 15).map((n) => `- [${n.source}] ${n.title}`).join("\n") || "none"}\n\nCall submit_analysis.`,
  });
  const data = res.data, model = `${res.provider}/${res.model}`;
  const now = Date.now();
  let suggestionRow = null;
  if (data.suggestion) {
    const s = data.suggestion;
    suggestionRow = await q(sb.from("suggestions").insert({ scanId: null, symbol, side: s.side, entry: s.entry, stopLoss: s.stopLoss, takeProfit: s.takeProfit, confidence: Math.max(0, Math.min(100, Math.round(s.confidence))), timeframe: s.timeframe, rationale: s.rationale, riskReward: s.riskReward, status: "new", createdAt: now }).select().single());
  }
  log(`AI deep-dive ${symbol}: ${data.bias} (${model}, ${res.inputTokens}+${res.outputTokens} tokens)`);
  return { ...data, suggestion: suggestionRow, model, tokens: res.inputTokens + res.outputTokens, createdAt: now };
}
