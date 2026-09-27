import { z } from "zod";
import { handle } from "@/lib/api";
import { getDexFilters } from "@/lib/dex";
import { setSetting } from "@/lib/settings";
export const dynamic = "force-dynamic";
const Input = z.object({ chains: z.array(z.string()).min(1), minLiqUsd: z.number().min(0), minAgeMin: z.number().min(0), minVol24h: z.number().min(0), maxAgeDays: z.number().min(0) }).partial();
export async function GET() { return handle(() => getDexFilters()); }
export async function PATCH(req: Request) { return handle(async () => { setSetting("dex_filters", { ...getDexFilters(), ...Input.parse(await req.json()) }); return getDexFilters(); }); }
