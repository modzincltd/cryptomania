import type { Suggestion } from "./types";

/** Models occasionally omit or mistype fields; never let that turn into a NOT NULL violation. */
export function normalizeScan<T extends { regime?: unknown; summary?: unknown; suggestions?: unknown }>(d: T): T & { regime: string; summary: string; suggestions: Suggestion[] } {
  const regime = typeof d.regime === "string" && d.regime ? d.regime : "mixed";
  const summary = typeof d.summary === "string" && d.summary.trim() ? d.summary : "No summary returned by the model.";
  const raw = Array.isArray(d.suggestions) ? d.suggestions : [];
  const suggestions = raw
    .filter((s) => s && typeof s === "object" && typeof (s as { symbol?: unknown }).symbol === "string")
    .map((s) => {
      const x = s as Record<string, unknown>;
      return {
        ...x, symbol: String(x.symbol), side: x.side === "avoid" ? "avoid" : "long",
        entry: Number(x.entry) || 0, stopLoss: Number(x.stopLoss) || 0, takeProfit: Number(x.takeProfit) || 0,
        confidence: Number(x.confidence) || 0, timeframe: String(x.timeframe ?? ""), rationale: String(x.rationale ?? ""), riskReward: Number(x.riskReward) || 0,
      } as Suggestion;
    });
  return { ...d, regime, summary, suggestions };
}
