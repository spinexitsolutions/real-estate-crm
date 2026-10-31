import Link from "next/link";
import { Bath, BedDouble, Building2, MapPin, Maximize, Star } from "lucide-react";
import { OptionBadge } from "@/components/ui/badge";
import { LISTING_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCompact } from "@/lib/format";

export type PropertyCardData = {
  id: string;
  code: string;
  title: string;
  type: string;
  listingType: string;
  status: string;
  price: number;
  area: number | null;
  areaUnit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  locality: string | null;
  city: string;
  featured: boolean;
  cover: string | null;
  interested: number;
};

export function PropertyCard({ p, currency }: { p: PropertyCardData; currency: string }) {
  return (
    <Link href={`/properties/${p.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt={p.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Building2 className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <OptionBadge list={PROPERTY_STATUSES} value={p.status} withDot />
        </div>
        {p.featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold text-amber-950">
            <Star className="size-3 fill-current" /> Featured
          </span>
        )}
        <div className="absolute bottom-3 left-3 rounded-lg bg-slate-900/75 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur-sm">
          {formatCompact(p.price, currency)}
          {p.listingType === "RENT" && <span className="text-xs font-normal text-slate-300"> /month</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-medium">{p.code}</span>
          <span>
            {labelOf(PROPERTY_TYPES, p.type)} <span className="text-slate-300">|</span> {labelOf(LISTING_TYPES, p.listingType)}
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-1 text-[15px] font-semibold text-slate-900 group-hover:text-brand-700">{p.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-slate-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{[p.locality, p.city].filter(Boolean).join(", ")}</span>
        </p>
        <div className="mt-auto flex items-center gap-4 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
          {p.bedrooms !== null && (
            <span className="flex items-center gap-1.5">
              <BedDouble className="size-4 text-slate-400" /> {p.bedrooms} Bed
            </span>
          )}
          {p.bathrooms !== null && (
            <span className="flex items-center gap-1.5">
              <Bath className="size-4 text-slate-400" /> {p.bathrooms}
            </span>
          )}
          {p.area && (
            <span className="flex items-center gap-1.5">
              <Maximize className="size-4 text-slate-400" /> {p.area.toLocaleString("en-IN")} {p.areaUnit}
            </span>
          )}
          {p.interested > 0 && <span className="ml-auto text-xs font-medium text-brand-600">{p.interested} interested</span>}
        </div>
      </div>
    </Link>
  );
}
