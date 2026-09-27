import { handle } from "@/lib/api";
import { engineStatus } from "@/lib/engine-status";
export const dynamic = "force-dynamic";
export async function GET() { return handle(() => engineStatus()); }
