import { handle } from "@/lib/api";
import { newsFor } from "@/lib/news";
import { slugToSym } from "@/lib/symbol";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  return handle(async () => newsFor(slugToSym((await params).symbol)));
}
