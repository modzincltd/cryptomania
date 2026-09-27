"use client";
import { useEffect, useState } from "react";
import { api, refresh, useApi } from "@/lib/client";
import { Card, PageHeader } from "@/components/ui";
import { fmtUsd } from "@/lib/format";

interface S { global: { maxOpenPositions: number; maxDailyLossUsd: number; quote: string; universeSize: number; aiAutoScanMin: number; aiModel: string }; paperCash: number; paperStartCash: number; engine: { exchange: string; liveKeys: boolean; aiKey: boolean; online: boolean; startedAt: number | null; ticks: number } }

export default function Settings() {
  const { data, mutate } = useApi<S>("/api/settings", 0);
  const [g, setG] = useState<S["global"] | null>(null);
  const [reset, setReset] = useState(10000);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (data && !g) setG(data.global); }, [data, g]);
  if (!data || !g) return <div className="text-muted text-sm">Loading…</div>;
  const save = async () => { try { await api("/api/settings", "PATCH", { global: g }); await mutate(); setMsg("Saved"); setTimeout(() => setMsg(null), 1500); } catch (e) { alert((e as Error).message); } };
  const doReset = async () => { if (!confirm(`Wipe all paper positions/trades and reset cash to $${reset}?`)) return; await api("/api/settings", "PATCH", { resetPaper: reset }); await mutate(); await refresh("/api"); };
  const num = (label: string, k: keyof S["global"], hint?: string) => (
    <label className="block"><span className="label">{label}</span><input type="number" className="input num" value={g[k] as number} onChange={(e) => setG({ ...g, [k]: Number(e.target.value) })} />{hint && <span className="text-[11px] text-muted">{hint}</span>}</label>
  );
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Global risk (applies across all bots + manual trades)">
          <div className="p-4 grid grid-cols-2 gap-3">
            {num("Max open positions", "maxOpenPositions", "across everything")}
            {num("Max daily loss $", "maxDailyLossUsd", "blocks all new entries when hit")}
          </div>
        </Card>
        <Card title="AI scanner">
          <div className="p-4 grid grid-cols-2 gap-3">
            {num("Universe size", "universeSize", "top N pairs by volume (5–100)")}
            {num("Auto-scan every (min)", "aiAutoScanMin", "0 = manual only · engine runs it")}
            <label className="block col-span-2"><span className="label">Model</span><input className="input" value={g.aiModel} onChange={(e) => setG({ ...g, aiModel: e.target.value })} /></label>
          </div>
        </Card>
        <Card title="Market data">
          <div className="p-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Quote currency</span><input className="input" value={g.quote} onChange={(e) => setG({ ...g, quote: e.target.value.toUpperCase() })} /></label>
            <div className="text-sm space-y-1 pt-5 text-muted">
              <div>Exchange: <span className="text-text">{data.engine.exchange}</span> <span className="text-[11px]">(EXCHANGE in .env)</span></div>
              <div>Live keys: <span className={data.engine.liveKeys ? "text-warn" : "text-text"}>{data.engine.liveKeys ? "configured" : "not set"}</span></div>
              <div>Anthropic key: <span className="text-text">{data.engine.aiKey ? "configured" : "not set"}</span></div>
            </div>
          </div>
        </Card>
        <Card title="Paper account">
          <div className="p-4 space-y-3 text-sm">
            <div>Cash <span className="num">{fmtUsd(data.paperCash)}</span> · started with <span className="num">{fmtUsd(data.paperStartCash)}</span></div>
            <div className="flex gap-2 items-end">
              <label className="block flex-1"><span className="label">Reset to $</span><input type="number" className="input num" value={reset} onChange={(e) => setReset(Number(e.target.value))} /></label>
              <button className="btn btn-danger" onClick={doReset}>Reset paper account</button>
            </div>
            <p className="text-xs text-muted">Deletes all positions, fills and equity history. Bots are kept.</p>
          </div>
        </Card>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="btn btn-primary" onClick={save}>Save settings</button>{msg && <span className="text-sm text-up">{msg}</span>}</div>
    </>
  );
}
