import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { getSite, publicCities, publicSelect, publicWhere } from "@/lib/site";
import { siteSlug, withSite } from "@/lib/site";
import { ListingCard } from "@/components/site/listing-card";
import { SearchForm } from "@/components/site/search-form";
import { PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SP = { for?: string; city?: string; type?: string; budget?: string; bhk?: string; q?: string; page?: string; sort?: string };
const PAGE_SIZE = 12;

async function generateMetadataInSite({ searchParams }: { searchParams: Promise<SP> }) {
  const slug = siteSlug();
  void slug;
  const sp = await searchParams;
  const what = sp.type ? labelOf(PROPERTY_TYPES, sp.type) : "Properties";
  return { title: `${what} for ${sp.for === "rent" ? "rent" : "sale"}${sp.city ? ` in ${sp.city}` : ""}` };
}

async function SiteListingsInSite({ searchParams }: { searchParams: Promise<SP> }) {
  const slug = siteSlug();
  void slug;
  const site = await getSite();
  if (!site.enabled) return null;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.PropertyWhereInput = { ...publicWhere };
  if (sp.for === "rent") where.listingType = "RENT";
  else if (sp.for === "buy") where.listingType = "SALE";
  if (sp.city) where.city = sp.city;
  if (sp.type && PROPERTY_TYPES.some((t) => t.value === sp.type)) where.type = sp.type;
  const budget = Number(sp.budget);
  if (Number.isFinite(budget) && budget > 0) where.price = { lte: budget };
  const bhk = Number(sp.bhk);
  if (bhk >= 1) where.bedrooms = bhk >= 4 ? { gte: 4 } : bhk;
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { locality: { contains: sp.q, mode: "insensitive" } }, { city: { contains: sp.q, mode: "insensitive" } }];

  const orderBy: Prisma.PropertyOrderByWithRelationInput = sp.sort === "price_asc" ? { price: "asc" } : sp.sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" };

  const [total, items, cities] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({ where, select: publicSelect, orderBy: [{ featured: "desc" }, orderBy], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    publicCities(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Partial<SP>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, String(v));
    const s = q.toString();
    return s ? `/site/${slug}/properties?${s}` : `/site/${slug}/properties`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {sp.type ? labelOf(PROPERTY_TYPES, sp.type) : "Properties"} for {sp.for === "rent" ? "rent" : "sale"}
        {sp.city ? ` in ${sp.city}` : ""}
      </h1>
      <p className="mt-1 text-slate-500">{total} {total === 1 ? "property" : "properties"} found</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <SearchForm slug={slug} cities={cities} values={sp} compact />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Sort:</span>
        {[
          { v: "", l: "Newest" },
          { v: "price_asc", l: "Price: low to high" },
          { v: "price_desc", l: "Price: high to low" },
        ].map((o) => (
          <Link
            key={o.v}
            href={href({ sort: o.v || undefined, page: undefined })}
            className={cn("rounded-lg px-3 py-1.5 font-medium transition", (sp.sort ?? "") === o.v ? "bg-[var(--brand)] text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            {o.l}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <SearchX className="size-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">No properties match your search</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Try removing a filter, or share your requirement and we will find options for you.</p>
          <Link href={`/site/${slug}#enquire`} className="mt-5 inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:brightness-110">
            Share my requirement
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ListingCard key={p.id} slug={slug} p={p} currency={site.currency} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="flex size-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50" aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Link>
          ) : null}
          <span className="px-3 text-sm text-slate-600">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className="flex size-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50" aria-label="Next page">
              <ChevronRight className="size-4" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateMetadata(props: any) {
  const { slug } = await props.params;
  return withSite(slug, () => generateMetadataInSite(props));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function SiteListings(props: any) {
  const { slug } = await props.params;
  return withSite(slug, () => SiteListingsInSite(props));
}
