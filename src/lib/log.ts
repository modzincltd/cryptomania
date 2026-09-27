import { db, schema } from "./db";

export function log(message: string, opts: { level?: "info" | "warn" | "error" | "trade"; botId?: number | null } = {}) {
  const ts = Date.now();
  try {
    db.insert(schema.logs).values({ ts, level: opts.level ?? "info", botId: opts.botId ?? null, message }).run();
  } catch { /* ignore */ }
  const tag = opts.botId ? `[bot ${opts.botId}]` : "[engine]";
  const line = `${new Date(ts).toISOString()} ${tag} ${message}`;
  if (opts.level === "error") console.error(line); else console.log(line);
}
