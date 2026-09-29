import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON || "";

declare global {
  // eslint-disable-next-line no-var
  var __cm_sb: SupabaseClient | undefined;
}

function make(): SupabaseClient {
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ROLE must be set in .env");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } });
}
// Lazy: don't touch env at import time (build-time page collection imports these modules without env).
export const sb: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) { if (!globalThis.__cm_sb) globalThis.__cm_sb = make(); const c = globalThis.__cm_sb; const v = (c as unknown as Record<PropertyKey, unknown>)[prop]; return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v; },
});

/** Unwrap a supabase query; throw on error. */
export async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
export async function one<T>(p: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T | null> {
  const { data, error } = await p;
  if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message); }
  return data;
}
export * from "./types";
