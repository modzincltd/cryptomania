import { handle } from "@/lib/api";
import { computeEquity } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET() { return handle(async () => (await computeEquity("paper")).positions); }
