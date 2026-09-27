"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, refresh, useApi } from "@/lib/client";
import { Card } from "./ui";
import type { BotFormValues } from "./bot-form";

interface StrategyMeta { id: string; name: string; description: string; defaultParams: Record<string, number>; paramLabels: Record<string, string> }
const DEX_RISK = { stopLossPct: 15, takeProfitPct: 40, trailingStopPct: 12, maxPositionUsd: 250, maxDailyLossUsd: 150, cooldownSec: 600, maxOpenPositions: 1 };

export function DexBotForm({ pairId, symbol, botId, initial, onDone }: { pairId: string; symbol: string; botId?: number; initial?: Partial<BotFormValues>; onDone?: () => void }) {
  const router = useRouter();
  const { data: strategies } = useApi<StrategyMeta[]>("/api/strategies?venue=dex", 0);
  const [v, setV] = useState({ name: initial?.name ?? "", strategy: initial?.strategy ?? "dex_momentum", intervalSec: initial?.intervalSec ?? 30, allocationUsd: initial?.allocationUsd ?? 100, params: initial?.params ?? {} as Record<string, number>, risk: { ...DEX_RISK, ...(initial?.risk ?? {}) } });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const strat = strategies?.find((s) => s.id === v.strategy);
  const params = Object.keys(v.params).length ? v.params : { ...(strat?.defaultParams ?? {}) };
  const num = (label: string, value: number, on: (n: number) => void, step = 1) => <label className="block"><span className="label">{label}</span><input type="number" step={step} className="input num" value={value} onChange={(e) => on(Number(e.target.value))} /></label>;
  const submit = async (start: boolean) => {
    setBusy(true); setErr(null);
    try {
      const body = { ...v, params, symbol, pairId, timeframe: "5m", mode: "paper", name: v.name || `${symbol.split("/")[0]} ${strat?.name ?? "DEX"}`, ...(start ? { status: "running" } : {}) };
      if (botId) await api(`/api/bots/${botId}`, "PATCH", body); else await api("/api/bots", "POST", body);
      await refresh("/api"); if (onDone) onDone(); else router.push("/bots");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card title={`${botId ? "Edit" : "New"} DEX bot · ${symbol}`}>
      <div className="p-4 space-y-4 text-sm">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block"><span className="label">Name</span><input className="input" placeholder="auto" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="block"><span className="label">Scan interval</span><select className="input" value={v.intervalSec} onChange={(e) => setV({ ...v, intervalSec: Number(e.target.value) })}><option value={30}>Every 30s</option><option value={60}>Every 1m</option><option value={300}>Every 5m</option></select></label>
          {num("Allocation $", v.allocationUsd, (n) => setV({ ...v, allocationUsd: n }))}
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {strategies?.map((s) => <button key={s.id} type="button" onClick={() => setV({ ...v, strategy: s.id, params: { ...s.defaultParams } })} className={`text-left rounded-xl border p-3 transition ${v.strategy === s.id ? "border-accent bg-panel-2" : "border-border hover:border-muted"}`}><div className="font-medium">{s.name}</div><div className="text-xs text-muted mt-1 leading-snug">{s.description}</div></button>)}
        </div>
        {strat && <div className="grid md:grid-cols-5 gap-3">{Object.keys(strat.defaultParams).map((k) => num(strat.paramLabels[k] ?? k, params[k] ?? strat.defaultParams[k], (n) => setV({ ...v, params: { ...params, [k]: n } }), 0.05))}</div>}
        <div>
          <div className="label mb-2">Risk (DEX defaults are wide — these things move 20% in minutes)</div>
          <div className="grid md:grid-cols-7 gap-3">
            {num("Stop %", v.risk.stopLossPct, (n) => setV({ ...v, risk: { ...v.risk, stopLossPct: n } }), 0.5)}
            {num("Target %", v.risk.takeProfitPct, (n) => setV({ ...v, risk: { ...v.risk, takeProfitPct: n } }), 0.5)}
            {num("Trailing %", v.risk.trailingStopPct, (n) => setV({ ...v, risk: { ...v.risk, trailingStopPct: n } }), 0.5)}
            {num("Max pos $", v.risk.maxPositionUsd, (n) => setV({ ...v, risk: { ...v.risk, maxPositionUsd: n } }))}
            {num("Max daily loss $", v.risk.maxDailyLossUsd, (n) => setV({ ...v, risk: { ...v.risk, maxDailyLossUsd: n } }))}
            {num("Cooldown s", v.risk.cooldownSec, (n) => setV({ ...v, risk: { ...v.risk, cooldownSec: n } }))}
            {num("Max open", v.risk.maxOpenPositions, (n) => setV({ ...v, risk: { ...v.risk, maxOpenPositions: n } }))}
          </div>
          <p className="text-xs text-muted mt-2">Also always on: rug guard (exit if pool liquidity drops 40% from entry) and the safety filters from the DEX page.</p>
        </div>
        {err && <div className="text-down">{err}</div>}
        <div className="flex gap-2 justify-end"><button className="btn" disabled={busy} onClick={() => submit(false)}>{botId ? "Save" : "Create (stopped)"}</button><button className="btn btn-primary" disabled={busy} onClick={() => submit(true)}>{botId ? "Save & run" : "Create & run"}</button></div>
      </div>
    </Card>
  );
}
