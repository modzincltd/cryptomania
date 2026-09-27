import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(async () => {
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 200);
    const closed = db.select().from(schema.positions).orderBy(desc(schema.positions.entryAt)).limit(limit).all();
    const fills = db.select().from(schema.trades).orderBy(desc(schema.trades.createdAt)).limit(limit).all();
    return { positions: await withLivePnl(closed), fills };
  });
}
