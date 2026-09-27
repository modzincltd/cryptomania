import { handle } from "@/lib/api";
import { STRATEGY_LIST } from "@/lib/strategies";
export async function GET() { return handle(() => STRATEGY_LIST); }
