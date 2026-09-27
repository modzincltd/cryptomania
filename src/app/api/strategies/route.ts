import { handle } from "@/lib/api";
import { STRATEGY_LIST } from "@/lib/strategies";
import { DEX_STRATEGY_LIST } from "@/lib/dex-strategies";
export async function GET(req: Request) { return handle(() => (new URL(req.url).searchParams.get("venue") === "dex" ? DEX_STRATEGY_LIST : STRATEGY_LIST)); }
