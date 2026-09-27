import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
import { openPosition } from "@/lib/executor";
import { DEFAULT_RISK } from "@/lib/types";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const { id: rawId, action } = await params;
    const id = Number(rawId);
    const s = db.select().from(schema.suggestions).where(eq(schema.suggestions.id, id)).get();
    if (!s) throw new Error("Not found");
    const body = await req.json().catch(() => ({}));
    if (action === "dismiss") { db.update(schema.suggestions).set({ status: "dismissed" }).where(eq(schema.suggestions.id, id)).run(); return { ok: true }; }
    if (action === "execute") {
      const notional = Number(body.notionalUsd ?? 250);
      const pos = await openPosition({ symbol: s.symbol, pairId: s.pairId, notionalUsd: notional, mode: body.mode === "live" ? "live" : "paper", stopLoss: s.stopLoss, takeProfit: s.takeProfit, risk: s.pairId ? { trailingStopPct: 12 } : undefined, reason: `AI suggestion #${id} (${s.confidence}%)`, source: "ai" });
      db.update(schema.suggestions).set({ status: "executed" }).where(eq(schema.suggestions.id, id)).run();
      return pos;
    }
    if (action === "bot") {
      const slPct = Math.abs((s.entry - s.stopLoss) / s.entry) * 100, tpPct = Math.abs((s.takeProfit - s.entry) / s.entry) * 100;
      const bot = db.insert(schema.bots).values({
        name: `AI ${s.symbol.split("/")[0]} ${new Date().toISOString().slice(5, 10)}`, symbol: s.symbol, timeframe: "15m", intervalSec: s.pairId ? 30 : 60, pairId: s.pairId,
        strategy: s.pairId ? "dex_momentum" : "ema_cross", params: "{}", risk: JSON.stringify({ ...DEFAULT_RISK, stopLossPct: Math.round(slPct * 100) / 100, takeProfitPct: Math.round(tpPct * 100) / 100, ...(s.pairId ? { trailingStopPct: 12, maxPositionUsd: 250, cooldownSec: 600 } : {}) }),
        mode: "paper", status: "stopped", allocationUsd: Number(body.notionalUsd ?? 250), createdAt: Date.now(),
      }).returning().get();
      db.update(schema.suggestions).set({ status: "bot_created" }).where(eq(schema.suggestions.id, id)).run();
      return bot;
    }
    throw new Error("Unknown action");
  });
}
