"use client";
import { cls } from "@/lib/format";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1>{sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}</div>
      <div className="flex gap-2 items-center">{children}</div>
    </div>
  );
}

export function Card({ title, right, children, className }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cls("card", className)}>
      {(title || right) && <header className="flex items-center justify-between px-4 py-3 border-b border-border"><h2 className="text-sm font-medium">{title}</h2>{right}</header>}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" | "muted" }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={cls("num text-xl font-semibold mt-1", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-muted">{children}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { running: "pill-up", paused: "pill-warn", stopped: "pill-muted", open: "pill-accent", closed: "pill-muted", new: "pill-accent", executed: "pill-up", dismissed: "pill-muted", bot_created: "pill-warn", long: "pill-up", avoid: "pill-down", paper: "pill-muted", live: "pill-warn" };
  return <span className={cls("pill", map[status] ?? "pill-muted")}>{status.replace("_", " ")}</span>;
}
