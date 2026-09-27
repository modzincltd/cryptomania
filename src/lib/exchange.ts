import ccxt, { type Exchange } from "ccxt";
import type { Candle, Timeframe } from "./types";

const EXCHANGE_ID = process.env.EXCHANGE || "binance";

declare global {
  // eslint-disable-next-line no-var
  var __cm_ex: { pub?: Exchange; priv?: Exchange } | undefined;
}
if (!globalThis.__cm_ex) globalThis.__cm_ex = {};

function make(withKeys: boolean): Exchange {
  const Ctor = (ccxt as unknown as Record<string, new (cfg: Record<string, unknown>) => Exchange>)[EXCHANGE_ID];
  if (!Ctor) throw new Error(`Unknown exchange ${EXCHANGE_ID}`);
  const cfg: Record<string, unknown> = { enableRateLimit: true, options: { defaultType: "spot" } };
  if (withKeys) {
    cfg.apiKey = process.env.EXCHANGE_API_KEY;
    cfg.secret = process.env.EXCHANGE_API_SECRET;
    if (process.env.EXCHANGE_API_PASSWORD) cfg.password = process.env.EXCHANGE_API_PASSWORD;
  }
  return new Ctor(cfg);
}

export function publicExchange(): Exchange {
  if (!globalThis.__cm_ex!.pub) globalThis.__cm_ex!.pub = make(false);
  return globalThis.__cm_ex!.pub;
}

export function privateExchange(): Exchange {
  if (!hasLiveKeys()) throw new Error("Live trading requires EXCHANGE_API_KEY and EXCHANGE_API_SECRET in .env");
  if (!globalThis.__cm_ex!.priv) globalThis.__cm_ex!.priv = make(true);
  return globalThis.__cm_ex!.priv;
}

export function hasLiveKeys() {
  return !!(process.env.EXCHANGE_API_KEY && process.env.EXCHANGE_API_SECRET);
}
export function exchangeId() { return EXCHANGE_ID; }

let marketsLoaded = false;
export async function ensureMarkets() {
  const ex = publicExchange();
  if (!marketsLoaded) { await ex.loadMarkets(); marketsLoaded = true; }
  return ex;
}

// --- small in-memory caches so multiple bots on the same symbol don't hammer the API ---
const ohlcvCache = new Map<string, { at: number; data: Candle[] }>();
const tickerCache: { at: number; data: Record<string, TickerLite> } = { at: 0, data: {} };

export interface TickerLite {
  symbol: string; last: number; changePct: number; high: number; low: number; quoteVolume: number; bid?: number; ask?: number;
}

export async function fetchCandles(symbol: string, timeframe: Timeframe, limit = 200, maxAgeMs = 15_000): Promise<Candle[]> {
  const key = `${symbol}:${timeframe}:${limit}`;
  const hit = ohlcvCache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  const ex = await ensureMarkets();
  const raw = await ex.fetchOHLCV(symbol, timeframe, undefined, limit);
  const data: Candle[] = raw.map((r) => ({ ts: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) }));
  ohlcvCache.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchTickers(quote = "USDT", maxAgeMs = 10_000): Promise<Record<string, TickerLite>> {
  if (Date.now() - tickerCache.at < maxAgeMs && Object.keys(tickerCache.data).length) return tickerCache.data;
  const ex = await ensureMarkets();
  const all = await ex.fetchTickers();
  const out: Record<string, TickerLite> = {};
  for (const [sym, t] of Object.entries(all)) {
    const m = ex.markets?.[sym];
    if (!m || !m.spot || !m.active || m.quote !== quote) continue;
    if (!t.last) continue;
    out[sym] = {
      symbol: sym, last: Number(t.last), changePct: Number(t.percentage ?? 0), high: Number(t.high ?? 0), low: Number(t.low ?? 0),
      quoteVolume: Number(t.quoteVolume ?? 0), bid: t.bid ? Number(t.bid) : undefined, ask: t.ask ? Number(t.ask) : undefined,
    };
  }
  tickerCache.at = Date.now(); tickerCache.data = out;
  return out;
}

export async function fetchPrice(symbol: string): Promise<number> {
  const ex = await ensureMarkets();
  const t = await ex.fetchTicker(symbol);
  return Number(t.last);
}

const STABLES = new Set(["USDT", "USDC", "BUSD", "TUSD", "FDUSD", "DAI", "USDP", "EUR", "GBP", "TRY", "BRL", "PAXG", "USD1", "USDE", "XUSD"]);
export async function topSymbols(quote = "USDT", n = 30): Promise<TickerLite[]> {
  const tickers = await fetchTickers(quote);
  return Object.values(tickers)
    .filter((t) => !STABLES.has(t.symbol.split("/")[0]) && !/UP\/|DOWN\/|BULL\/|BEAR\//.test(t.symbol))
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, n);
}

export async function marketPrecision(symbol: string) {
  const ex = await ensureMarkets();
  const m = ex.markets?.[symbol];
  return { amountToPrecision: (q: number) => Number(ex.amountToPrecision(symbol, q)), minCost: m?.limits?.cost?.min ?? 0, minAmount: m?.limits?.amount?.min ?? 0 };
}
