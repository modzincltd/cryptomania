export type Mode = "paper" | "live";
export type BotStatus = "running" | "paused" | "stopped";
export type StrategyId = "rsi" | "ema_cross" | "bollinger" | "breakout" | "macd";
export type IntervalSec = 30 | 60 | 300;
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface RiskConfig {
  stopLossPct: number;        // e.g. 2 = 2%
  takeProfitPct: number;      // e.g. 4
  trailingStopPct?: number;   // optional trailing stop
  maxPositionUsd: number;     // max notional per position
  maxDailyLossUsd: number;    // bot halts for the day if breached
  cooldownSec: number;        // wait after closing before re-entry
  maxOpenPositions: number;   // per bot (usually 1)
}

export interface BotConfig {
  id: number;
  name: string;
  symbol: string;
  timeframe: Timeframe;
  intervalSec: IntervalSec;
  strategy: StrategyId;
  params: Record<string, number>;
  risk: RiskConfig;
  mode: Mode;
  status: BotStatus;
  allocationUsd: number;
}

export interface Candle {
  ts: number; open: number; high: number; low: number; close: number; volume: number;
}

export type SignalAction = "buy" | "sell" | "hold";
export interface Signal {
  action: SignalAction;
  reason: string;
  indicators: Record<string, number | string | boolean>;
  strength?: number; // 0..1
}

export interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  paramLabels: Record<string, string>;
  minCandles: number;
  evaluate(candles: Candle[], params: Record<string, number>): Signal;
}

export interface Suggestion {
  symbol: string;
  side: "long" | "avoid";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number; // 0-100
  timeframe: string;
  rationale: string;
  riskReward: number;
}

export const DEFAULT_RISK: RiskConfig = {
  stopLossPct: 2,
  takeProfitPct: 4,
  trailingStopPct: 0,
  maxPositionUsd: 500,
  maxDailyLossUsd: 100,
  cooldownSec: 300,
  maxOpenPositions: 1,
};

export const FEE_RATE = 0.001; // 0.1% taker
