import { getSetting } from "./settings";

export interface DexPair {
  pairId: string; // chain:pairAddress
  chainId: string; dexId: string; pairAddress: string;
  symbol: string; // e.g. WIF/SOL
  baseSymbol: string; baseName: string; baseAddress: string; quoteSymbol: string;
  priceUsd: number; priceNative: number;
  change: { m5: number; h1: number; h6: number; h24: number };
  volume: { m5: number; h1: number; h6: number; h24: number };
  txns: { m5: { buys: number; sells: number }; h1: { buys: number; sells: number }; h6: { buys: number; sells: number }; h24: { buys: number; sells: number } };
  liquidityUsd: number; fdv: number; marketCap: number;
  ageMin: number; createdAt: number | null;
  url: string; imageUrl?: string; hasSocials: boolean; boosts: number;
  score: number; flags: string[]; tradable: boolean;
}

export interface DexFilters { chains: string[]; minLiqUsd: number; minAgeMin: number; minVol24h: number; maxAgeDays: number }
export const DEFAULT_DEX_FILTERS: DexFilters = { chains: ["solana", "base", "ethereum", "bsc"], minLiqUsd: 50_000, minAgeMin: 60, minVol24h: 100_000, maxAgeDays: 0 };
export async function getDexFilters(): Promise<DexFilters> { return { ...DEFAULT_DEX_FILTERS, ...(await getSetting<Partial<DexFilters>>("dex_filters", {})) }; }

