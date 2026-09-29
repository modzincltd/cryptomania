import { q, sb, type LogRow, type PositionRow } from "@/lib/db";
import { handle } from "@/lib/api";
import { getBot, updateBot } from "@/lib/bots";
import { BotInput } from "@/lib/validation";
import { openPositions } from "@/lib/executor";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    const bot = await getBot(id); if (!bot) throw new Error("Not found");
    const [positions, logs] = await Promise.all([
      q<PositionRow[]>(sb.from("positions").select("*").eq("botId", id).order("entryAt", { ascending: false }).limit(50)),
      q<LogRow[]>(sb.from("logs").select("*").eq("botId", id).order("ts", { ascending: false }).limit(100)),
    ]);
    return { bot, positions: await withLivePnl(positions), logs };
  });
}
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    const b = BotInput.partial().parse(await req.json());
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "symbol", "timeframe", "intervalSec", "strategy", "mode", "allocationUsd", "status", "params"] as const) if (b[k] !== undefined) patch[k] = b[k];
    if (b.symbol && !b.pairId) patch.symbol = b.symbol.toUpperCase();
    if (b.risk) { const cur = (await getBot(id))?.risk ?? {}; patch.risk = { ...cur, ...b.risk }; }
    await updateBot(id, patch);
    return getBot(id);
  });
}
export async function DELETE(_: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    if ((await openPositions(id)).length) throw new Error("Close the bot's open positions first");
    await q(sb.from("bots").delete().eq("id", id));
    return { ok: true };
  });
}
