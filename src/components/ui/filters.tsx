"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Option } from "@/lib/constants";

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

export function SearchInput({ placeholder = "Search...", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const { params, update, pending } = useQueryUpdater();
  const [value, setValue] = useState(params.get(param) ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get(param) ?? "") !== value) update({ [param]: value || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="input h-9 pl-9 pr-8" />
      {pending ? (
        <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : (
        value && (
          <button type="button" onClick={() => setValue("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        )
      )}
    </div>
  );
}

export function FilterSelect({ param, options, placeholder, className }: { param: string; options: Option[]; placeholder: string; className?: string }) {
  const { params, update } = useQueryUpdater();
  const value = params.get(param) ?? "";
  return (
    <select
      value={value}
      onChange={(e) => update({ [param]: e.target.value || null })}
      className={cn(
        "input h-9 w-auto min-w-36 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9",
        value && "border-brand-300 bg-brand-50/50 text-brand-700",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const { params, update } = useQueryUpdater();
  const active = keys.some((k) => params.get(k));
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={() => update(Object.fromEntries(keys.map((k) => [k, null])))}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      <X className="size-4" /> Clear
    </button>
  );
}

export function SegmentTabs({ param, options, defaultValue }: { param: string; options: (Option & { count?: number })[]; defaultValue: string }) {
  const { params, update } = useQueryUpdater();
  const value = params.get(param) ?? defaultValue;
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => update({ [param]: o.value === defaultValue ? null : o.value })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition",
            value === o.value ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {o.label}
          {typeof o.count === "number" && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] font-semibold",
                value === o.value ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600",
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, basePath, searchParams }: { page: number; pageSize: number; total: number; basePath: string; searchParams: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        Showing <span className="font-medium text-slate-700">{from}</span>-<span className="font-medium text-slate-700">{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous">
          <ChevronLeft className="size-4" />
        </PageLink>
        <span className="px-2 text-[13px]">
          Page {page} of {pages}
        </span>
        <PageLink href={href(page + 1)} disabled={page >= pages} label="Next">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children, label }: { href: string; disabled: boolean; children: React.ReactNode; label: string }) {
  if (disabled)
    return (
      <span aria-label={label} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300">
        {children}
      </span>
    );
  return (
    <Link aria-label={label} href={href} scroll={false} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
      {children}
    </Link>
  );
}
