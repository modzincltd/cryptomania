import { sb } from "./db";

export function log(message: string, opts: { level?: "info" | "warn" | "error" | "trade"; botId?: number | null } = {}) {
  const ts = Date.now();
  sb.from("logs").insert({ ts, level: opts.level ?? "info", botId: opts.botId ?? null, message }).then(({ error }) => { if (error) console.error("log insert failed", error.message); });
  const line = `${new Date(ts).toISOString()} ${opts.botId ? `[bot ${opts.botId}]` : "[engine]"} ${message}`;
  if (opts.level === "error") console.error(line); else console.log(line);
}
