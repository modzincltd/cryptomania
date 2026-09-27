"use client";
import { useState } from "react";
import Link from "next/link";
import { cls, fmtPct } from "@/lib/format";
import { StarToggle } from "./symbol";
import { Empty } from "./ui";
import type { DexPair } from "@/lib/dex";

const fmtP = (v: number) => v >= 1 ? v.toFixed(v >= 1000 ? 0 : 3) : v >= 0.001 ? v.toFixed(5) : v.toExponential(2);
const fmtK = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}k` : `$${v.toFixed(0)}`;
const fmtAge = (m: number) => !m ? "?" : m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(1)}d`;
export const Chg = ({ v }: { v: number }) => <span className={cls("num", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted")}>{fmtPct(v, 1)}</span>;
export const CHAIN_COLORS: Record<string, string> = { solana: "bg-[#9945FF]/20 text-[#c79bff]", base: "bg-[#0052FF]/20 text-[#7aa2ff]", ethereum: "bg-[#627EEA]/20 text-[#a3b4ff]", bsc: "bg-[#F3BA2F]/20 text-[#ffd76a]" };
export const ChainPill = ({ c }: { c: string }) => <span className={cls("pill", CHAIN_COLORS[c] ?? "pill-muted")}>{c}</span>;

type Key = "score" | "symbol" | "priceUsd" | "m5" | "h1" | "h6" | "h24" | "liquidityUsd" | "h24vol" | "buyRatio" | "ageMin";
const val = (p: DexPair, k: Key): number | string => k === "m5" || k === "h1" || k === "h6" || k === "h24" ? p.change[k] : k === "h24vol" ? p.volume.h24 : k === "buyRatio" ? (p.txns.h1.buys + p.txns.h1.sells ? p.txns.h1.buys / (p.txns.h1.buys + p.txns.h1.sells) : 0.5) : p[k];

export function DexTable({ pairs, onBuy, hideFlagged }: { pairs: DexPair[]; onBuy?: (p: DexPair) => void; hideFlagged?: boolean }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const th = (key: Key, label: string, right = true) => <th className={cls("cursor-pointer select-none hover:text-text whitespace-nowrap", right && "text-right")} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "symbol" ? 1 : -1 }))}>{label}{sort.key === key && <span className="ml-1 text-accent">{sort.dir === 1 ? "▲" : "▼"}</span>}</th>;
  const rows = pairs.filter((p) => !hideFlagged || p.tradable).sort((a, b) => { const x = val(a, sort.key), y = val(b, sort.key); return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir; });
  if (!rows.length) return <Empty>Nothing matches.</Empty>;
  return (
    <div className="overflow-x-auto"><table className="tbl">
      <thead><tr><th></th>{th("symbol", "Token", false)}<th>Chain</th>{th("priceUsd", "Price")}{th("m5", "5m")}{th("h1", "1h")}{th("h6", "6h")}{th("h24", "24h")}{th("liquidityUsd", "Liq")}{th("h24vol", "Vol 24h")}{th("buyRatio", "Buys 1h")}{th("ageMin", "Age")}{th("score", "Score")}<th>Flags</th><th></th></tr></thead>
      <tbody>{rows.map((p) => { const br = val(p, "buyRatio") as number; return (
        <tr key={p.pairId} className={cls(!p.tradable && "opacity-60")}>
          <td><StarToggle symbol={p.pairId} /></td>
          <td><Link href={`/dex/${p.chainId}/${p.pairAddress}`} className="font-medium hover:text-accent">{p.baseSymbol}</Link><span className="text-muted text-xs">/{p.quoteSymbol}</span><div className="text-[11px] text-muted truncate max-w-[140px]">{p.baseName}</div></td>
          <td><ChainPill c={p.chainId} /></td>
          <td className="num text-right">${fmtP(p.priceUsd)}</td>
          <td className="text-right"><Chg v={p.change.m5} /></td><td className="text-right"><Chg v={p.change.h1} /></td><td className="text-right"><Chg v={p.change.h6} /></td><td className="text-right"><Chg v={p.change.h24} /></td>
          <td className="num text-right">{fmtK(p.liquidityUsd)}</td><td className="num text-right text-muted">{fmtK(p.volume.h24)}</td>
          <td className="text-right"><div className="inline-flex items-center gap-1.5"><div className="w-14 h-1.5 rounded bg-down/40 overflow-hidden"><div className="h-full bg-up" style={{ width: `${br * 100}%` }} /></div><span className="num text-xs">{Math.round(br * 100)}%</span></div></td>
          <td className="num text-right text-muted">{fmtAge(p.ageMin)}</td>
          <td className="text-right"><span className={cls("num font-semibold", p.score >= 65 ? "text-up" : p.score >= 45 ? "text-warn" : "text-down")}>{p.score}</span></td>
          <td className="text-[11px] text-warn max-w-[160px] leading-tight">{p.flags.slice(0, 2).join(" · ")}{p.flags.length > 2 && ` +${p.flags.length - 2}`}</td>
          <td className="text-right whitespace-nowrap">{onBuy && <button className="btn btn-sm btn-up" disabled={!p.tradable} onClick={() => onBuy(p)}>Buy</button>}</td>
        </tr>); })}</tbody>
    </table></div>
  );
}
export { fmtP as fmtDexPrice, fmtK, fmtAge };
