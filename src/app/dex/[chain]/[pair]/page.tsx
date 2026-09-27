"use client";
import { use, useState } from "react";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, refresh, useApi } from "@/lib/client";
import { Card, Empty, PageHeader, Stat, StatusPill } from "@/components/ui";
import { StarToggle } from "@/components/symbol";
import { BotControls } from "@/components/bot-controls";
import { DexBotForm } from "@/components/dex-bot-form";
import { Chg, ChainPill, fmtDexPrice, fmtK, fmtAge } from "@/components/dex-table";
import type { DexPair } from "@/lib/dex";
import { cls, fmtAgo, fmtPct, fmtTime, fmtUsd, pnlClass } from "@/lib/format";

interface Detail {
  pair: DexPair; embedUrl: string;
  positions: { id: number; entryAt: number; entryPrice: number; price: number | null; live: boolean; pnl: number | null; pnlPct: number | null; status: string; exitReason: string | null; source: string; botId: number | null }[];
  suggestions: { id: number; side: string; entry: number; stopLoss: number; takeProfit: number; confidence: number; timeframe: string; rationale: string; status: string; createdAt: number }[];
  bots: { id: number; name: string; strategy: string; status: string; intervalSec: number }[];
  ticks: { ts: number; price: number; liq: number }[];
}
interface Analysis { bias: string; thesis: string; rugRisk: string; risks: string[]; suggestion: Detail["suggestions"][number] | null; model: string; tokens: number; createdAt: number }

