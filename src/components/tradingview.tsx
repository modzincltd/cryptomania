"use client";
import { useEffect, useRef } from "react";

export function TradingViewChart({ symbol, interval = "60", height = 520 }: { symbol: string; interval?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true, symbol, interval, timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", backgroundColor: "#111820", gridColor: "rgba(31,42,53,0.6)",
      hide_top_toolbar: false, allow_symbol_change: false, save_image: false, calendar: false, withdateranges: true,
      studies: ["STD;EMA", "STD;RSI"], support_host: "https://www.tradingview.com",
    });
    const inner = document.createElement("div"); inner.className = "tradingview-widget-container__widget"; inner.style.height = "100%";
    el.appendChild(inner); el.appendChild(s);
    return () => { el.innerHTML = ""; };
  }, [symbol, interval]);
  return <div ref={ref} className="tradingview-widget-container rounded-b-[14px] overflow-hidden" style={{ height }} />;
}
