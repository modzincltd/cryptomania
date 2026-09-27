import { handle } from "@/lib/api";
import { runDexScan } from "@/lib/ai-dex";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST() { return handle(() => runDexScan()); }
