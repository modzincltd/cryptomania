import { handle } from "@/lib/api";
import { assetOverview } from "@/lib/asset";
import { slugToSym } from "@/lib/symbol";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  return handle(async () => assetOverview(slugToSym((await params).symbol)));
}
