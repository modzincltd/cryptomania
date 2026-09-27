"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api, refresh, useApi } from "@/lib/client";
import { Card, PageHeader, Empty } from "@/components/ui";
import { DexTable, fmtDexPrice } from "@/components/dex-table";
import { useFavourites } from "@/components/symbol";
import type { DexPair, DexFilters } from "@/lib/dex";
import { cls } from "@/lib/format";

export default function DexPage() {
  const [tab, setTab] = useState<"trending" | "new" | "search" | "favourites">("trending");
  const [q, setQ] = useState(""); const [qs, setQs] = useState("");
  const [hideFlagged, setHideFlagged] = useState(true);
  const { favs } = useFavourites();
  const url = tab === "search" ? (qs ? `/api/dex?tab=search&q=${encodeURIComponent(qs)}` : null) : `/api/dex?tab=${tab}`;
  const { data, error, isLoading } = useApi<DexPair[]>(url, 30000);
  const favIds = favs.filter((f) => f.includes(":"));
  const { data: filters, mutate: mutF } = useApi<DexFilters>("/api/dex/filters", 0);
  const { data: engine } = useApi<{ aiKey: boolean }>("/api/engine", 0);
  const [buy, setBuy] = useState<DexPair | null>(null);
  const [size, setSize] = useState(100); const [sl, setSl] = useState(15); const [tp, setTp] = useState(40); const [trail, setTrail] = useState(12);
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const doBuy = async () => { if (!buy) return; setBusy("buy"); try { await api("/api/trade", "POST", { symbol: buy.symbol, pairId: buy.pairId, notionalUsd: size, stopLossPct: sl, takeProfitPct: tp, trailingStopPct: trail }); await refresh("/api"); setBuy(null); setMsg(`Paper bought ${buy.symbol}`); } catch (e) { alert((e as Error).message); } finally { setBusy(null); } };
  const scan = async () => { setBusy("scan"); setMsg(null); try { const r = await api<{ suggestions: unknown[] }>("/api/dex/scan"); setMsg(`AI DEX scan done — ${r.suggestions.length} suggestions, see AI Scanner`); await refresh("/api"); } catch (e) { alert((e as Error).message); } finally { setBusy(null); } };
  const saveFilters = async (patch: Partial<DexFilters>) => { await mutF(api<DexFilters>("/api/dex/filters", "PATCH", patch), { optimisticData: { ...filters!, ...patch }, revalidate: false }); await refresh("/api/dex?"); };

  const pairs = data ?? [];
  return (
    <>
      <PageHeader title="DEX" sub="Trending & new pairs across Solana / Base / ETH / BSC via DexScreener. Paper trading with realistic slippage; live swaps come in phase 2.">
        <button className="btn" onClick={() => setShowFilters(!showFilters)}>Safety filters</button>
        <button className="btn btn-primary" disabled={busy === "scan" || !engine?.aiKey} onClick={scan}><Sparkles size={15} /> {busy === "scan" ? "Scanning…" : "AI DEX scan"}</button>
      </PageHeader>
      {msg && <div className="card p-3 mb-4 text-sm text-up">{msg}</div>}
      {showFilters && filters && (
        <Card title="Safety filters (pairs failing these are flagged and can't be bought by bots)" className="mb-4">
          <div className="p-4 grid md:grid-cols-5 gap-3 text-sm">
            <label className="block"><span className="label">Min liquidity $</span><input type="number" className="input num" defaultValue={filters.minLiqUsd} onBlur={(e) => saveFilters({ minLiqUsd: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Min age (min)</span><input type="number" className="input num" defaultValue={filters.minAgeMin} onBlur={(e) => saveFilters({ minAgeMin: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Min 24h volume $</span><input type="number" className="input num" defaultValue={filters.minVol24h} onBlur={(e) => saveFilters({ minVol24h: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Max age (days, 0=any)</span><input type="number" className="input num" defaultValue={filters.maxAgeDays} onBlur={(e) => saveFilters({ maxAgeDays: Number(e.target.value) })} /></label>
            <div><span className="label">Chains</span><div className="flex flex-wrap gap-1.5">{["solana", "base", "ethereum", "bsc", "arbitrum", "sui", "ton"].map((c) => <button key={c} className={cls("btn btn-sm", filters.chains.includes(c) && "btn-primary")} onClick={() => saveFilters({ chains: filters.chains.includes(c) ? filters.chains.filter((x) => x !== c) : [...filters.chains, c] })}>{c}</button>)}</div></div>
          </div>
        </Card>
      )}
      <div className="grid xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-3">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-wrap">
            {(["trending", "new", "favourites", "search"] as const).map((t) => <button key={t} className={cls("btn btn-sm capitalize", tab === t && "btn-primary")} onClick={() => setTab(t)}>{t}</button>)}
            {tab === "search" && <form className="flex gap-2 ml-2" onSubmit={(e) => { e.preventDefault(); setQs(q); }}><input className="input !w-64" placeholder="Token name, symbol or address" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-sm">Search</button></form>}
            <label className="ml-auto text-xs text-muted flex items-center gap-2"><input type="checkbox" checked={hideFlagged} onChange={(e) => setHideFlagged(e.target.checked)} /> hide flagged</label>
          </div>
          {error ? <Empty><span className="text-down">{error.message}</span></Empty> : isLoading && !data ? <Empty>Loading…</Empty> : tab === "favourites" && !favIds.length ? <Empty>Star some DEX pairs first.</Empty> : <DexTable pairs={pairs} onBuy={setBuy} hideFlagged={hideFlagged} />}
        </Card>
        <Card title={buy ? `Paper buy · ${buy.symbol}` : "Paper buy"}>
          {!buy ? <Empty>Pick a pair. Fills simulate price impact from pool liquidity plus ~0.6% fees. Exits (stop / target / trailing / rug guard) are enforced by the engine.</Empty> : (
            <div className="p-4 space-y-3 text-sm">
              <div className="num text-lg">${fmtDexPrice(buy.priceUsd)} <span className="text-xs text-muted">liq ${(buy.liquidityUsd / 1000).toFixed(0)}k</span></div>
              {buy.flags.length > 0 && <div className="text-xs text-warn">⚠ {buy.flags.join(" · ")}</div>}
              <label className="block"><span className="label">Size $</span><input type="number" className="input num" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block"><span className="label">Stop %</span><input type="number" className="input num" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Target %</span><input type="number" className="input num" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></label>
                <label className="block"><span className="label">Trail %</span><input type="number" className="input num" value={trail} onChange={(e) => setTrail(Number(e.target.value))} /></label>
              </div>
              <div className="text-xs text-muted num">Est. impact {(Math.min(25, (size / (buy.liquidityUsd / 2 + size)) * 100)).toFixed(2)}% each way</div>
              <div className="flex gap-2"><button className="btn flex-1" onClick={() => setBuy(null)}>Cancel</button><button className="btn btn-primary flex-1" disabled={busy === "buy"} onClick={doBuy}>Paper buy</button></div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
