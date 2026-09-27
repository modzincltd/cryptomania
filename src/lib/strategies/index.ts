import type { Candle, Signal, Strategy, StrategyId } from "../types";
import { ema, rsi, bollinger, macd, sma, last, round } from "../indicators";

const closes = (c: Candle[]) => c.map((x) => x.close);

const rsiStrategy: Strategy = {
  id: "rsi",
  name: "RSI Mean Reversion",
  description: "Buys when RSI crosses back above the oversold level, sells when it crosses below overbought.",
  defaultParams: { period: 14, oversold: 30, overbought: 70 },
  paramLabels: { period: "RSI period", oversold: "Oversold level", overbought: "Overbought level" },
  minCandles: 50,
  evaluate(candles, p) {
    const r = rsi(closes(candles), p.period);
    const cur = last(r), prev = last(r, 2);
    const ind = { rsi: round(cur, 1), rsiPrev: round(prev, 1) };
    if (prev < p.oversold && cur >= p.oversold) return { action: "buy", reason: `RSI crossed up through ${p.oversold} (${ind.rsi})`, indicators: ind, strength: Math.min(1, (p.oversold - Math.min(prev, cur)) / 15 + 0.4) };
    if (prev > p.overbought && cur <= p.overbought) return { action: "sell", reason: `RSI crossed down through ${p.overbought} (${ind.rsi})`, indicators: ind };
    if (cur > p.overbought) return { action: "sell", reason: `RSI overbought (${ind.rsi})`, indicators: ind };
    return { action: "hold", reason: `RSI ${ind.rsi}`, indicators: ind };
  },
};

const emaCross: Strategy = {
  id: "ema_cross",
  name: "EMA Crossover",
  description: "Trend following: buys when fast EMA crosses above slow EMA, sells on the cross back down.",
  defaultParams: { fast: 9, slow: 21 },
  paramLabels: { fast: "Fast EMA", slow: "Slow EMA" },
  minCandles: 60,
  evaluate(candles, p) {
    const c = closes(candles);
    const f = ema(c, p.fast), s = ema(c, p.slow);
    const ind = { emaFast: round(last(f), 4), emaSlow: round(last(s), 4), spreadPct: round(((last(f) - last(s)) / last(s)) * 100, 3) };
    const crossUp = last(f, 2) <= last(s, 2) && last(f) > last(s);
    const crossDown = last(f, 2) >= last(s, 2) && last(f) < last(s);
    if (crossUp) return { action: "buy", reason: `EMA${p.fast} crossed above EMA${p.slow}`, indicators: ind, strength: 0.7 };
    if (crossDown) return { action: "sell", reason: `EMA${p.fast} crossed below EMA${p.slow}`, indicators: ind };
    return { action: "hold", reason: last(f) > last(s) ? "Uptrend, holding" : "Downtrend, waiting", indicators: ind };
  },
};

const bollingerStrategy: Strategy = {
  id: "bollinger",
  name: "Bollinger Bounce",
  description: "Buys when price closes back inside the lower band after a dip below it; sells at the middle or upper band.",
  defaultParams: { period: 20, mult: 2 },
  paramLabels: { period: "Period", mult: "Std-dev multiplier" },
  minCandles: 50,
  evaluate(candles, p) {
    const c = closes(candles);
    const b = bollinger(c, p.period, p.mult);
    const price = last(c), prev = last(c, 2);
    const ind = { upper: round(last(b.upper), 4), mid: round(last(b.mid), 4), lower: round(last(b.lower), 4), pctB: round((price - last(b.lower)) / (last(b.upper) - last(b.lower)), 3) };
    if (prev < last(b.lower, 2) && price >= last(b.lower)) return { action: "buy", reason: "Price re-entered lower band", indicators: ind, strength: 0.65 };
    if (price >= last(b.upper)) return { action: "sell", reason: "Price at upper band", indicators: ind };
    if (prev < last(b.mid, 2) && price >= last(b.mid)) return { action: "sell", reason: "Price reached middle band", indicators: ind };
    return { action: "hold", reason: `%B ${ind.pctB}`, indicators: ind };
  },
};

const breakout: Strategy = {
  id: "breakout",
  name: "Donchian Breakout",
  description: "Buys a close above the N-period high on above-average volume; exits on a close below the M-period low.",
  defaultParams: { entryPeriod: 20, exitPeriod: 10, volumeMult: 1.2 },
  paramLabels: { entryPeriod: "Entry lookback", exitPeriod: "Exit lookback", volumeMult: "Volume multiple" },
  minCandles: 60,
  evaluate(candles, p) {
    const n = candles.length;
    const cur = candles[n - 1];
    const entryWindow = candles.slice(n - 1 - p.entryPeriod, n - 1);
    const exitWindow = candles.slice(n - 1 - p.exitPeriod, n - 1);
    const hh = Math.max(...entryWindow.map((c) => c.high));
    const ll = Math.min(...exitWindow.map((c) => c.low));
    const volAvg = last(sma(candles.map((c) => c.volume), 20), 2);
    const volRatio = cur.volume / (volAvg || 1);
    const ind = { high: round(hh, 4), low: round(ll, 4), volRatio: round(volRatio, 2) };
    if (cur.close > hh && volRatio >= p.volumeMult) return { action: "buy", reason: `Breakout above ${p.entryPeriod}-bar high on ${ind.volRatio}x volume`, indicators: ind, strength: Math.min(1, 0.5 + volRatio / 5) };
    if (cur.close < ll) return { action: "sell", reason: `Close below ${p.exitPeriod}-bar low`, indicators: ind };
    return { action: "hold", reason: "Inside range", indicators: ind };
  },
};

const macdStrategy: Strategy = {
  id: "macd",
  name: "MACD Momentum",
  description: "Buys when the MACD histogram turns positive with price above the 50 EMA; sells when it turns negative.",
  defaultParams: { fast: 12, slow: 26, signal: 9, trendEma: 50 },
  paramLabels: { fast: "Fast", slow: "Slow", signal: "Signal", trendEma: "Trend filter EMA" },
  minCandles: 100,
  evaluate(candles, p) {
    const c = closes(candles);
    const m = macd(c, p.fast, p.slow, p.signal);
    const t = ema(c, p.trendEma);
    const h = last(m.hist), hp = last(m.hist, 2);
    const ind = { macd: round(last(m.line), 5), signal: round(last(m.signal), 5), hist: round(h, 5), aboveTrend: last(c) > last(t) };
    if (hp <= 0 && h > 0 && ind.aboveTrend) return { action: "buy", reason: "MACD histogram turned positive above trend EMA", indicators: ind, strength: 0.6 };
    if (hp >= 0 && h < 0) return { action: "sell", reason: "MACD histogram turned negative", indicators: ind };
    return { action: "hold", reason: h > 0 ? "Momentum positive" : "Momentum negative", indicators: ind };
  },
};

export const STRATEGIES: Partial<Record<StrategyId, Strategy>> & Record<string, Strategy> = {
  rsi: rsiStrategy,
  ema_cross: emaCross,
  bollinger: bollingerStrategy,
  breakout,
  macd: macdStrategy,
};

export const STRATEGY_LIST = Object.values(STRATEGIES).map(({ id, name, description, defaultParams, paramLabels }) => ({ id, name, description, defaultParams, paramLabels }));

export function getStrategy(id: string): Strategy {
  const s = STRATEGIES[id as StrategyId];
  if (!s) throw new Error(`Unknown strategy ${id}`);
  return s;
}
