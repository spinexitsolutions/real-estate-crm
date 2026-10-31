"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "", label: "Any price" },
  { value: "0-5000000", label: "Under 50 L" },
  { value: "5000000-10000000", label: "50 L - 1 Cr" },
  { value: "10000000-20000000", label: "1 Cr - 2 Cr" },
  { value: "20000000-50000000", label: "2 Cr - 5 Cr" },
  { value: "50000000-", label: "Above 5 Cr" },
  { value: "0-50000", label: "Rent under 50 K" },
  { value: "50000-150000", label: "Rent 50 K - 1.5 L" },
];

function useUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  return {
    params,
    update(patch: Record<string, string | null>) {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
  };
}

export function PriceRangeFilter() {
  const { params, update } = useUpdate();
  const min = params.get("minPrice") ?? "";
  const max = params.get("maxPrice") ?? "";
  const current = min || max ? `${min || "0"}-${max}` : "";
  const known = RANGES.some((r) => r.value === current);
  return (
    <select
      value={current}
      onChange={(e) => {
        const [mn, mx] = e.target.value ? e.target.value.split("-") : ["", ""];
        update({ minPrice: mn && mn !== "0" ? mn : null, maxPrice: mx || null });
      }}
      className={cn(
        "input h-9 w-auto min-w-36 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9",
        current && "border-brand-300 bg-brand-50/50 text-brand-700",
      )}
    >
      {RANGES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
      {!known && <option value={current}>Custom range</option>}
    </select>
  );
}

export function ViewToggle() {
  const { params, update } = useUpdate();
  const view = params.get("view") === "table" ? "table" : "grid";
  const btn = (v: "grid" | "table", Icon: typeof List, label: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => update({ view: v === "grid" ? null : v })}
      className={cn("flex size-7 items-center justify-center rounded-md transition", view === v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800")}
    >
      <Icon className="size-4" />
    </button>
  );
  return (
    <div className="inline-flex gap-0.5 rounded-lg bg-slate-100 p-1">
      {btn("grid", LayoutGrid, "Grid view")}
      {btn("table", List, "Table view")}
    </div>
  );
}
