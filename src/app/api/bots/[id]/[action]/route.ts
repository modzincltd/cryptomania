import { handle } from "@/lib/api";
import { getBot, setBotStatus } from "@/lib/bots";
import { closePosition, openPositions } from "@/lib/executor";
import { log } from "@/lib/log";
export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const { id: rawId, action } = await params;
    const id = Number(rawId);
    const bot = getBot(id); if (!bot) throw new Error("Not found");
    if (action === "start") { setBotStatus(id, "running"); log("Started", { botId: id }); }
    else if (action === "pause") { setBotStatus(id, "paused"); log("Paused (positions kept open, SL/TP still managed by engine)", { botId: id }); }
    else if (action === "stop") {
      setBotStatus(id, "stopped");
      for (const p of openPositions(id)) await closePosition(p.id, "Bot stopped");
      log("Stopped, positions closed", { botId: id });
    } else throw new Error("Unknown action");
    return getBot(id);
  });
}
