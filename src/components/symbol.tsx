"use client";
import Link from "next/link";
import { Star } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { cls } from "@/lib/format";
import { symToSlug } from "@/lib/symbol";

export function useFavourites() {
  const { data, mutate } = useApi<string[]>("/api/favourites", 0);
  const favs = data ?? [];
  const toggle = async (symbol: string) => {
    const s = symbol.toUpperCase();
    const optimistic = favs.includes(s) ? favs.filter((x) => x !== s) : [...favs, s];
    await mutate(api<string[]>("/api/favourites", "POST", { symbol: s }), { optimisticData: optimistic, revalidate: false });
  };
  return { favs, isFav: (s: string) => favs.includes(s.toUpperCase()), toggle };
}

export function StarToggle({ symbol, size = 14, className }: { symbol: string; size?: number; className?: string }) {
  const { isFav, toggle } = useFavourites();
  const on = isFav(symbol);
  return (
    <button type="button" title={on ? "Remove from favourites" : "Add to favourites"} aria-label="favourite"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(symbol); }}
      className={cls("inline-flex items-center justify-center rounded p-0.5 transition-colors", on ? "text-warn" : "text-muted/50 hover:text-warn", className)}>
      <Star size={size} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

/** Symbol text as a link to its asset page, with a star. Use everywhere a symbol appears. */
export function Sym({ symbol, className, star = true, size = 14 }: { symbol: string; className?: string; star?: boolean; size?: number }) {
  return (
    <span className={cls("inline-flex items-center gap-1", className)}>
      {star && <StarToggle symbol={symbol} size={size} />}
      <Link href={`/asset/${symToSlug(symbol)}`} className="hover:text-accent hover:underline underline-offset-2">{symbol}</Link>
    </span>
  );
}
