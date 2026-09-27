"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useApi } from "@/lib/client";
import { fmtUsd } from "@/lib/format";

export function EquityChart({ hours = 24, start }: { hours?: number; start: number }) {
  const { data } = useApi<{ ts: number; equity: number }[]>(`/api/equity?hours=${hours}`, 60000);
  const pts = (data ?? []).map((d) => ({ t: d.ts, v: d.equity }));
  if (!pts.length) return <div className="h-56 flex items-center justify-center text-sm text-muted">Equity history appears once the engine has run for a minute.</div>;
  const min = Math.min(start, ...pts.map((p) => p.v)), max = Math.max(start, ...pts.map((p) => p.v));
  const pad = (max - min) * 0.15 || 10;
  const up = pts[pts.length - 1].v >= start;
  const color = up ? "#2fd181" : "#ff5c7a";
  return (
    <div className="h-56 px-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
          <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} stroke="#1f2a35" tick={{ fill: "#8b98a5", fontSize: 11 }} minTickGap={50} />
          <YAxis domain={[min - pad, max + pad]} tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`} stroke="#1f2a35" tick={{ fill: "#8b98a5", fontSize: 11 }} width={70} />
          <ReferenceLine y={start} stroke="#8b98a5" strokeDasharray="4 4" />
          <Tooltip contentStyle={{ background: "#172029", border: "1px solid #1f2a35", borderRadius: 10, fontSize: 12 }} labelFormatter={(t) => new Date(Number(t)).toLocaleString("en-GB")} formatter={(v) => [fmtUsd(Number(v)), "Equity"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#eq)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
