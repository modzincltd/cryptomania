import { z } from "zod";
import { handle } from "@/lib/api";
import { openPosition } from "@/lib/executor";
export const dynamic = "force-dynamic";
const Input = z.object({ symbol: z.string(), notionalUsd: z.number().positive(), mode: z.enum(["paper", "live"]).default("paper"), stopLossPct: z.number().min(0).optional(), takeProfitPct: z.number().min(0).optional(), trailingStopPct: z.number().min(0).optional(), pairId: z.string().optional() });
export async function POST(req: Request) {
  return handle(async () => {
    const i = Input.parse(await req.json());
    return openPosition({ symbol: i.pairId ? i.symbol : i.symbol.toUpperCase(), pairId: i.pairId, notionalUsd: i.notionalUsd, mode: i.mode, risk: { stopLossPct: i.stopLossPct, takeProfitPct: i.takeProfitPct, trailingStopPct: i.trailingStopPct }, reason: "Manual buy", source: "manual" });
  });
}
