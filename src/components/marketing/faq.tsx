import { ChevronDown } from "lucide-react";

/** Accessible FAQ accordion using native <details> (works without JavaScript). */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((it) => (
        <details key={it.q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[15px] font-medium text-slate-900">
            {it.q}
            <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <p className="-mt-1 pb-5 text-sm leading-relaxed text-slate-600">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
