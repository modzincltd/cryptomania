"use client";
import { useState } from "react";
import { api, refresh } from "@/lib/client";
import { fmtPrice, fmtQty, fmtUsd, fmtPct, fmtAgo, pnlClass, cls } from "@/lib/format";
import { Empty, StatusPill } from "./ui";
import { Sym } from "./symbol";

export interface LivePosition { id: number; botId: number | null; symbol: string; qty: number; entryPrice: number; entryAt: number; stopLoss: number | null; takeProfit: number | null; price: number; marketValue: number; unrealizedPnl: number; unrealizedPct: number; mode: string; source: string }

export function PositionsTable({ positions, botNames = {} }: { positions: LivePosition[]; botNames?: Record<number, string> }) {
  const [busy, setBusy] = useState<number | null>(null);
  if (!positions.length) return <Empty>No open positions.</Empty>;
  const close = async (id: number) => {
    setBusy(id);
    try { await api(`/api/positions/${id}/close`); await refresh("/api"); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Symbol</th><th>Owner</th><th className="text-right">Qty</th><th className="text-right">Entry</th><th className="text-right">Price</th><th className="text-right">Value</th><th className="text-right">PnL</th><th className="text-right">SL / TP</th><th>Age</th><th></th></tr></thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id}>
              <td className="font-medium"><Sym symbol={p.symbol} /> <StatusPill status={p.mode} /></td>
              <td className="text-muted text-xs">{p.botId ? botNames[p.botId] ?? `bot ${p.botId}` : p.source}</td>
              <td className="num text-right">{fmtQty(p.qty)}</td>
              <td className="num text-right">{fmtPrice(p.entryPrice)}</td>
              <td className="num text-right">{fmtPrice(p.price)}</td>
              <td className="num text-right">{fmtUsd(p.marketValue)}</td>
              <td className={cls("num text-right", pnlClass(p.unrealizedPnl))}>{fmtUsd(p.unrealizedPnl)} <span className="text-xs">({fmtPct(p.unrealizedPct)})</span></td>
              <td className="num text-right text-xs text-muted">{fmtPrice(p.stopLoss)} / {fmtPrice(p.takeProfit)}</td>
              <td className="text-xs text-muted">{fmtAgo(p.entryAt)}</td>
              <td className="text-right"><button className="btn btn-sm btn-danger" disabled={busy === p.id} onClick={() => close(p.id)}>Close</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
