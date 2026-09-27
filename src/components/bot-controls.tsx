"use client";
import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { api, refresh } from "@/lib/client";

export function BotControls({ id, status, compact }: { id: number; status: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const act = async (a: string) => {
    if (a === "stop" && !confirm("Stop bot and close its open positions?")) return;
    setBusy(true);
    try { await api(`/api/bots/${id}/${a}`); await refresh("/api"); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  const sz = compact ? "btn btn-sm" : "btn";
  return (
    <div className="flex gap-1.5">
      {status !== "running" && <button className={`${sz} btn-up`} disabled={busy} onClick={() => act("start")} title="Start"><Play size={14} />{!compact && "Start"}</button>}
      {status === "running" && <button className={sz} disabled={busy} onClick={() => act("pause")} title="Pause (keeps positions)"><Pause size={14} />{!compact && "Pause"}</button>}
      {status !== "stopped" && <button className={`${sz} btn-danger`} disabled={busy} onClick={() => act("stop")} title="Stop & close positions"><Square size={14} />{!compact && "Stop"}</button>}
    </div>
  );
}
