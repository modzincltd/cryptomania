import { handle } from "@/lib/api";
import { analyseAsset } from "@/lib/ai";
import { slugToSym } from "@/lib/symbol";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  return handle(async () => analyseAsset(slugToSym((await params).symbol)));
}
