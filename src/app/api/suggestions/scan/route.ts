import { handle } from "@/lib/api";
import { runScan } from "@/lib/ai";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST() { return handle(() => runScan()); }
