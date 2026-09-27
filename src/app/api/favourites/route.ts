import { z } from "zod";
import { handle } from "@/lib/api";
import { getFavourites, toggleFavourite } from "@/lib/favourites";
export const dynamic = "force-dynamic";
export async function GET() { return handle(() => getFavourites()); }
export async function POST(req: Request) {
  return handle(async () => { const { symbol } = z.object({ symbol: z.string().min(3) }).parse(await req.json()); return toggleFavourite(symbol); });
}
