import { q, sb, type ScanRow, type TradeRow } from "@/lib/db";
import { handle } from "@/lib/api";
import { computeEquity, stats } from "@/lib/portfolio";
import { listBots } from "@/lib/bots";
import { engineStatus } from "@/lib/engine-status";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const [eq, st, bots, recentTrades, scans, engine] = await Promise.all([
      computeEquity("paper"), stats("paper"), listBots(),
      q<TradeRow[]>(sb.from("trades").select("*").order("createdAt", { ascending: false }).limit(10)),
      q<ScanRow[]>(sb.from("scans").select("*").order("createdAt", { ascending: false }).limit(1)),
      engineStatus(),
    ]);
    return { equity: eq, stats: st, bots, recentTrades, lastScan: scans[0] ?? null, engine };
  });
}
