"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, CandlestickChart, History, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { useApi } from "@/lib/client";
import { cls, fmtAgo } from "@/lib/format";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/ai", label: "AI Scanner", icon: Sparkles },
  { href: "/markets", label: "Markets", icon: CandlestickChart },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface Engine { online: boolean; heartbeat: number; exchange: string; liveKeys: boolean; aiKey: boolean; ai?: { provider: string; model: string } }

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: eng } = useApi<Engine>("/api/engine", 10000);
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-panel/60 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2">
          <Activity className="text-accent" size={20} />
          <span className="font-semibold tracking-tight">Crypto Mania</span>
        </div>
        <nav className="px-3 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cls("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm", active ? "bg-panel-2 text-text" : "text-muted hover:text-text hover:bg-panel-2/60")}>
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-xs text-muted space-y-2">
          <div className="flex items-center gap-2">
            <span className={cls("dot", eng?.online ? "dot-live" : "bg-down")} />
            <span>Engine {eng?.online ? "online" : "offline"}</span>
          </div>
          {eng && <div>heartbeat {fmtAgo(eng.heartbeat)}</div>}
          {eng && <div className="flex gap-1.5 flex-wrap pt-1">
            <span className="pill pill-muted">{eng.exchange}</span>
            <span className={cls("pill", eng.liveKeys ? "pill-warn" : "pill-muted")}>{eng.liveKeys ? "live keys" : "paper only"}</span>
            <span className={cls("pill", eng.aiKey ? "pill-accent" : "pill-muted")}>{eng.aiKey ? `AI: ${eng.ai?.model ?? "ready"}` : "no AI key"}</span>
          </div>}
          {eng && !eng.online && <div className="text-warn">run <code className="num">npm run engine</code></div>}
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-[1500px]">{children}</main>
    </div>
  );
}
