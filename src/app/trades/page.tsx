"use client";
import { useApi } from "@/lib/client";
import { Card, Empty, PageHeader, StatusPill } from "@/components/ui";
import { fmtPct, fmtPrice, fmtQty, fmtTime, fmtUsd, cls, pnlClass } from "@/lib/format";
import { Sym } from "@/components/symbol";

interface P { id: number; botId: number | null; symbol: string; qty: number; entryPrice: number; entryAt: number; exitPrice: number | null; exitAt: number | null; exitReason: string | null; pnl: number | null; pnlPct: number | null; status: string; mode: string; source: string }
interface F { id: number; symbol: string; side: string; qty: number; price: number; fee: number; reason: string | null; createdAt: number; mode: string }

export default function Trades() {
  const { data } = useApi<{ positions: P[]; fills: F[] }>("/api/trades", 20000);
  const closed = data?.positions.filter((p) => p.status === "closed") ?? [];
  const total = closed.reduce((a, p) => a + (p.pnl ?? 0), 0);
  return (
    <>
      <PageHeader title="Trades" sub={`${closed.length} closed positions · ${fmtUsd(total)} realised`} />
      <Card title="Positions" className="mb-4">
        {!data ? <Empty>Loading…</Empty> : !data.positions.length ? <Empty>No trades yet.</Empty> : (
          <table className="tbl"><thead><tr><th>Opened</th><th>Symbol</th><th>Source</th><th className="text-right">Qty</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th className="text-right">PnL</th><th>Held</th><th>Exit reason</th><th></th></tr></thead>
            <tbody>{data.positions.map((p) => (
              <tr key={p.id}>
                <td className="text-xs text-muted">{fmtTime(p.entryAt)}</td><td className="font-medium"><Sym symbol={p.symbol} /></td>
                <td className="text-xs text-muted">{p.botId ? `bot ${p.botId}` : p.source}</td>
                <td className="num text-right">{fmtQty(p.qty)}</td><td className="num text-right">{fmtPrice(p.entryPrice)}</td><td className="num text-right">{fmtPrice(p.exitPrice)}</td>
                <td className={cls("num text-right", pnlClass(p.pnl))}>{p.pnl == null ? "—" : `${fmtUsd(p.pnl)} (${fmtPct(p.pnlPct)})`}</td>
                <td className="text-xs text-muted">{p.exitAt ? `${Math.round((p.exitAt - p.entryAt) / 60000)}m` : "—"}</td>
                <td className="text-xs text-muted">{p.exitReason ?? "—"}</td><td><StatusPill status={p.status} /></td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
      <Card title="Fills">
        {data?.fills.length ? (
          <table className="tbl"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Fee</th><th>Reason</th></tr></thead>
            <tbody>{data.fills.map((f) => (
              <tr key={f.id}><td className="text-xs text-muted">{fmtTime(f.createdAt)}</td><td><Sym symbol={f.symbol} /></td><td className={cls("text-xs font-semibold", f.side === "buy" ? "text-up" : "text-down")}>{f.side.toUpperCase()}</td><td className="num text-right">{fmtQty(f.qty)}</td><td className="num text-right">{fmtPrice(f.price)}</td><td className="num text-right text-muted">{fmtUsd(f.fee, 4)}</td><td className="text-xs text-muted">{f.reason}</td></tr>
            ))}</tbody></table>
        ) : <Empty>No fills yet.</Empty>}
      </Card>
    </>
  );
}
