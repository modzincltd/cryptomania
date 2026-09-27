import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
import { listBots } from "@/lib/bots";
import { DEFAULT_RISK } from "@/lib/types";
import { BotInput } from "@/lib/validation";
export const dynamic = "force-dynamic";


export async function GET() { return handle(() => listBots()); }

export async function POST(req: Request) {
  return handle(async () => {
    const b = BotInput.parse(await req.json());
    if (b.mode === "live" && !(process.env.EXCHANGE_API_KEY && process.env.EXCHANGE_API_SECRET)) throw new Error("Live mode needs exchange API keys in .env");
    const row = db.insert(schema.bots).values({
      name: b.name, symbol: b.symbol.toUpperCase(), timeframe: b.timeframe, intervalSec: b.intervalSec, strategy: b.strategy,
      params: JSON.stringify(b.params), risk: JSON.stringify({ ...DEFAULT_RISK, ...b.risk }), mode: b.mode,
      status: b.status ?? "stopped", allocationUsd: b.allocationUsd, createdAt: Date.now(),
    }).returning().get();
    return row;
  });
}
