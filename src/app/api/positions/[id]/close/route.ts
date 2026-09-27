import { handle } from "@/lib/api";
import { closePosition } from "@/lib/executor";
export const dynamic = "force-dynamic";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => closePosition(Number((await params).id), "Manual close"));
}
