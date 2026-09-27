"use client";
import { useState } from "react";
import { api, refresh, useApi } from "@/lib/client";
import { Card, Empty, PageHeader } from "@/components/ui";
import { fmtPct, fmtPrice, cls } from "@/lib/format";

interface T { symbol: string; last: number; changePct: number; high: number; low: number; quoteVolume: number }

export default function Markets() {
  const { data } = useApi<T[]>("/api/markets?n=60", 30000);
  const [q, setQ] = useState("");
  const [buy, setBuy] = useState<T | null>(null);
  const [size, setSize] = useState(250); const [sl, setSl] = useState(2); const [tp, setTp] = useState(4);
  const [busy, setBusy] = useState(false);
  const list = (data ?? []).filter((t) => t.symbol.toLowerCase().includes(q.toLowerCase()));
  const doBuy = async () => {
    if (!buy) return; setBusy(true);
    try { await api("/api/trade", "POST", { symbol: buy.symbol, notionalUsd: size, stopLossPct: sl, takeProfitPct: tp }); await refresh("/api"); setBuy(null); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Markets" sub="Top spot pairs by 24h volume. Refreshes every 30s.">
        <input className="input !w-56" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHeader>
      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          {!data ? <Empty>Loading…</Empty> : (
            <table className="tbl"><thead><tr><th>#</th><th>Pair</th><th className="text-right">Price</th><th className="text-right">24h</th><th className="text-right">24h range</th><th className="text-right">Volume</th><th></th></tr></thead>
              <tbody>{list.map((t, i) => {
                const pos = t.high > t.low ? ((t.last - t.low) / (t.high - t.low)) * 100 : 50;
                return (
                  <tr key={t.symbol}>
                    <td className="text-muted text-xs">{i + 1}</td><td className="font-medium">{t.symbol}</td>
                    <td className="num text-right">{fmtPrice(t.last)}</td>
                    <td className={cls("num text-right", t.changePct >= 0 ? "text-up" : "text-down")}>{fmtPct(t.changePct)}</td>
                    <td className="text-right"><div className="inline-block w-24 h-1.5 rounded bg-panel-2 relative align-middle"><div className="absolute top-0 bottom-0 w-1 rounded bg-accent" style={{ left: `calc(${pos}% - 2px)` }} /></div></td>
                    <td className="num text-right text-muted">${(t.quoteVolume / 1e6).toFixed(1)}M</td>
                    <td className="text-right"><button className="btn btn-sm btn-up" onClick={() => setBuy(t)}>Buy</button></td>
                  </tr>
                );
              })}</tbody></table>
          )}
        </Card>
        <Card title={buy ? `Quick buy · ${buy.symbol}` : "Quick buy"}>
          {!buy ? <Empty>Pick a pair to place a paper market buy with a stop and target. The engine manages the exit.</Empty> : (
            <div className="p-4 space-y-3 text-sm">
              <div className="num text-lg">{fmtPrice(buy.last)}</div>
              <label className="block"><span className="label">Size $</span><input type="number" className="input num" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">Stop-loss %</span><input type="number" step={0.1} className="input num" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Take-profit %</span><input type="number" step={0.1} className="input num" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></label>
              </div>
              <div className="text-xs text-muted num">Stop {fmtPrice(buy.last * (1 - sl / 100))} · Target {fmtPrice(buy.last * (1 + tp / 100))} · Qty ≈ {(size / buy.last).toPrecision(4)}</div>
              <div className="flex gap-2"><button className="btn flex-1" onClick={() => setBuy(null)}>Cancel</button><button className="btn btn-primary flex-1" disabled={busy} onClick={doBuy}>Paper buy</button></div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
