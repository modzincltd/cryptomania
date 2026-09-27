import { handle } from "@/lib/api";
import { equityHistory } from "@/lib/portfolio";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(() => {
    const hours = Number(new URL(req.url).searchParams.get("hours") ?? 24);
    return equityHistory("paper", Date.now() - hours * 3600_000);
  });
}
