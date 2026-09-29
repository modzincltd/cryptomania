import { q, sb, type ScanRow, type SuggestionRow } from "@/lib/db";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const [scans, suggestions] = await Promise.all([
      q<ScanRow[]>(sb.from("scans").select("*").order("createdAt", { ascending: false }).limit(10)),
      q<SuggestionRow[]>(sb.from("suggestions").select("*").order("createdAt", { ascending: false }).limit(100)),
    ]);
    return { scans, suggestions };
  });
}
