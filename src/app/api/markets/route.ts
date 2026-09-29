import { handle } from "@/lib/api";
import { topSymbols } from "@/lib/exchange";
import { getGlobal } from "@/lib/settings";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(async () => {
    const n = Number(new URL(req.url).searchParams.get("n") ?? 50);
    return topSymbols((await getGlobal()).quote, n);
  });
}
