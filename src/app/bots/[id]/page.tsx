"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api, refresh, useApi } from "@/lib/client";
import { Card, Empty, PageHeader, StatusPill } from "@/components/ui";
import { BotControls } from "@/components/bot-controls";
import { BotForm, type BotFormValues } from "@/components/bot-form";
import { Sym } from "@/components/symbol";
import { fmtPct, fmtPrice, fmtTime, fmtUsd, cls, pnlClass, fmtAgo } from "@/lib/format";

interface Detail {
  bot: BotFormValues & { id: number; status: string; lastSignal: string | null; lastError: string | null; lastRunAt: number | null };
  positions: { id: number; entryAt: number; exitAt: number | null; entryPrice: number; exitPrice: number | null; qty: number; pnl: number | null; pnlPct: number | null; status: string; exitReason: string | null }[];
  logs: { id: number; ts: number; level: string; message: string }[];
}

export default function BotDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error } = useApi<Detail>(`/api/bots/${id}`, 10000);
  const [edit, setEdit] = useState(false);
  if (error) return <div className="text-down">{error.message}</div>;
  if (!data) return <div className="text-muted text-sm">Loading…</div>;
  const { bot, positions, logs } = data;
  let sig: { action: string; reason: string; indicators: Record<string, unknown>; price: number } | null = null;
  try { sig = bot.lastSignal ? JSON.parse(bot.lastSignal) : null; } catch {}
  const del = async () => { if (!confirm("Delete this bot?")) return; try { await api(`/api/bots/${id}`, "DELETE"); await refresh("/api"); router.push("/bots"); } catch (e) { alert((e as Error).message); } };
  const closedPnl = positions.filter((p) => p.status === "closed").reduce((a, p) => a + (p.pnl ?? 0), 0);

  return (
    <>
      <PageHeader title={bot.name} sub={`${bot.strategy} on ${bot.timeframe} candles · scans every ${bot.intervalSec}s · ${bot.mode}`}>
        <Sym symbol={bot.symbol} className="text-sm mr-2" />
        <StatusPill status={bot.status} />
        <BotControls id={bot.id} status={bot.status} />
        <button className="btn" onClick={() => setEdit(!edit)}>{edit ? "Cancel edit" : "Edit"}</button>
        <button className="btn btn-danger" onClick={del}>Delete</button>
      </PageHeader>
      {edit ? <BotForm botId={bot.id} initial={bot} /> : (
        <div className="grid xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card title="Last evaluation" right={<span className="text-xs text-muted">{fmtAgo(bot.lastRunAt)}</span>}>
              <div className="p-4 text-sm">
                {bot.lastError && <div className="text-down mb-2">⚠ {bot.lastError}</div>}
                {sig ? (<>
                  <div className="flex items-center gap-3 mb-3"><span className={cls("text-lg font-semibold", sig.action === "buy" ? "text-up" : sig.action === "sell" ? "text-down" : "text-muted")}>{sig.action.toUpperCase()}</span><span className="text-muted">{sig.reason}</span><span className="num ml-auto">{fmtPrice(sig.price)}</span></div>
                  <div className="flex flex-wrap gap-2">{Object.entries(sig.indicators).map(([k, v]) => <span key={k} className="pill pill-muted num">{k}: {String(v)}</span>)}</div>
                </>) : <span className="text-muted">Not evaluated yet — start the bot and the engine.</span>}
              </div>
            </Card>
            <Card title={`Positions (${positions.length})`} right={<span className={cls("num text-sm", pnlClass(closedPnl))}>{fmtUsd(closedPnl)} realised</span>}>
              {positions.length ? (
                <table className="tbl"><thead><tr><th>Opened</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th className="text-right">PnL</th><th>Exit reason</th><th></th></tr></thead>
                  <tbody>{positions.map((p) => (
                    <tr key={p.id}><td className="text-xs text-muted">{fmtTime(p.entryAt)}</td><td className="num text-right">{fmtPrice(p.entryPrice)}</td><td className="num text-right">{fmtPrice(p.exitPrice)}</td><td className={cls("num text-right", pnlClass(p.pnl))}>{p.pnl == null ? "open" : `${fmtUsd(p.pnl)} (${fmtPct(p.pnlPct)})`}</td><td className="text-xs text-muted">{p.exitReason ?? "—"}</td><td><StatusPill status={p.status} /></td></tr>
                  ))}</tbody></table>
              ) : <Empty>No positions yet.</Empty>}
            </Card>
          </div>
          <Card title="Log">
            <ul className="divide-y divide-border max-h-[640px] overflow-auto text-xs">
              {logs.length ? logs.map((l) => (
                <li key={l.id} className="px-4 py-2"><span className="text-muted num">{new Date(l.ts).toLocaleTimeString("en-GB")}</span> <span className={cls(l.level === "error" && "text-down", l.level === "warn" && "text-warn", l.level === "trade" && "text-up")}>{l.message}</span></li>
              )) : <Empty>Nothing logged yet.</Empty>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
