"use client";
import useSWR, { mutate as globalMutate } from "swr";
export const fetcher = async (url: string) => {
  const r = await fetch(url); const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
export function useApi<T>(url: string | null, refreshMs = 15000) {
  return useSWR<T>(url, fetcher, { refreshInterval: refreshMs, revalidateOnFocus: true });
}
export async function api<T = unknown>(url: string, method = "POST", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j as T;
}
export const refresh = (prefix: string) => globalMutate((k) => typeof k === "string" && k.startsWith(prefix));
