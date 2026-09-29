import { q, sb } from "@/lib/db";
import { handle } from "@/lib/api";
import { listBots } from "@/lib/bots";
import { DEFAULT_RISK } from "@/lib/types";
import { BotInput } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET() { return handle(() => listBots()); }
export async function POST(req: Request) {
  return handle(async () => {
    const b = BotInput.parse(await req.json());
    if (b.strategy.startsWith("dex_") !== !!b.pairId) throw new Error("DEX strategies need a pairId (and vice-versa)");
    if (b.pairId && b.mode === "live") throw new Error("Live DEX execution is not wired yet — paper only for now");
    if (b.mode === "live" && !(process.env.EXCHANGE_API_KEY && process.env.EXCHANGE_API_SECRET)) throw new Error("Live mode needs exchange API keys in .env");
    return q(sb.from("bots").insert({
      name: b.name, symbol: b.pairId ? b.symbol : b.symbol.toUpperCase(), timeframe: b.timeframe, intervalSec: b.intervalSec, strategy: b.strategy,
      params: b.params, risk: { ...DEFAULT_RISK, ...b.risk }, mode: b.mode, status: b.status ?? "stopped", allocationUsd: b.allocationUsd, pairId: b.pairId ?? null, createdAt: Date.now(),
    }).select().single());
  });
}
