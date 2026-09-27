import { z } from "zod";
export const BotInput = z.object({
  name: z.string().min(1),
  symbol: z.string().min(3),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h"]).default("5m"),
  intervalSec: z.union([z.literal(30), z.literal(60), z.literal(300)]).default(60),
  strategy: z.enum(["rsi", "ema_cross", "bollinger", "breakout", "macd", "dex_momentum", "dex_volume_spike", "dex_dip"]),
  pairId: z.string().regex(/^[a-z0-9]+:.+$/).optional().nullable(),
  params: z.record(z.string(), z.number()).default({}),
  risk: z.object({
    stopLossPct: z.number().min(0), takeProfitPct: z.number().min(0), trailingStopPct: z.number().min(0).optional(),
    maxPositionUsd: z.number().positive(), maxDailyLossUsd: z.number().min(0), cooldownSec: z.number().min(0), maxOpenPositions: z.number().int().min(1),
  }).partial().default({}),
  mode: z.enum(["paper", "live"]).default("paper"),
  allocationUsd: z.number().positive().default(500),
  status: z.enum(["running", "paused", "stopped"]).optional(),
});
