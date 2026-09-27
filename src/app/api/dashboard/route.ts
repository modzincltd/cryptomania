import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
import { computeEquity, stats } from "@/lib/portfolio";
import { listBots } from "@/lib/bots";
import { engineStatus } from "@/lib/engine-status";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const [eq, st] = [await computeEquity("paper"), stats("paper")];
    const bots = listBots();
    const recentTrades = db.select().from(schema.trades).orderBy(desc(schema.trades.createdAt)).limit(10).all();
    const lastScan = db.select().from(schema.scans).orderBy(desc(schema.scans.createdAt)).limit(1).get() ?? null;
    return { equity: eq, stats: st, bots, recentTrades, lastScan, engine: engineStatus() };
  });
}
