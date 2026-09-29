import { handle } from "@/lib/api";
import { dexNew, dexPrices, dexSearch, dexTrending } from "@/lib/dex";
import { getFavourites } from "@/lib/favourites";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url); const tab = u.searchParams.get("tab") ?? "trending"; const q = u.searchParams.get("q") ?? "";
    if (tab === "search") return q.trim().length >= 2 ? dexSearch(q.trim()) : [];
    if (tab === "new") return dexNew();
    if (tab === "favourites") { const ids = (await getFavourites()).filter((f) => f.includes(":")); return Object.values(await dexPrices(ids)); }
    return dexTrending();
  });
}
