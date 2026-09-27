import { desc, eq } from "drizzle-orm";
import { db, schema, sqlite } from "@/lib/db";
import { handle } from "@/lib/api";
import { dexPair } from "@/lib/dex";
import { listBots } from "@/lib/bots";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ chain: string; pair: string }> }) {
  return handle(async () => {
    const { chain, pair } = await params; const pairId = `${chain}:${pair}`;
    const p = await dexPair(pairId, 5_000);
    const positions = await withLivePnl(db.select().from(schema.positions).where(eq(schema.positions.pairId, pairId)).orderBy(desc(schema.positions.entryAt)).limit(50).all());
    const suggestions = db.select().from(schema.suggestions).where(eq(schema.suggestions.pairId, pairId)).orderBy(desc(schema.suggestions.createdAt)).limit(20).all();
    const bots = listBots().filter((b) => b.pairId === pairId);
    const ticks = sqlite.prepare("SELECT ts, price, liq FROM dex_ticks WHERE pair_id = ? AND ts > ? ORDER BY ts").all(pairId, Date.now() - 24 * 3600_000) as { ts: number; price: number; liq: number }[];
    return { pair: p, positions, suggestions, bots, ticks, embedUrl: `https://dexscreener.com/${chain}/${pair}?embed=1&theme=dark&trades=0&info=0` };
  });
}
