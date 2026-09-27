import { z } from "zod";
import { handle } from "@/lib/api";
import { getGlobal, getPaperCash, getSetting, setPaperCash, setSetting } from "@/lib/settings";
import { db, schema } from "@/lib/db";
import { engineStatus } from "@/lib/engine-status";
export const dynamic = "force-dynamic";

export async function GET() { return handle(() => ({ global: getGlobal(), paperCash: getPaperCash(), paperStartCash: getSetting("paper_start_cash", 10000), engine: engineStatus() })); }

const Input = z.object({
  global: z.object({ maxOpenPositions: z.number().int().min(1), maxDailyLossUsd: z.number().min(0), quote: z.string(), universeSize: z.number().int().min(5).max(100), aiAutoScanMin: z.number().min(0), aiModel: z.string(), aiProvider: z.enum(["anthropic", "openai"]) }).partial().optional(),
  resetPaper: z.number().positive().optional(),
});
export async function PATCH(req: Request) {
  return handle(async () => {
    const i = Input.parse(await req.json());
    if (i.global) setSetting("global", { ...getGlobal(), ...i.global });
    if (i.resetPaper) {
      db.delete(schema.positions).run(); db.delete(schema.trades).run(); db.delete(schema.equitySnapshots).run();
      setPaperCash(i.resetPaper); setSetting("paper_start_cash", i.resetPaper);
    }
    return { global: getGlobal(), paperCash: getPaperCash() };
  });
}
