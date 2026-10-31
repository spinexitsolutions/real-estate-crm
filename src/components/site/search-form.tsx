import { Search } from "lucide-react";
import { PROPERTY_TYPES } from "@/lib/constants";
import { BUDGETS_RENT, BUDGETS_SALE } from "@/lib/site";
import { cn } from "@/lib/utils";

type SP = { for?: string; city?: string; type?: string; budget?: string; bhk?: string; q?: string };

const sel =
  "h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-3.5 pr-9 text-sm text-slate-800 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10";

/** Plain GET search form (works without JavaScript). */
export function SearchForm({ slug, cities, values = {}, compact }: { slug: string; cities: string[]; values?: SP; compact?: boolean }) {
  const rent = values.for === "rent";
  return (
    <form action={`/site/${slug}/properties`} method="get" className={cn("grid gap-2.5", compact ? "sm:grid-cols-2 lg:grid-cols-6" : "rounded-2xl bg-white p-3 shadow-pop sm:grid-cols-2 lg:grid-cols-[repeat(5,1fr)_auto]")}>
      <select name="for" defaultValue={values.for ?? "buy"} className={sel} aria-label="Buy or rent">
        <option value="buy">Buy</option>
        <option value="rent">Rent</option>
      </select>
      <select name="city" defaultValue={values.city ?? ""} className={sel} aria-label="City">
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={values.type ?? ""} className={sel} aria-label="Property type">
        <option value="">Any type</option>
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select name="budget" defaultValue={values.budget ?? ""} className={sel} aria-label="Budget">
        <option value="">Any budget</option>
        {(rent ? BUDGETS_RENT : [...BUDGETS_SALE, ...BUDGETS_RENT]).map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <select name="bhk" defaultValue={values.bhk ?? ""} className={sel} aria-label="Bedrooms">
        <option value="">Any BHK</option>
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n === 4 ? "4+ BHK" : `${n} BHK`}
          </option>
        ))}
      </select>
      <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:brightness-110">
        <Search className="size-4" /> Search
      </button>
    </form>
  );
}
