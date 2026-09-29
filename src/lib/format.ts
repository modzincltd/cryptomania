export const fmtUsd = (v: number | null | undefined, dp?: number) => { if (v == null || isNaN(v)) return "—"; const max = dp ?? (Math.abs(v) < 10 ? 4 : 2); return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: max, minimumFractionDigits: Math.min(2, max) }).format(v); };
export const fmtPrice = (v: number | null | undefined) => v == null ? "—" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v >= 1 ? v.toFixed(4) : v.toPrecision(4);
export const fmtPct = (v: number | null | undefined, dp = 2) => v == null || isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
export const fmtQty = (v: number) => v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toPrecision(4);
export const fmtTime = (ts: number | null | undefined) => ts ? new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtAgo = (ts: number | null | undefined) => {
  if (!ts) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.round(s / 60)}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`;
};
export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
export const pnlClass = (v: number | null | undefined) => v == null ? "" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
/** lastSignal may arrive as a JSON string (old SQLite rows) or an object (Postgres jsonb). */
export function parseSignal<T = { action: string; reason: string; indicators: Record<string, unknown>; price: number }>(v: unknown): T | null {
  if (!v) return null;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return null; } }
  return v as T;
}
