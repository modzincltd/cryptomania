import { q, sb, type PositionRow, type TradeRow } from "@/lib/db";
import { handle } from "@/lib/api";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(async () => {
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 200);
    const [positions, fills] = await Promise.all([
      q<PositionRow[]>(sb.from("positions").select("*").order("entryAt", { ascending: false }).limit(limit)),
      q<TradeRow[]>(sb.from("trades").select("*").order("createdAt", { ascending: false }).limit(limit)),
    ]);
    return { positions: await withLivePnl(positions), fills };
  });
}
