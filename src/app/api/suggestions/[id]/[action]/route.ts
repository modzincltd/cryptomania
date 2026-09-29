import { one, q, sb, type SuggestionRow } from "@/lib/db";
import { handle } from "@/lib/api";
import { openPosition } from "@/lib/executor";
import { DEFAULT_RISK } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const { id: rawId, action } = await params; const id = Number(rawId);
    const s = await one<SuggestionRow>(sb.from("suggestions").select("*").eq("id", id).single());
    if (!s) throw new Error("Not found");
    const body = await req.json().catch(() => ({}));
    const setStatus = (status: string) => q(sb.from("suggestions").update({ status }).eq("id", id));
    if (action === "dismiss") { await setStatus("dismissed"); return { ok: true }; }
    if (action === "execute") {
      const pos = await openPosition({ symbol: s.symbol, pairId: s.pairId, notionalUsd: Number(body.notionalUsd ?? 250), mode: body.mode === "live" ? "live" : "paper", stopLoss: s.stopLoss, takeProfit: s.takeProfit, risk: s.pairId ? { trailingStopPct: 12 } : undefined, reason: `AI suggestion #${id} (${s.confidence}%)`, source: "ai" });
      await setStatus("executed"); return pos;
    }
    if (action === "bot") {
      const slPct = Math.abs((s.entry - s.stopLoss) / s.entry) * 100, tpPct = Math.abs((s.takeProfit - s.entry) / s.entry) * 100;
      const bot = await q(sb.from("bots").insert({
        name: `AI ${s.symbol.split("/")[0]} ${new Date().toISOString().slice(5, 10)}`, symbol: s.symbol, timeframe: "15m", intervalSec: s.pairId ? 30 : 60, pairId: s.pairId,
        strategy: s.pairId ? "dex_momentum" : "ema_cross", params: {}, risk: { ...DEFAULT_RISK, stopLossPct: Math.round(slPct * 100) / 100, takeProfitPct: Math.round(tpPct * 100) / 100, ...(s.pairId ? { trailingStopPct: 12, maxPositionUsd: 250, cooldownSec: 600 } : {}) },
        mode: "paper", status: "stopped", allocationUsd: Number(body.notionalUsd ?? 250), createdAt: Date.now(),
      }).select().single());
      await setStatus("bot_created"); return bot;
    }
    throw new Error("Unknown action");
  });
}
