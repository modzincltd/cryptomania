import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
import { getBot } from "@/lib/bots";
import { BotInput } from "@/lib/validation";
import { openPositions } from "@/lib/executor";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    const bot = getBot(id); if (!bot) throw new Error("Not found");
    const positions = db.select().from(schema.positions).where(eq(schema.positions.botId, id)).all().sort((a, b) => b.entryAt - a.entryAt).slice(0, 50);
    const logs = db.select().from(schema.logs).where(eq(schema.logs.botId, id)).all().sort((a, b) => b.ts - a.ts).slice(0, 100);
    return { bot, positions: await withLivePnl(positions), logs };
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    const b = BotInput.partial().parse(await req.json());
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "symbol", "timeframe", "intervalSec", "strategy", "mode", "allocationUsd", "status"] as const) if (b[k] !== undefined) patch[k] = b[k];
    if (b.symbol) patch.symbol = b.symbol.toUpperCase();
    if (b.params) patch.params = JSON.stringify(b.params);
    if (b.risk) { const cur = getBot(id)?.risk ?? {}; patch.risk = JSON.stringify({ ...cur, ...b.risk }); }
    db.update(schema.bots).set(patch).where(eq(schema.bots.id, id)).run();
    return getBot(id);
  });
}

export async function DELETE(_: Request, { params }: Ctx) {
  return handle(async () => {
    const id = Number((await params).id);
    if (openPositions(id).length) throw new Error("Close the bot's open positions first");
    db.delete(schema.bots).where(eq(schema.bots.id, id)).run();
    return { ok: true };
  });
}
