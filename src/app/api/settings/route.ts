import { z } from "zod";
import { handle } from "@/lib/api";
import { getGlobal, getPaperCash, getSetting, setPaperCash, setSetting } from "@/lib/settings";
import { q, sb } from "@/lib/db";
import { engineStatus } from "@/lib/engine-status";
export const dynamic = "force-dynamic";
export async function GET() { return handle(async () => ({ global: await getGlobal(), paperCash: await getPaperCash(), paperStartCash: Number(await getSetting("paper_start_cash", 10000)), engine: await engineStatus() })); }
const Input = z.object({
  global: z.object({ maxOpenPositions: z.number().int().min(1), maxDailyLossUsd: z.number().min(0), quote: z.string(), universeSize: z.number().int().min(5).max(100), aiAutoScanMin: z.number().min(0), aiModel: z.string(), aiProvider: z.enum(["anthropic", "openai"]) }).partial().optional(),
  resetPaper: z.number().positive().optional(),
});
export async function PATCH(req: Request) {
  return handle(async () => {
    const i = Input.parse(await req.json());
    if (i.global) await setSetting("global", { ...(await getGlobal()), ...i.global });
    if (i.resetPaper) {
      await q(sb.from("positions").delete().gte("id", 0)); await q(sb.from("trades").delete().gte("id", 0)); await q(sb.from("equity_snapshots").delete().gte("id", 0));
      await setPaperCash(i.resetPaper); await setSetting("paper_start_cash", i.resetPaper);
    }
    return { global: await getGlobal(), paperCash: await getPaperCash() };
  });
}