export default function DexPairPage({ params }: { params: Promise<{ chain: string; pair: string }> }) {
  const { chain, pair } = use(params);
  const pairId = `${chain}:${pair}`;
  const { data, error } = useApi<Detail>(`/api/dex/${chain}/${pair}`, 15000);
  const { data: engine } = useApi<{ aiKey: boolean }>("/api/engine", 0);
  const [size, setSize] = useState(100); const [sl, setSl] = useState(15); const [tp, setTp] = useState(40); const [trail, setTrail] = useState(12);
  const [busy, setBusy] = useState<string | null>(null); const [showBot, setShowBot] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [aiErr, setAiErr] = useState<string | null>(null);
  if (error) return <div className="text-down">{error.message}</div>;
  if (!data) return <div className="text-muted text-sm">Loading…</div>;
  const p = data.pair;
  const buy = async () => { setBusy("buy"); try { await api("/api/trade", "POST", { symbol: p.symbol, pairId, notionalUsd: size, stopLossPct: sl, takeProfitPct: tp, trailingStopPct: trail }); await refresh("/api"); } catch (e) { alert((e as Error).message); } finally { setBusy(null); } };
  const analyse = async () => { setBusy("ai"); setAiErr(null); try { setAnalysis(await api<Analysis>(`/api/dex/${chain}/${pair}/analyse`)); await refresh("/api/dex"); } catch (e) { setAiErr((e as Error).message); } finally { setBusy(null); } };
  const actSug = async (id: number, action: string) => { try { await api(`/api/suggestions/${id}/${action}`, "POST", { notionalUsd: size }); await refresh("/api"); } catch (e) { alert((e as Error).message); } };
  const br = (t: { buys: number; sells: number }) => (t.buys + t.sells ? Math.round((t.buys / (t.buys + t.sells)) * 100) : 50);

  return (
    <>
      <PageHeader title={`${p.baseSymbol} / ${p.quoteSymbol}`} sub={`${p.baseName} · ${p.dexId} · ${p.baseAddress}`}>
        <StarToggle symbol={pairId} size={22} /><ChainPill c={p.chainId} />
        <div className="text-right mr-2"><div className="num text-2xl font-semibold">${fmtDexPrice(p.priceUsd)}</div><div className="text-sm"><Chg v={p.change.h24} /> <span className="text-muted">24h</span></div></div>
        <a className="btn" href={p.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> DexScreener</a>
        <button className="btn" onClick={() => setShowBot(!showBot)}>{showBot ? "Cancel" : "+ DEX bot"}</button>
        <button className="btn btn-primary" disabled={busy === "ai" || !engine?.aiKey} onClick={analyse}><Sparkles size={15} /> {busy === "ai" ? "Analysing…" : "AI deep dive"}</button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
        <Stat label="5m" value={fmtPct(p.change.m5, 1)} tone={p.change.m5 >= 0 ? "up" : "down"} /><Stat label="1h" value={fmtPct(p.change.h1, 1)} tone={p.change.h1 >= 0 ? "up" : "down"} /><Stat label="6h" value={fmtPct(p.change.h6, 1)} tone={p.change.h6 >= 0 ? "up" : "down"} />
        <Stat label="Liquidity" value={fmtK(p.liquidityUsd)} sub={`mcap ${fmtK(p.marketCap || p.fdv)}`} /><Stat label="Vol 24h" value={fmtK(p.volume.h24)} sub={`1h ${fmtK(p.volume.h1)}`} />
        <Stat label="Buyers 1h" value={`${br(p.txns.h1)}%`} sub={`${p.txns.h1.buys}b / ${p.txns.h1.sells}s`} tone={br(p.txns.h1) >= 55 ? "up" : br(p.txns.h1) <= 45 ? "down" : undefined} />
        <Stat label="Age" value={fmtAge(p.ageMin)} sub={p.createdAt ? fmtTime(p.createdAt) : ""} /><Stat label="Score" value={String(p.score)} tone={p.score >= 65 ? "up" : p.score < 45 ? "down" : undefined} sub={p.tradable ? "passes filters" : "blocked by filters"} />
      </div>
      {p.flags.length > 0 && <div className={cls("card p-3 mb-4 text-sm", p.tradable ? "text-warn" : "text-down")}>⚠ {p.flags.join(" · ")}</div>}
      {showBot && <div className="mb-4"><DexBotForm pairId={pairId} symbol={p.symbol} onDone={() => { setShowBot(false); refresh("/api"); }} /></div>}

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Chart"><iframe src={data.embedUrl} className="w-full rounded-b-[14px]" style={{ height: 620, border: 0 }} allow="clipboard-write" /></Card>
          {(analysis || aiErr) && (
            <Card title="AI deep dive" right={analysis && <span className="text-xs text-muted">{analysis.model} · {analysis.tokens} tokens · {fmtAgo(analysis.createdAt)}</span>}>
              {aiErr ? <div className="p-4 text-sm text-down">{aiErr}</div> : analysis && (
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex gap-2"><span className={cls("pill", analysis.bias === "bullish" ? "pill-up" : analysis.bias === "bearish" ? "pill-down" : "pill-warn")}>{analysis.bias}</span><span className={cls("pill", analysis.rugRisk === "low" ? "pill-up" : analysis.rugRisk === "high" ? "pill-down" : "pill-warn")}>rug risk {analysis.rugRisk}</span></div>
                  <p className="leading-relaxed">{analysis.thesis}</p>
                  {analysis.risks.length > 0 && <ul className="list-disc pl-4 text-muted text-xs space-y-0.5">{analysis.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>}
                </div>
              )}
            </Card>
          )}
          {data.ticks.length > 2 && (
            <Card title="Engine price & liquidity ticks (24h)">
              <div className="h-40 px-2 pt-2"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.ticks}><XAxis dataKey="ts" tickFormatter={(t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} tick={{ fill: "#8b98a5", fontSize: 10 }} stroke="#1f2a35" minTickGap={60} /><YAxis dataKey="price" domain={["auto", "auto"]} tick={{ fill: "#8b98a5", fontSize: 10 }} stroke="#1f2a35" width={70} tickFormatter={(v) => fmtDexPrice(Number(v))} /><Tooltip contentStyle={{ background: "#172029", border: "1px solid #1f2a35", borderRadius: 10, fontSize: 12 }} labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-GB")} formatter={(v, n) => [n === "price" ? `$${fmtDexPrice(Number(v))}` : fmtK(Number(v)), n]} /><Area type="monotone" dataKey="price" stroke="#6ea8fe" fill="#6ea8fe22" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
            </Card>
          )}
          <Card title="Your history">
            {data.positions.length ? <table className="tbl"><thead><tr><th>Opened</th><th>Source</th><th className="text-right">Entry</th><th className="text-right">Exit / Now</th><th className="text-right">PnL</th><th>Reason</th><th></th></tr></thead>
              <tbody>{data.positions.map((x) => <tr key={x.id}><td className="text-xs text-muted">{fmtTime(x.entryAt)}</td><td className="text-xs text-muted">{x.botId ? <Link className="text-accent" href={`/bots/${x.botId}`}>bot {x.botId}</Link> : x.source}</td><td className="num text-right">${fmtDexPrice(x.entryPrice)}</td><td className={cls("num text-right", x.live && "text-muted")}>${fmtDexPrice(x.price ?? 0)}</td><td className={cls("num text-right", pnlClass(x.pnl))}>{fmtUsd(x.pnl)} ({fmtPct(x.pnlPct)}){x.live && <span className="ml-1 text-[10px] text-accent">live</span>}</td><td className="text-xs text-muted">{x.exitReason ?? "—"}</td><td><StatusPill status={x.status} /></td></tr>)}</tbody></table> : <Empty>No trades on this pair yet.</Empty>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Paper buy">
            <div className="p-4 space-y-3 text-sm">
              <label className="block"><span className="label">Size $</span><input type="number" className="input num" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block"><span className="label">Stop %</span><input type="number" className="input num" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Target %</span><input type="number" className="input num" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Trail %</span><input type="number" className="input num" value={trail} onChange={(e) => setTrail(Number(e.target.value))} /></label>
              </div>
              <div className="text-xs text-muted num">Impact ≈ {(Math.min(25, (size / (p.liquidityUsd / 2 + size)) * 100)).toFixed(2)}% each way · stop ${fmtDexPrice(p.priceUsd * (1 - sl / 100))} · target ${fmtDexPrice(p.priceUsd * (1 + tp / 100))}</div>
              <button className="btn btn-primary w-full" disabled={busy === "buy" || !p.tradable} onClick={buy}>{p.tradable ? `Paper buy $${size}` : "Blocked by safety filters"}</button>
            </div>
          </Card>
          <Card title="Bots on this pair">{data.bots.length ? <ul className="divide-y divide-border">{data.bots.map((b) => <li key={b.id} className="px-4 py-2.5 flex items-center gap-2 text-sm"><Link href={`/bots/${b.id}`} className="flex-1 min-w-0 truncate hover:text-accent">{b.name} <span className="text-xs text-muted">· {b.strategy} · {b.intervalSec}s</span></Link><StatusPill status={b.status} /><BotControls id={b.id} status={b.status} compact /></li>)}</ul> : <Empty>None yet.</Empty>}</Card>
          <Card title="AI suggestions">{data.suggestions.length ? <ul className="divide-y divide-border">{data.suggestions.map((s) => <li key={s.id} className={cls("px-4 py-3 text-xs space-y-1", s.status !== "new" && "opacity-60")}><div className="flex items-center gap-2"><StatusPill status={s.side} /><span className="num">{s.confidence}%</span><span className="text-muted">{s.timeframe}</span><span className="ml-auto text-muted">{fmtAgo(s.createdAt)}</span></div><div className="num text-muted">entry ${fmtDexPrice(s.entry)} · sl ${fmtDexPrice(s.stopLoss)} · tp ${fmtDexPrice(s.takeProfit)}</div><p className="text-muted leading-relaxed">{s.rationale}</p>{s.status === "new" && s.side === "long" ? <div className="flex gap-1.5 pt-1"><button className="btn btn-sm" onClick={() => actSug(s.id, "dismiss")}>Dismiss</button><button className="btn btn-sm btn-up" onClick={() => actSug(s.id, "execute")}>Buy ${size}</button></div> : s.status !== "new" && <StatusPill status={s.status} />}</li>)}</ul> : <Empty>Run an AI deep dive.</Empty>}</Card>
          <Card title="Transactions"><table className="tbl"><thead><tr><th></th><th className="text-right">Buys</th><th className="text-right">Sells</th><th className="text-right">Volume</th></tr></thead><tbody>{(["m5", "h1", "h6", "h24"] as const).map((k) => <tr key={k}><td className="uppercase text-xs text-muted">{k}</td><td className="num text-right text-up">{p.txns[k].buys}</td><td className="num text-right text-down">{p.txns[k].sells}</td><td className="num text-right">{fmtK(p.volume[k])}</td></tr>)}</tbody></table></Card>
        </div>
      </div>
    </>
  );
}
