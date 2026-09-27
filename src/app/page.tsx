"use client";
import Link from "next/link";
import { useApi } from "@/lib/client";
import { Card, Empty, PageHeader, Stat, StatusPill } from "@/components/ui";
import { EquityChart } from "@/components/equity-chart";
import { PositionsTable, type LivePosition } from "@/components/positions-table";
import { fmtUsd, fmtPct, fmtTime, fmtPrice, fmtQty, cls, pnlClass } from "@/lib/format";
import { BotControls } from "@/components/bot-controls";
import { Sym } from "@/components/symbol";

interface Dash {
  equity: { cash: number; positionsValue: number; equity: number; unrealized: number; positions: LivePosition[] };
  stats: { totalTrades: number; winRate: number; realized: number; realizedToday: number; profitFactor: number; startCash: number };
  bots: { id: number; name: string; symbol: string; pairId?: string | null; strategy: string; status: string; mode: string; intervalSec: number; lastSignal: string | null; lastError: string | null; lastRunAt: number | null }[];
  recentTrades: { id: number; symbol: string; pairId?: string | null; side: string; qty: number; price: number; reason: string | null; createdAt: number; mode: string }[];
  lastScan: { createdAt: number; summary: string; regime: string } | null;
  engine: { online: boolean };
}

export default function Dashboard() {
  const { data, error } = useApi<Dash>("/api/dashboard", 15000);
  if (error) return <div className="text-down">{error.message}</div>;
  if (!data) return <div className="text-muted text-sm">Loading…</div>;
  const { equity, stats, bots } = data;
  const total = equity.equity - stats.startCash;
  const botNames = Object.fromEntries(bots.map((b) => [b.id, b.name]));
  const running = bots.filter((b) => b.status === "running").length;
  return (
    <>
      <PageHeader title="Dashboard" sub="Paper account · live market prices">
        <Link href="/bots/new" className="btn btn-primary">+ New bot</Link>
      </PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Stat label="Equity" value={fmtUsd(equity.equity)} sub={`${fmtPct((total / stats.startCash) * 100)} all-time`} tone={total > 0 ? "up" : total < 0 ? "down" : undefined} />
        <Stat label="Cash" value={fmtUsd(equity.cash)} sub={`${fmtUsd(equity.positionsValue)} in positions`} />
        <Stat label="Open PnL" value={fmtUsd(equity.unrealized)} tone={equity.unrealized > 0 ? "up" : equity.unrealized < 0 ? "down" : undefined} sub={`${equity.positions.length} open`} />
        <Stat label="Realised today" value={fmtUsd(stats.realizedToday)} tone={stats.realizedToday > 0 ? "up" : stats.realizedToday < 0 ? "down" : undefined} sub={`${fmtUsd(stats.realized)} all-time`} />
        <Stat label="Win rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.totalTrades} closed · PF ${isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}`} />
        <Stat label="Bots" value={`${running}/${bots.length}`} sub={running ? "running" : "none running"} tone={running ? "up" : "muted"} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Card title="Equity (24h)" className="xl:col-span-2"><EquityChart start={stats.startCash} /></Card>
        <Card title="Latest AI read" right={<Link href="/ai" className="text-xs text-accent">Scanner →</Link>}>
          {data.lastScan ? (
            <div className="p-4 text-sm">
              <div className="flex items-center gap-2 mb-2"><StatusPill status={data.lastScan.regime === "risk-on" ? "long" : data.lastScan.regime === "risk-off" ? "avoid" : "paused"} /><span className="text-xs text-muted">{fmtTime(data.lastScan.createdAt)}</span></div>
              <p className="text-muted leading-relaxed">{data.lastScan.summary}</p>
            </div>
          ) : <Empty>No scans yet. Run one from the AI Scanner.</Empty>}
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card title="Open positions" className="xl:col-span-2"><PositionsTable positions={equity.positions} botNames={botNames} /></Card>
        <Card title="Bots" right={<Link href="/bots" className="text-xs text-accent">Manage →</Link>}>
          {bots.length ? (
            <ul className="divide-y divide-border">
              {bots.map((b) => {
                let sig: { action: string; reason: string } | null = null;
                try { sig = b.lastSignal ? JSON.parse(b.lastSignal) : null; } catch {}
                return (
                  <li key={b.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/bots/${b.id}`} className="text-sm font-medium hover:text-accent">{b.name}</Link>
                      <div className="text-xs text-muted truncate"><Sym symbol={b.symbol} pairId={b.pairId} size={12} /> · {b.strategy} · {b.intervalSec}s{sig ? ` · ${sig.action.toUpperCase()}: ${sig.reason}` : ""}{b.lastError ? ` · ⚠ ${b.lastError}` : ""}</div>
                    </div>
                    <StatusPill status={b.status} />
                    <BotControls id={b.id} status={b.status} compact />
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No bots yet. <Link className="text-accent" href="/bots/new">Create one</Link>.</Empty>}
        </Card>
      </div>

      <Card title="Recent fills" className="mt-4">
        {data.recentTrades.length ? (
          <table className="tbl"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th className="text-right">Qty</th><th className="text-right">Price</th><th>Reason</th></tr></thead>
            <tbody>{data.recentTrades.map((t) => (
              <tr key={t.id}><td className="text-xs text-muted">{fmtTime(t.createdAt)}</td><td><Sym symbol={t.symbol} pairId={t.pairId} /></td><td className={cls("font-semibold text-xs", t.side === "buy" ? "text-up" : "text-down")}>{t.side.toUpperCase()}</td><td className="num text-right">{fmtQty(t.qty)}</td><td className="num text-right">{fmtPrice(t.price)}</td><td className={cls("text-xs text-muted", pnlClass(null))}>{t.reason}</td></tr>
            ))}</tbody></table>
        ) : <Empty>No fills yet.</Empty>}
      </Card>
    </>
  );
}
