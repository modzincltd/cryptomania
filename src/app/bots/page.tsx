"use client";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/client";
import { Card, Empty, PageHeader, StatusPill } from "@/components/ui";
import { BotControls } from "@/components/bot-controls";
import { fmtAgo, fmtUsd } from "@/lib/format";
import { Sym } from "@/components/symbol";

interface Bot { id: number; name: string; symbol: string; pairId?: string | null; strategy: string; timeframe: string; intervalSec: number; status: string; mode: string; allocationUsd: number; lastRunAt: number | null; lastSignal: string | null; lastError: string | null; haltedUntil: number | null; risk: { stopLossPct: number; takeProfitPct: number } }

export default function BotsPage() {
  const { data: bots } = useApi<Bot[]>("/api/bots", 10000);
  const [now] = useState(() => Date.now());
  return (
    <>
      <PageHeader title="Bots" sub="Each bot scans on its own interval (30s / 1m / 5m) and manages one symbol.">
        <Link href="/bots/new" className="btn btn-primary">+ New bot</Link>
      </PageHeader>
      <Card>
        {!bots ? <Empty>Loading…</Empty> : !bots.length ? <Empty>No bots yet.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Bot</th><th>Symbol</th><th>Strategy</th><th>Interval</th><th className="text-right">Allocation</th><th>SL / TP</th><th>Last signal</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {bots.map((b) => {
                let sig: { action: string; reason: string } | null = null;
                try { sig = b.lastSignal ? JSON.parse(b.lastSignal) : null; } catch {}
                return (
                  <tr key={b.id}>
                    <td><Link href={`/bots/${b.id}`} className="font-medium hover:text-accent">{b.name}</Link> <StatusPill status={b.mode} /></td>
                    <td className="num"><Sym symbol={b.symbol} pairId={b.pairId} /></td>
                    <td className="text-muted">{b.strategy} · {b.timeframe}</td>
                    <td className="num text-muted">{b.intervalSec}s</td>
                    <td className="num text-right">{fmtUsd(b.allocationUsd, 0)}</td>
                    <td className="num text-xs text-muted">-{b.risk.stopLossPct}% / +{b.risk.takeProfitPct}%</td>
                    <td className="text-xs max-w-[260px] truncate">
                      {b.lastError ? <span className="text-down">⚠ {b.lastError}</span> : sig ? <><span className={sig.action === "buy" ? "text-up font-semibold" : sig.action === "sell" ? "text-down font-semibold" : "text-muted"}>{sig.action.toUpperCase()}</span> <span className="text-muted">{sig.reason} · {fmtAgo(b.lastRunAt)}</span></> : <span className="text-muted">—</span>}
                      {b.haltedUntil && b.haltedUntil > now && <div className="text-warn">halted (daily loss limit)</div>}
                    </td>
                    <td><StatusPill status={b.status} /></td>
                    <td><BotControls id={b.id} status={b.status} compact /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
