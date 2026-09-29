import { q, sb, type LogRow } from "@/lib/db";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return handle(() => q<LogRow[]>(sb.from("logs").select("*").order("ts", { ascending: false }).limit(Number(new URL(req.url).searchParams.get("limit") ?? 200)))); }
