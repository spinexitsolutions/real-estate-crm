"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChartColumn,
  Handshake,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Result = { id: string; type: "lead" | "property" | "deal"; title: string; subtitle: string; href: string };

const QUICK = [
  { title: "Go to Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Add new lead", href: "/leads?new=1", icon: Plus },
  { title: "Add new property", href: "/properties/new", icon: Plus },
  { title: "Today's follow-ups", href: "/follow-ups", icon: CalendarClock },
  { title: "Sales pipeline", href: "/leads?view=board", icon: Users },
  { title: "Deals", href: "/deals", icon: Handshake },
  { title: "Reports", href: "/reports", icon: ChartColumn },
];

const ICONS = { lead: Users, property: Building2, deal: Handshake };

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (!open || typeof document === "undefined") return null;

  const items = q.trim()
    ? results.map((r) => ({ key: r.type + r.id, title: r.title, subtitle: r.subtitle, href: r.href, icon: ICONS[r.type] }))
    : QUICK.map((x) => ({ key: x.href, title: x.title, subtitle: "", href: x.href, icon: x.icon }));

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          {loading ? <LoaderCircle className="size-5 animate-spin text-slate-400" /> : <Search className="size-5 text-slate-400" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && items[active]) go(items[active].href);
            }}
            placeholder="Search by name, phone, email, property code..."
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {!q.trim() && <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Quick actions</p>}
          {q.trim() && !loading && items.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-500">No results for &quot;{q}&quot;</p>}
          {items.map((it, i) => (
            <button
              key={it.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it.href)}
              className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === active ? "bg-brand-50" : "hover:bg-slate-50")}
            >
              <span className={cn("flex size-8 items-center justify-center rounded-lg", i === active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500")}>
                <it.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{it.title}</span>
                {it.subtitle && <span className="block truncate text-xs text-slate-500">{it.subtitle}</span>}
              </span>
              {i === active && <ArrowRight className="size-4 text-brand-600" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
