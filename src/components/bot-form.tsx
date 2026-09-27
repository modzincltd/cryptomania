"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, refresh, useApi } from "@/lib/client";
import { Card } from "./ui";

interface StrategyMeta { id: string; name: string; description: string; defaultParams: Record<string, number>; paramLabels: Record<string, string> }
export interface BotFormValues {
  name: string; symbol: string; timeframe: string; intervalSec: number; strategy: string; params: Record<string, number>;
  risk: { stopLossPct: number; takeProfitPct: number; trailingStopPct: number; maxPositionUsd: number; maxDailyLossUsd: number; cooldownSec: number; maxOpenPositions: number };
  mode: "paper" | "live"; allocationUsd: number;
}
const DEFAULTS: BotFormValues = {
  name: "", symbol: "BTC/USDT", timeframe: "5m", intervalSec: 60, strategy: "rsi", params: {},
  risk: { stopLossPct: 2, takeProfitPct: 4, trailingStopPct: 0, maxPositionUsd: 500, maxDailyLossUsd: 100, cooldownSec: 300, maxOpenPositions: 1 },
  mode: "paper", allocationUsd: 500,
};

export function BotForm({ initial, botId }: { initial?: Partial<BotFormValues>; botId?: number }) {
  const router = useRouter();
  const { data: strategies } = useApi<StrategyMeta[]>("/api/strategies", 0);
  const { data: markets } = useApi<{ symbol: string }[]>("/api/markets?n=60", 0);
  const { data: engine } = useApi<{ liveKeys: boolean }>("/api/engine", 0);
  const [v, setV] = useState<BotFormValues>({ ...DEFAULTS, ...initial, risk: { ...DEFAULTS.risk, ...(initial?.risk ?? {}) } });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strat = strategies?.find((s) => s.id === v.strategy);

  useEffect(() => { if (strat && !initial?.params) setV((x) => ({ ...x, params: { ...strat.defaultParams } })); }, [strat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof BotFormValues>(k: K, val: BotFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const setRisk = (k: keyof BotFormValues["risk"], val: number) => setV((x) => ({ ...x, risk: { ...x.risk, [k]: val } }));

  const submit = async (start: boolean) => {
    setBusy(true); setErr(null);
    try {
      const body = { ...v, name: v.name || `${v.symbol.split("/")[0]} ${strat?.name ?? v.strategy}`, ...(start ? { status: "running" } : {}) };
      if (botId) await api(`/api/bots/${botId}`, "PATCH", body); else await api("/api/bots", "POST", body);
      await refresh("/api"); router.push("/bots");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const num = (label: string, value: number, on: (n: number) => void, hint?: string, step = 1) => (
    <label className="block"><span className="label">{label}</span><input type="number" step={step} className="input num" value={value} onChange={(e) => on(Number(e.target.value))} />{hint && <span className="text-[11px] text-muted">{hint}</span>}</label>
  );

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Market & schedule">
          <div className="p-4 grid md:grid-cols-2 gap-4">
            <label className="block"><span className="label">Name</span><input className="input" placeholder="auto" value={v.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="block"><span className="label">Symbol</span>
              <input className="input num" list="symbols" value={v.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} />
              <datalist id="symbols">{markets?.map((m) => <option key={m.symbol} value={m.symbol} />)}</datalist>
            </label>
            <label className="block"><span className="label">Candle timeframe</span>
              <select className="input" value={v.timeframe} onChange={(e) => set("timeframe", e.target.value)}>{["1m", "5m", "15m", "1h", "4h"].map((t) => <option key={t}>{t}</option>)}</select>
              <span className="text-[11px] text-muted">Indicators are computed on these candles.</span>
            </label>
            <label className="block"><span className="label">Scan interval</span>
              <select className="input" value={v.intervalSec} onChange={(e) => set("intervalSec", Number(e.target.value))}><option value={30}>Every 30 seconds</option><option value={60}>Every 1 minute</option><option value={300}>Every 5 minutes</option></select>
              <span className="text-[11px] text-muted">How often the bot checks the market. Stops are checked on every scan.</span>
            </label>
          </div>
        </Card>
        <Card title="Strategy">
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-5 gap-2">
              {strategies?.map((s) => (
                <button key={s.id} type="button" onClick={() => { set("strategy", s.id); set("params", { ...s.defaultParams }); }} className={`text-left rounded-xl border p-3 text-sm transition ${v.strategy === s.id ? "border-accent bg-panel-2" : "border-border hover:border-muted"}`}>
                  <div className="font-medium">{s.name}</div>
                </button>
              ))}
            </div>
            {strat && <p className="text-sm text-muted">{strat.description}</p>}
            {strat && <div className="grid md:grid-cols-4 gap-3">
              {Object.keys(strat.defaultParams).map((k) => num(strat.paramLabels[k] ?? k, v.params[k] ?? strat.defaultParams[k], (n) => set("params", { ...v.params, [k]: n }), undefined, 0.1))}
            </div>}
          </div>
        </Card>
        <Card title="Risk rules">
          <div className="p-4 grid md:grid-cols-4 gap-3">
            {num("Stop-loss %", v.risk.stopLossPct, (n) => setRisk("stopLossPct", n), "0 = none", 0.1)}
            {num("Take-profit %", v.risk.takeProfitPct, (n) => setRisk("takeProfitPct", n), "0 = none", 0.1)}
            {num("Trailing stop %", v.risk.trailingStopPct, (n) => setRisk("trailingStopPct", n), "0 = off · from peak", 0.1)}
            {num("Max position $", v.risk.maxPositionUsd, (n) => setRisk("maxPositionUsd", n), "hard cap per trade")}
            {num("Max daily loss $", v.risk.maxDailyLossUsd, (n) => setRisk("maxDailyLossUsd", n), "bot halts until tomorrow")}
            {num("Cooldown (sec)", v.risk.cooldownSec, (n) => setRisk("cooldownSec", n), "wait after a close")}
            {num("Max open positions", v.risk.maxOpenPositions, (n) => setRisk("maxOpenPositions", n), "per bot")}
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Capital & mode">
          <div className="p-4 space-y-4">
            {num("Allocation per trade $", v.allocationUsd, (n) => set("allocationUsd", n))}
            <div>
              <span className="label">Mode</span>
              <div className="flex gap-2">
                <button type="button" className={`btn flex-1 ${v.mode === "paper" ? "btn-primary" : ""}`} onClick={() => set("mode", "paper")}>Paper</button>
                <button type="button" className={`btn flex-1 ${v.mode === "live" ? "btn-primary" : ""}`} disabled={!engine?.liveKeys} onClick={() => set("mode", "live")}>Live</button>
              </div>
              {!engine?.liveKeys && <p className="text-[11px] text-muted mt-1">Live mode unlocks when exchange API keys are set in .env</p>}
              {v.mode === "live" && <p className="text-xs text-warn mt-2">⚠ Real orders will be placed on the exchange.</p>}
            </div>
          </div>
        </Card>
        {err && <div className="card p-3 text-sm text-down border-down/40">{err}</div>}
        <div className="flex gap-2">
          <button className="btn flex-1" disabled={busy} onClick={() => submit(false)}>{botId ? "Save" : "Create (stopped)"}</button>
          <button className="btn btn-primary flex-1" disabled={busy} onClick={() => submit(true)}>{botId ? "Save & run" : "Create & run"}</button>
        </div>
      </div>
    </div>
  );
}
