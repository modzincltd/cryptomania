"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api, refresh, useApi } from "@/lib/client";
import { Card, Empty, PageHeader, StatusPill } from "@/components/ui";
import { fmtPrice, fmtTime, cls } from "@/lib/format";

interface Sug { id: number; scanId: number; symbol: string; side: string; entry: number; stopLoss: number; takeProfit: number; confidence: number; timeframe: string; rationale: string; riskReward: number | null; status: string; createdAt: number }
interface Scan { id: number; createdAt: number; summary: string; regime: string; model: string; inputTokens: number; outputTokens: number }

export default function AiPage() {
  const { data, mutate } = useApi<{ scans: Scan[]; suggestions: Sug[] }>("/api/suggestions", 30000);
  const { data: engine } = useApi<{ aiKey: boolean }>("/api/engine", 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [size, setSize] = useState(250);
  const [showOld, setShowOld] = useState(false);

  const scan = async () => {
    setBusy(true); setErr(null);
    try { await api("/api/suggestions/scan"); await mutate(); await refresh("/api/dashboard"); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const act = async (id: number, action: string) => {
    try { await api(`/api/suggestions/${id}/${action}`, "POST", { notionalUsd: size }); await mutate(); await refresh("/api"); if (action === "bot") alert("Bot created (stopped). Review it under Bots and start it."); } catch (e) { alert((e as Error).message); }
  };

  const latest = data?.scans[0];
  const list = (data?.suggestions ?? []).filter((s) => showOld || (latest && s.scanId === latest.id));

  return (
    <>
      <PageHeader title="AI Scanner" sub="Claude reads live indicators for the top markets and proposes risk-managed trades. You decide.">
        <label className="text-xs text-muted flex items-center gap-2">Size $<input type="number" className="input num !w-24" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
        <button className="btn btn-primary" onClick={scan} disabled={busy || !engine?.aiKey}><Sparkles size={15} /> {busy ? "Scanning… (~30s)" : "Scan market now"}</button>
      </PageHeader>
      {engine && !engine.aiKey && <div className="card p-3 mb-4 text-sm text-warn">Add <code className="num">ANTHROPIC_API_KEY</code> to <code>.env</code> and restart to enable scans.</div>}
      {err && <div className="card p-3 mb-4 text-sm text-down">{err}</div>}

      {latest && (
        <Card title="Market read" right={<span className="text-xs text-muted">{fmtTime(latest.createdAt)} · {latest.model} · {latest.inputTokens + latest.outputTokens} tokens</span>} className="mb-4">
          <div className="p-4 text-sm flex gap-4 items-start">
            <span className={cls("pill shrink-0", latest.regime === "risk-on" ? "pill-up" : latest.regime === "risk-off" ? "pill-down" : "pill-warn")}>{latest.regime}</span>
            <p className="text-muted leading-relaxed">{latest.summary}</p>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium">Suggestions {latest && !showOld && <span className="text-muted">from latest scan</span>}</h2>
        <button className="text-xs text-accent" onClick={() => setShowOld(!showOld)}>{showOld ? "Latest only" : "Show history"}</button>
      </div>
      {!list.length ? <Card><Empty>{data ? "No suggestions yet. Run a scan." : "Loading…"}</Empty></Card> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((s) => {
            const sl = ((s.stopLoss - s.entry) / s.entry) * 100, tp = ((s.takeProfit - s.entry) / s.entry) * 100;
            return (
              <div key={s.id} className={cls("card p-4 flex flex-col gap-3", s.status !== "new" && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.symbol}</span><StatusPill status={s.side} />
                  <span className="ml-auto text-xs text-muted">{s.timeframe}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded bg-panel-2 overflow-hidden"><div className={cls("h-full", s.confidence >= 70 ? "bg-up" : s.confidence >= 50 ? "bg-warn" : "bg-down")} style={{ width: `${s.confidence}%` }} /></div>
                  <span className="num text-sm">{s.confidence}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted">Entry</div><div className="num">{fmtPrice(s.entry)}</div></div>
                  <div><div className="text-muted">Stop</div><div className="num text-down">{fmtPrice(s.stopLoss)} <span className="text-[10px]">({sl.toFixed(1)}%)</span></div></div>
                  <div><div className="text-muted">Target</div><div className="num text-up">{fmtPrice(s.takeProfit)} <span className="text-[10px]">(+{tp.toFixed(1)}%)</span></div></div>
                </div>
                <p className="text-xs text-muted leading-relaxed">{s.rationale}</p>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  <span className="text-[11px] text-muted">R:R {s.riskReward?.toFixed(1) ?? "—"}</span>
                  <div className="ml-auto flex gap-1.5">
                    {s.status === "new" ? (<>
                      <button className="btn btn-sm" onClick={() => act(s.id, "dismiss")}>Dismiss</button>
                      {s.side === "long" && <button className="btn btn-sm" onClick={() => act(s.id, "bot")}>→ Bot</button>}
                      {s.side === "long" && <button className="btn btn-sm btn-up" onClick={() => act(s.id, "execute")}>Buy ${size}</button>}
                    </>) : <StatusPill status={s.status} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
