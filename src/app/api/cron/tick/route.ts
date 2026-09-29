import { NextResponse } from "next/server";
import { engineLoop } from "@/engine/runner";
import { listBots } from "@/lib/bots";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Engine tick for serverless hosting. Vercel Cron calls this every minute with `Authorization: Bearer $CRON_SECRET`.
 * If any running bot wants 30s scans we do a second pass ~30s later within the same invocation.
 * An external pinger (cron-job.org etc.) can hit it more often with ?secret=$CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  if (secret && auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const started = Date.now();
  const passes: unknown[] = [];
  try {
    passes.push(await engineLoop());
    const wants30 = (await listBots()).some((b) => b.status === "running" && b.intervalSec <= 30);
    if (wants30 && url.searchParams.get("single") !== "1") {
      const wait = Math.max(0, 30_000 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      passes.push(await engineLoop());
    }
    return NextResponse.json({ ok: true, ms: Date.now() - started, passes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, passes }, { status: 500 });
  }
}
