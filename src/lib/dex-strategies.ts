import type { DexPair } from "./dex";
import type { Signal } from "./types";

export interface DexStrategy { id: string; name: string; description: string; defaultParams: Record<string, number>; paramLabels: Record<string, string>; evaluate(p: DexPair, params: Record<string, number>, inPosition: boolean): Signal }

const ratio = (b: number, s: number) => (b + s ? b / (b + s) : 0.5);

export const DEX_STRATEGIES: Record<string, DexStrategy> = {
  dex_momentum: {
    id: "dex_momentum", name: "Momentum Rider",
    description: "Buys when the last 5m and 1h are both green with buyers in control and real volume vs liquidity. Exits when 5m momentum flips hard; SL/TP/trailing do the rest.",
    defaultParams: { minM5: 1.5, minH1: 5, minBuyRatioH1: 0.55, minVolLiqH1: 0.15, exitM5: -4 },
    paramLabels: { minM5: "Min 5m %", minH1: "Min 1h %", minBuyRatioH1: "Min buy ratio (1h)", minVolLiqH1: "Min 1h vol / liq", exitM5: "Exit if 5m below %" },
    evaluate(p, x, inPos) {
      const br = ratio(p.txns.h1.buys, p.txns.h1.sells), vl = p.liquidityUsd ? p.volume.h1 / p.liquidityUsd : 0;
      const ind = { m5: p.change.m5, h1: p.change.h1, buyRatioH1: +br.toFixed(2), volLiqH1: +vl.toFixed(2), liq: Math.round(p.liquidityUsd) };
      if (inPos && p.change.m5 <= x.exitM5) return { action: "sell", reason: `5m momentum flipped (${p.change.m5}%)`, indicators: ind };
      if (!inPos && p.change.m5 >= x.minM5 && p.change.h1 >= x.minH1 && br >= x.minBuyRatioH1 && vl >= x.minVolLiqH1) return { action: "buy", reason: `Momentum: 5m +${p.change.m5}%, 1h +${p.change.h1}%, buyers ${Math.round(br * 100)}%`, indicators: ind, strength: Math.min(1, 0.4 + p.change.m5 / 10) };
      return { action: "hold", reason: `5m ${p.change.m5}% · 1h ${p.change.h1}% · buyers ${Math.round(br * 100)}%`, indicators: ind };
    },
  },
  dex_volume_spike: {
    id: "dex_volume_spike", name: "Volume Spike",
    description: "Buys when 1h volume is a multiple of the 6h hourly average and price is green with buyers dominant — catches the start of a run.",
    defaultParams: { spikeMult: 3, minH1: 2, minBuyRatioH1: 0.55, exitM5: -5 },
    paramLabels: { spikeMult: "1h vol vs 6h avg ×", minH1: "Min 1h %", minBuyRatioH1: "Min buy ratio (1h)", exitM5: "Exit if 5m below %" },
    evaluate(p, x, inPos) {
      const avg6 = p.volume.h6 / 6 || 1, mult = p.volume.h1 / avg6, br = ratio(p.txns.h1.buys, p.txns.h1.sells);
      const ind = { volMult: +mult.toFixed(2), h1: p.change.h1, m5: p.change.m5, buyRatioH1: +br.toFixed(2) };
      if (inPos && p.change.m5 <= x.exitM5) return { action: "sell", reason: `5m dumped ${p.change.m5}%`, indicators: ind };
      if (!inPos && mult >= x.spikeMult && p.change.h1 >= x.minH1 && br >= x.minBuyRatioH1) return { action: "buy", reason: `Volume spike ${mult.toFixed(1)}× with 1h +${p.change.h1}%`, indicators: ind, strength: Math.min(1, mult / 10) };
      return { action: "hold", reason: `vol ${mult.toFixed(1)}× · 1h ${p.change.h1}%`, indicators: ind };
    },
  },
  dex_dip: {
    id: "dex_dip", name: "Dip Buyer",
    description: "Buys a sharp 1h pullback inside a still-positive 6h trend once 5m buyers step back in. Mean-reversion for names that are trending but shook out.",
    defaultParams: { maxH1: -8, minH6: 5, minBuyRatioM5: 0.6, exitH1: 15 },
    paramLabels: { maxH1: "1h drop at least %", minH6: "6h still above %", minBuyRatioM5: "Min buy ratio (5m)", exitH1: "Take exit when 1h above %" },
    evaluate(p, x, inPos) {
      const br5 = ratio(p.txns.m5.buys, p.txns.m5.sells);
      const ind = { h1: p.change.h1, h6: p.change.h6, m5: p.change.m5, buyRatioM5: +br5.toFixed(2) };
      if (inPos && p.change.h1 >= x.exitH1) return { action: "sell", reason: `Bounce played out (1h +${p.change.h1}%)`, indicators: ind };
      if (!inPos && p.change.h1 <= x.maxH1 && p.change.h6 >= x.minH6 && br5 >= x.minBuyRatioM5 && p.change.m5 > 0) return { action: "buy", reason: `Dip: 1h ${p.change.h1}% in +${p.change.h6}% 6h trend, 5m buyers ${Math.round(br5 * 100)}%`, indicators: ind, strength: 0.55 };
      return { action: "hold", reason: `1h ${p.change.h1}% · 6h ${p.change.h6}%`, indicators: ind };
    },
  },
};
export const DEX_STRATEGY_LIST = Object.values(DEX_STRATEGIES).map(({ id, name, description, defaultParams, paramLabels }) => ({ id, name, description, defaultParams, paramLabels }));
export const isDexStrategy = (id: string) => id in DEX_STRATEGIES;
