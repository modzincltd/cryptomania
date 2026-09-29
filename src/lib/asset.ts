import { q, sb, type PositionRow, type SuggestionRow } from "./db";
import { fetchCandles, fetchTickers, ensureMarkets } from "./exchange";
import { atr, bollinger, ema, macd, rsi, sma, last, round } from "./indicators";
import { getGlobal } from "./settings";
import { listBots } from "./bots";
import { getFavourites } from "./favourites";
import { coinName } from "./symbol";
import { withLivePnl } from "./portfolio";

export async function assetOverview(symbol: string) {
  const g = await getGlobal();
  const ex = await ensureMarkets();
  if (!ex.markets?.[symbol]) throw new Error(`Unknown market ${symbol}`);
  const [tickers, h1, h4, d1] = await Promise.all([fetchTickers(g.quote), fetchCandles(symbol, "1h", 200, 60_000), fetchCandles(symbol, "4h", 200, 60_000), fetchCandles(symbol, "1d", 120, 300_000)]);
  const t = tickers[symbol];
  const price = t?.last ?? last(h1).close;
  const ind = (candles: typeof h1) => {
    const c = candles.map((x) => x.close);
    const b = bollinger(c, 20, 2), m = macd(c);
    return {
      rsi: round(last(rsi(c, 14)), 1), ema20: round(last(ema(c, 20)), 6), ema50: round(last(ema(c, 50)), 6), ema200: round(last(ema(c, 200)), 6),
      atrPct: round((last(atr(candles, 14)) / price) * 100, 2), pctB: round((price - last(b.lower)) / (last(b.upper) - last(b.lower)), 2),
      macdHist: round(last(m.hist), 6), volRatio: round(last(candles.map((x) => x.volume), 2) / (last(sma(candles.map((x) => x.volume), 24), 3) || 1), 2),
    };
  };
  const week = h1.slice(-168), month = d1.slice(-30);
  const perf = {
    h24: t?.changePct ?? null,
    d7: round(((price - week[0].open) / week[0].open) * 100, 2),
    d30: month.length ? round(((price - month[0].open) / month[0].open) * 100, 2) : null,
    high7d: Math.max(...week.map((c) => c.high)), low7d: Math.min(...week.map((c) => c.low)),
    high30d: Math.max(...month.map((c) => c.high)), low30d: Math.min(...month.map((c) => c.low)),
  };
  const positions = await q<PositionRow[]>(sb.from("positions").select("*").eq("symbol", symbol).is("pairId", null).order("entryAt", { ascending: false }).limit(50));
  const suggestions = await q<SuggestionRow[]>(sb.from("suggestions").select("*").eq("symbol", symbol).is("pairId", null).order("createdAt", { ascending: false }).limit(20));
  const bots = (await listBots()).filter((b) => b.symbol === symbol && !b.pairId);
  return {
    symbol, name: coinName(symbol), price, ticker: t ?? null, favourite: (await getFavourites()).includes(symbol),
    indicators: { h1: ind(h1), h4: ind(h4), d1: ind(d1) }, perf,
    spark: h1.slice(-96).map((c) => ({ t: c.ts, v: c.close })),
    positions: await withLivePnl(positions), suggestions, bots,
    tvSymbol: `${process.env.EXCHANGE?.toUpperCase() || "BINANCE"}:${symbol.replace("/", "")}`,
  };
}
