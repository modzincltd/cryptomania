"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api, refresh, useApi } from "@/lib/client";
import { Card, Empty, PageHeader, Stat, StatusPill } from "@/components/ui";
import { StarToggle } from "@/components/symbol";
import { TradingViewChart } from "@/components/tradingview";
import { BotControls } from "@/components/bot-controls";
import { slugToSym, symToSlug } from "@/lib/symbol";
import { fmtPct, fmtPrice, fmtTime, fmtUsd, fmtAgo, cls, pnlClass } from "@/lib/format";

interface Ind { rsi: number; ema20: number; ema50: number; ema200: number; atrPct: number; pctB: number; macdHist: number; volRatio: number }
interface Asset {
  symbol: string; name: string; price: number; favourite: boolean; tvSymbol: string;
  ticker: { changePct: number; high: number; low: number; quoteVolume: number; bid?: number; ask?: number } | null;
  indicators: { h1: Ind; h4: Ind; d1: Ind };
  perf: { h24: number | null; d7: number; d30: number | null; high7d: number; low7d: number; high30d: number; low30d: number };
  positions: { id: number; entryAt: number; entryPrice: number; exitPrice: number | null; price: number | null; live: boolean; pnl: number | null; pnlPct: number | null; status: string; exitReason: string | null; source: string; botId: number | null }[];
  suggestions: { id: number; side: string; entry: number; stopLoss: number; takeProfit: number; confidence: number; timeframe: string; rationale: string; status: string; createdAt: number }[];
  bots: { id: number; name: string; strategy: string; status: string; intervalSec: number }[];
}
interface News { title: string; url: string; source: string; publishedAt: number }
interface Analysis { bias: string; thesis: string; keyLevels: { support: number[]; resistance: number[] }; risks: string[]; suggestion: Asset["suggestions"][number] | null; model: string; tokens: number; createdAt: number }

const trend = (i: Ind, price: number) => price > i.ema20 && i.ema20 > i.ema50 ? "strong up" : price > i.ema50 ? "up" : price < i.ema20 && i.ema20 < i.ema50 ? "strong down" : "down";
const tone = (s: string) => s.includes("up") ? "text-up" : s.includes("down") ? "text-down" : "text-muted";

