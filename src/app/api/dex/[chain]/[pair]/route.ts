import { q, sb, type DexTickRow, type PositionRow, type SuggestionRow } from "@/lib/db";
import { handle } from "@/lib/api";
import { dexPair } from "@/lib/dex";
import { listBots } from "@/lib/bots";
import { withLivePnl } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ chain: string; pair: string }> }) {
  return handle(async () => {
    const { chain, pair } = await params; const pairId = `${chain}:${pair}`;
    const [p, positions, suggestions, bots, ticks] = await Promise.all([
      dexPair(pairId, 5_000),
      q<PositionRow[]>(sb.from("positions").select("*").eq("pairId", pairId).order("entryAt", { ascending: false }).limit(50)),
      q<SuggestionRow[]>(sb.from("suggestions").select("*").eq("pairId", pairId).order("createdAt", { ascending: false }).limit(20)),
      listBots(), q<Pick<DexTickRow, "ts" | "price" | "liq">[]>(sb.from("dex_ticks").select("ts, price, liq").eq("pairId", pairId).gt("ts", Date.now() - 24 * 3600_000).order("ts").limit(5000)),
    ]);
    return { pair: p, positions: await withLivePnl(positions), suggestions, bots: bots.filter((b) => b.pairId === pairId), ticks, embedUrl: `https://dexscreener.com/${chain}/${pair}?embed=1&theme=dark&trades=0&info=0` };
  });
}
