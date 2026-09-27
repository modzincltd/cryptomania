import { handle } from "@/lib/api";
import { analyseDexPair } from "@/lib/ai-dex";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(_: Request, { params }: { params: Promise<{ chain: string; pair: string }> }) {
  return handle(async () => { const { chain, pair } = await params; return analyseDexPair(`${chain}:${pair}`); });
}
