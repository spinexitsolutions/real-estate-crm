import Link from "next/link";
import { Bath, BedDouble, Building2, MapPin, Maximize } from "lucide-react";
import { LISTING_TYPES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import { parseImages } from "@/lib/utils";
import type { PublicProperty } from "@/lib/site";

export function ListingCard({ slug, p, currency }: { slug: string; p: PublicProperty; currency: string }) {
  const cover = parseImages(p.images)[0];
  const rent = p.listingType === "RENT";
  return (
    <Link href={`/site/${slug}/properties/${p.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={p.title} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center text-slate-300">
            <Building2 className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm">{labelOf(LISTING_TYPES, p.listingType)}</span>
          {p.status === "RESERVED" && <span className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">Reserved</span>}
        </div>
        <span className="absolute bottom-3 left-3 rounded-lg bg-slate-900/80 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur">
          {formatCompact(p.price, currency)}
          {rent && <span className="text-xs font-normal text-white/80"> /month</span>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand)]">{labelOf(PROPERTY_TYPES, p.type)}</p>
        <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">{p.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{[p.locality, p.city].filter(Boolean).join(", ")}</span>
        </p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
          {p.bedrooms ? (
            <span className="flex items-center gap-1.5">
              <BedDouble className="size-4 text-slate-400" /> {p.bedrooms} BHK
            </span>
          ) : null}
          {p.bathrooms ? (
            <span className="flex items-center gap-1.5">
              <Bath className="size-4 text-slate-400" /> {p.bathrooms} Bath
            </span>
          ) : null}
          {p.area ? (
            <span className="flex items-center gap-1.5">
              <Maximize className="size-4 text-slate-400" /> {p.area.toLocaleString("en-IN")} {p.areaUnit === "sqft" ? "sq ft" : p.areaUnit}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