export default function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = slugToSym(use(params).symbol);
  const slug = symToSlug(symbol);
  const { data: a, error } = useApi<Asset>(`/api/asset/${slug}`, 10000);
  const { data: news } = useApi<News[]>(`/api/asset/${slug}/news`, 10 * 60000);
  const { data: engine } = useApi<{ aiKey: boolean }>("/api/engine", 0);
  const [interval, setInterval] = useState("60");
  const [size, setSize] = useState(250); const [sl, setSl] = useState(2); const [tp, setTp] = useState(4);
  const [busy, setBusy] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);

  if (error) return <div className="text-down">{error.message}</div>;
  if (!a) return <div className="text-muted text-sm">Loading {symbol}…</div>;

  const buy = async () => {
    setBusy("buy");
    try { await api("/api/trade", "POST", { symbol, notionalUsd: size, stopLossPct: sl, takeProfitPct: tp }); await refresh("/api"); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };
  const analyse = async () => {
    setBusy("ai"); setAiErr(null);
    try { setAnalysis(await api<Analysis>(`/api/asset/${slug}/analyse`)); await refresh("/api/asset"); } catch (e) { setAiErr((e as Error).message); } finally { setBusy(null); }
  };
  const actSug = async (id: number, action: string) => {
    try { await api(`/api/suggestions/${id}/${action}`, "POST", { notionalUsd: size }); await refresh("/api"); } catch (e) { alert((e as Error).message); }
  };
  const chg = a.ticker?.changePct ?? 0;
  const rangePos = a.perf.high30d > a.perf.low30d ? ((a.price - a.perf.low30d) / (a.perf.high30d - a.perf.low30d)) * 100 : 50;

  return (
    <>
      <PageHeader title={`${a.name}`} sub={a.symbol}>
        <StarToggle symbol={symbol} size={22} />
        <div className="text-right mr-2"><div className="num text-2xl font-semibold">{fmtPrice(a.price)}</div><div className={cls("num text-sm", chg >= 0 ? "text-up" : "text-down")}>{fmtPct(chg)} 24h</div></div>
        <Link href={`/bots/new?symbol=${encodeURIComponent(symbol)}`} className="btn">+ Bot on this</Link>
        <button className="btn btn-primary" disabled={busy === "ai" || !engine?.aiKey} onClick={analyse}><Sparkles size={15} /> {busy === "ai" ? "Analysing…" : "AI deep dive"}</button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
        <Stat label="7d" value={fmtPct(a.perf.d7)} tone={a.perf.d7 >= 0 ? "up" : "down"} />
        <Stat label="30d" value={fmtPct(a.perf.d30)} tone={(a.perf.d30 ?? 0) >= 0 ? "up" : "down"} />
        <Stat label="24h range" value={`${fmtPrice(a.ticker?.low)} – ${fmtPrice(a.ticker?.high)}`} />
        <Stat label="30d range" value={`${fmtPrice(a.perf.low30d)} – ${fmtPrice(a.perf.high30d)}`} sub={`price at ${rangePos.toFixed(0)}% of range`} />
        <Stat label="24h volume" value={`$${((a.ticker?.quoteVolume ?? 0) / 1e6).toFixed(1)}M`} />
        <Stat label="ATR (1h)" value={`${a.indicators.h1.atrPct}%`} sub="per-candle volatility" />
        <Stat label="Spread" value={a.ticker?.bid && a.ticker?.ask ? `${(((a.ticker.ask - a.ticker.bid) / a.ticker.ask) * 100).toFixed(3)}%` : "—"} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Chart" right={<div className="flex gap-1">{[["15", "15m"], ["60", "1h"], ["240", "4h"], ["D", "1D"]].map(([v, l]) => <button key={v} className={cls("btn btn-sm", interval === v && "btn-primary")} onClick={() => setInterval(v)}>{l}</button>)}</div>}>
            <TradingViewChart symbol={a.tvSymbol} interval={interval} />
          </Card>

          {(analysis || aiErr) && (
            <Card title="AI deep dive" right={analysis && <span className="text-xs text-muted">{analysis.model} · {analysis.tokens} tokens · {fmtAgo(analysis.createdAt)}</span>}>
              {aiErr ? <div className="p-4 text-sm text-down">{aiErr}</div> : analysis && (
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2"><span className={cls("pill", analysis.bias === "bullish" ? "pill-up" : analysis.bias === "bearish" ? "pill-down" : "pill-warn")}>{analysis.bias}</span></div>
                  <p className="leading-relaxed text-text/90">{analysis.thesis}</p>
                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div><div className="label">Support</div><div className="num text-up">{analysis.keyLevels.support.map(fmtPrice).join(" · ") || "—"}</div></div>
                    <div><div className="label">Resistance</div><div className="num text-down">{analysis.keyLevels.resistance.map(fmtPrice).join(" · ") || "—"}</div></div>
                  </div>
                  {analysis.risks.length > 0 && <div><div className="label">Risks</div><ul className="list-disc pl-4 text-muted space-y-0.5">{analysis.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
                </div>
              )}
            </Card>
          )}

          <Card title="Technical snapshot">
            <table className="tbl"><thead><tr><th>Timeframe</th><th>Trend</th><th className="text-right">RSI</th><th className="text-right">EMA 20 / 50 / 200</th><th className="text-right">%B</th><th className="text-right">MACD hist</th><th className="text-right">Vol ratio</th><th className="text-right">ATR%</th></tr></thead>
              <tbody>{(["h1", "h4", "d1"] as const).map((k) => { const i = a.indicators[k]; const t = trend(i, a.price); return (
                <tr key={k}><td className="font-medium">{k.toUpperCase()}</td><td className={cls("font-medium", tone(t))}>{t}</td>
                  <td className={cls("num text-right", i.rsi > 70 ? "text-down" : i.rsi < 30 ? "text-up" : "")}>{i.rsi}</td>
                  <td className="num text-right text-muted">{fmtPrice(i.ema20)} / {fmtPrice(i.ema50)} / {isNaN(i.ema200) ? "—" : fmtPrice(i.ema200)}</td>
                  <td className="num text-right">{i.pctB}</td><td className={cls("num text-right", i.macdHist > 0 ? "text-up" : "text-down")}>{i.macdHist}</td>
                  <td className={cls("num text-right", i.volRatio > 1.5 && "text-warn")}>{i.volRatio}x</td><td className="num text-right">{i.atrPct}%</td></tr>
              ); })}</tbody></table>
          </Card>

          <Card title={`Your history on ${a.symbol}`}>
            {a.positions.length ? (
              <table className="tbl"><thead><tr><th>Opened</th><th>Source</th><th className="text-right">Entry</th><th className="text-right">Exit / Now</th><th className="text-right">PnL</th><th>Reason</th><th></th></tr></thead>
                <tbody>{a.positions.map((p) => (
                  <tr key={p.id}><td className="text-xs text-muted">{fmtTime(p.entryAt)}</td><td className="text-xs text-muted">{p.botId ? <Link className="text-accent" href={`/bots/${p.botId}`}>bot {p.botId}</Link> : p.source}</td><td className="num text-right">{fmtPrice(p.entryPrice)}</td><td className={cls("num text-right", p.live && "text-muted")}>{fmtPrice(p.price)}</td><td className={cls("num text-right", pnlClass(p.pnl))}>{fmtUsd(p.pnl)} ({fmtPct(p.pnlPct)}){p.live && <span className="ml-1 text-[10px] text-accent">live</span>}</td><td className="text-xs text-muted">{p.exitReason ?? "—"}</td><td><StatusPill status={p.status} /></td></tr>
                ))}</tbody></table>
            ) : <Empty>No trades on this asset yet.</Empty>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Quick paper buy">
            <div className="p-4 space-y-3 text-sm">
              <label className="block"><span className="label">Size $</span><input type="number" className="input num" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="label">Stop %</span><input type="number" step={0.1} className="input num" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Target %</span><input type="number" step={0.1} className="input num" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></label>
              </div>
              <div className="text-xs text-muted num">Stop {fmtPrice(a.price * (1 - sl / 100))} · Target {fmtPrice(a.price * (1 + tp / 100))} · ATR-based stop ≈ {(a.indicators.h1.atrPct * 1.5).toFixed(2)}%</div>
              <button className="btn btn-primary w-full" disabled={busy === "buy"} onClick={buy}>Buy ${size}</button>
            </div>
          </Card>

          <Card title="Bots on this asset" right={<Link href={`/bots/new?symbol=${encodeURIComponent(symbol)}`} className="text-xs text-accent">+ new</Link>}>
            {a.bots.length ? <ul className="divide-y divide-border">{a.bots.map((b) => (
              <li key={b.id} className="px-4 py-2.5 flex items-center gap-2 text-sm"><Link href={`/bots/${b.id}`} className="flex-1 min-w-0 truncate hover:text-accent">{b.name} <span className="text-xs text-muted">· {b.strategy} · {b.intervalSec}s</span></Link><StatusPill status={b.status} /><BotControls id={b.id} status={b.status} compact /></li>
            ))}</ul> : <Empty>None yet.</Empty>}
          </Card>

          <Card title="AI suggestions">
            {a.suggestions.length ? <ul className="divide-y divide-border">{a.suggestions.map((s) => (
              <li key={s.id} className={cls("px-4 py-3 text-xs space-y-1", s.status !== "new" && "opacity-60")}>
                <div className="flex items-center gap-2"><StatusPill status={s.side} /><span className="num">{s.confidence}%</span><span className="text-muted">{s.timeframe}</span><span className="ml-auto text-muted">{fmtAgo(s.createdAt)}</span></div>
                <div className="num text-muted">entry {fmtPrice(s.entry)} · sl {fmtPrice(s.stopLoss)} · tp {fmtPrice(s.takeProfit)}</div>
                <p className="text-muted leading-relaxed">{s.rationale}</p>
                {s.status === "new" && s.side === "long" ? <div className="flex gap-1.5 pt-1"><button className="btn btn-sm" onClick={() => actSug(s.id, "dismiss")}>Dismiss</button><button className="btn btn-sm btn-up" onClick={() => actSug(s.id, "execute")}>Buy ${size}</button></div> : s.status !== "new" && <StatusPill status={s.status} />}
              </li>
            ))}</ul> : <Empty>Run an AI deep dive or market scan.</Empty>}
          </Card>

          <Card title="News" right={<span className="text-xs text-muted">last 7 days</span>}>
            {!news ? <Empty>Loading…</Empty> : !news.length ? <Empty>Nothing found.</Empty> : (
              <ul className="divide-y divide-border max-h-[560px] overflow-auto">{news.map((n, i) => (
                <li key={i} className="px-4 py-2.5"><a href={n.url} target="_blank" rel="noreferrer" className="text-sm hover:text-accent leading-snug block">{n.title}</a><div className="text-[11px] text-muted mt-0.5">{n.source} · {fmtAgo(n.publishedAt)}</div></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