const H = { headers: { "user-agent": "Mozilla/5.0 CryptoMania/1.0", accept: "application/json" } };
const BASE = "https://api.dexscreener.com";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...H, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`DexScreener ${r.status} ${path}`);
  return r.json() as Promise<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function normalize(p: Raw, filters: DexFilters): DexPair {
  const n = (v: unknown) => (v == null || isNaN(Number(v)) ? 0 : Number(v));
  const tx = (k: string) => ({ buys: n(p.txns?.[k]?.buys), sells: n(p.txns?.[k]?.sells) });
  const createdAt = p.pairCreatedAt ? Number(p.pairCreatedAt) : null;
  const ageMin = createdAt ? (Date.now() - createdAt) / 60_000 : 0;
  const liq = n(p.liquidity?.usd);
  const vol24 = n(p.volume?.h24), vol1 = n(p.volume?.h1);
  const h1 = tx("h1"), h24 = tx("h24");
  const hasSocials = !!(p.info?.socials?.length || p.info?.websites?.length);
  const boosts = n(p.boosts?.active);
  const flags: string[] = [];
  if (liq < filters.minLiqUsd) flags.push("low liquidity");
  if (createdAt && ageMin < filters.minAgeMin) flags.push("very new");
  if (!createdAt) flags.push("unknown age");
  if (vol24 < filters.minVol24h) flags.push("low volume");
  if (liq > 0 && vol24 / liq > 25) flags.push("vol/liq extreme (wash?)");
  if (h24.buys + h24.sells > 50 && h24.sells > 0 && h24.buys / h24.sells > 6) flags.push("buy-heavy (honeypot?)");
  if (h1.buys + h1.sells > 20 && h1.buys > 0 && h1.sells / h1.buys > 3) flags.push("heavy selling");
  if (!hasSocials) flags.push("no socials");
  if (n(p.priceChange?.h24) > 500) flags.push("+500% 24h (chase risk)");
  if (filters.maxAgeDays > 0 && ageMin > filters.maxAgeDays * 1440) flags.push("older than filter");
  const hard = flags.some((f) => /low liquidity|very new|honeypot|older than/.test(f));

  // momentum/quality score 0-100
  let score = 50;
  score += Math.max(-15, Math.min(15, n(p.priceChange?.h1) / 2));
  score += Math.max(-10, Math.min(10, n(p.priceChange?.h6) / 5));
  if (liq > 0) score += Math.min(10, (vol1 / liq) * 20);
  if (h1.buys + h1.sells >= 20) score += Math.max(-10, Math.min(10, ((h1.buys - h1.sells) / (h1.buys + h1.sells)) * 20));
  if (liq >= 250_000) score += 5; if (liq >= 1_000_000) score += 5;
  if (hasSocials) score += 3; score += Math.min(5, boosts / 20);
  score -= flags.length * 4;
  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    pairId: `${p.chainId}:${p.pairAddress}`, chainId: p.chainId, dexId: p.dexId, pairAddress: p.pairAddress,
    symbol: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`, baseSymbol: p.baseToken?.symbol ?? "?", baseName: p.baseToken?.name ?? "", baseAddress: p.baseToken?.address ?? "", quoteSymbol: p.quoteToken?.symbol ?? "?",
    priceUsd: n(p.priceUsd), priceNative: n(p.priceNative),
    change: { m5: n(p.priceChange?.m5), h1: n(p.priceChange?.h1), h6: n(p.priceChange?.h6), h24: n(p.priceChange?.h24) },
    volume: { m5: n(p.volume?.m5), h1: vol1, h6: n(p.volume?.h6), h24: vol24 },
    txns: { m5: tx("m5"), h1, h6: tx("h6"), h24 },
    liquidityUsd: liq, fdv: n(p.fdv), marketCap: n(p.marketCap), ageMin, createdAt,
    url: p.url, imageUrl: p.info?.imageUrl, hasSocials, boosts, score, flags, tradable: !hard,
  };
}

const pairCache = new Map<string, { at: number; p: DexPair }>();
function remember(p: DexPair) { pairCache.set(p.pairId, { at: Date.now(), p }); return p; }

export async function dexPairsByTokens(chain: string, addresses: string[]): Promise<DexPair[]> {
  const f = await getDexFilters(); const out: DexPair[] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    const batch = addresses.slice(i, i + 30);
    const raw = await getJson<Raw[]>(`/tokens/v1/${chain}/${batch.join(",")}`).catch(() => []);
    out.push(...raw.map((r) => normalize(r, f)));
  }
  return out.map(remember);
}

/** Best (most liquid) pair per base token. */
function bestPerToken(pairs: DexPair[]) {
  const m = new Map<string, DexPair>();
  for (const p of pairs) { const k = `${p.chainId}:${p.baseAddress}`; if (!m.has(k) || m.get(k)!.liquidityUsd < p.liquidityUsd) m.set(k, p); }
  return [...m.values()];
}

export async function dexTrending(): Promise<DexPair[]> {
  const f = await getDexFilters();
  const [boosted, top] = await Promise.all([getJson<Raw[]>("/token-boosts/latest/v1").catch(() => []), getJson<Raw[]>("/token-boosts/top/v1").catch(() => [])]);
  const byChain = new Map<string, Set<string>>();
  for (const t of [...top, ...boosted]) { if (!f.chains.includes(t.chainId)) continue; if (!byChain.has(t.chainId)) byChain.set(t.chainId, new Set()); byChain.get(t.chainId)!.add(t.tokenAddress); }
  const all = (await Promise.all([...byChain.entries()].map(([c, s]) => dexPairsByTokens(c, [...s].slice(0, 60))))).flat();
  return bestPerToken(all).sort((a, b) => b.score - a.score);
}

export async function dexNew(): Promise<DexPair[]> {
  const f = await getDexFilters();
  const profiles = await getJson<Raw[]>("/token-profiles/latest/v1").catch(() => []);
  const byChain = new Map<string, Set<string>>();
  for (const t of profiles) { if (!f.chains.includes(t.chainId)) continue; if (!byChain.has(t.chainId)) byChain.set(t.chainId, new Set()); byChain.get(t.chainId)!.add(t.tokenAddress); }
  const all = (await Promise.all([...byChain.entries()].map(([c, s]) => dexPairsByTokens(c, [...s])))).flat();
  return bestPerToken(all).sort((a, b) => (a.ageMin || 1e9) - (b.ageMin || 1e9));
}

export async function dexSearch(q: string): Promise<DexPair[]> {
  const f = await getDexFilters();
  const r = await getJson<{ pairs: Raw[] }>(`/latest/dex/search?q=${encodeURIComponent(q)}`);
  return (r.pairs ?? []).filter((p) => f.chains.includes(p.chainId)).map((p) => remember(normalize(p, f))).sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 40);
}

export async function dexPair(pairId: string, maxAgeMs = 10_000): Promise<DexPair> {
  const hit = pairCache.get(pairId);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.p;
  const [chain, addr] = pairId.split(":");
  const r = await getJson<{ pairs: Raw[] | null; pair?: Raw }>(`/latest/dex/pairs/${chain}/${addr}`);
  const raw = r.pair ?? r.pairs?.[0];
  if (!raw) throw new Error(`Pair ${pairId} not found`);
  return remember(normalize(raw, await getDexFilters()));
}

export async function dexPrices(pairIds: string[]): Promise<Record<string, DexPair>> {
  const out: Record<string, DexPair> = {};
  const byChain = new Map<string, string[]>();
  for (const id of pairIds) { const [c, a] = id.split(":"); if (!byChain.has(c)) byChain.set(c, []); byChain.get(c)!.push(a); }
  for (const [chain, addrs] of byChain) {
    for (let i = 0; i < addrs.length; i += 30) {
      const r = await getJson<{ pairs: Raw[] | null }>(`/latest/dex/pairs/${chain}/${addrs.slice(i, i + 30).join(",")}`).catch(() => ({ pairs: [] }));
      const f = await getDexFilters();
      for (const raw of r.pairs ?? []) { const p = remember(normalize(raw, f)); out[p.pairId] = p; }
    }
  }
  return out;
}

/** Constant-product style price impact estimate for a market swap of `notionalUsd` against a pool with `liquidityUsd` total liquidity. */
export function dexSlippagePct(notionalUsd: number, liquidityUsd: number) {
  if (!liquidityUsd) return 5;
  const side = liquidityUsd / 2; // one side of the pool
  return Math.min(25, (notionalUsd / (side + notionalUsd)) * 100);
}
export const DEX_FEE_RATE = 0.006; // ~0.3% pool fee + aggregator/priority fees, round trip counted per leg
export const isDexPair = (pairId?: string | null) => !!pairId && pairId.includes(":");
