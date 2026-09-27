import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) { return NextResponse.json(data, init); }
export function fail(e: unknown, status = 400) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status });
}
export async function handle(fn: () => Promise<unknown> | unknown) {
  try { return ok(await fn()); } catch (e) { console.error(e); return fail(e); }
}
