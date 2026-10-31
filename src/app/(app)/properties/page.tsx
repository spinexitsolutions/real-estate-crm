import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2, CircleCheck, Clock, Plus, Star, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { LISTING_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import { parseImages } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { PropertyCard } from "@/components/properties/property-card";
import { PriceRangeFilter, ViewToggle } from "@/components/properties/list-controls";

export const metadata = { title: "Properties" };

const PAGE_SIZE = 12;
const BEDROOM_OPTIONS = [
  { value: "1", label: "1 BHK" },
  { value: "2", label: "2 BHK" },
  { value: "3", label: "3 BHK" },
  { value: "4", label: "4+ BHK" },
];

type SP = Record<string, string | undefined>;

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const currency = settings.currency;
  const page = Math.max(1, Number(sp.page) || 1);
  const view = sp.view === "table" ? "table" : "grid";

  const where: Prisma.PropertyWhereInput = {};
  if (sp.q) {
    where.OR = [
      { title: { contains: sp.q, mode: "insensitive" } },
      { code: { contains: sp.q, mode: "insensitive" } },
      { locality: { contains: sp.q, mode: "insensitive" } },
      { city: { contains: sp.q, mode: "insensitive" } },
      { address: { contains: sp.q, mode: "insensitive" } },
      { ownerName: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.type) where.type = sp.type;
  if (sp.listingType) where.listingType = sp.listingType;
  if (sp.status) where.status = sp.status;
  if (sp.city) where.city = sp.city;
  if (sp.bedrooms) where.bedrooms = sp.bedrooms === "4" ? { gte: 4 } : Number(sp.bedrooms);
  const minPrice = Number(sp.minPrice);
  const maxPrice = Number(sp.maxPrice);
  if (minPrice > 0 || maxPrice > 0) {
    where.price = {
      ...(minPrice > 0 ? { gte: minPrice } : {}),
      ...(maxPrice > 0 ? { lte: maxPrice } : {}),
    };
  }

  const [total, properties, cities, statusCounts, saleValue] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { agent: { select: { name: true } }, _count: { select: { interests: true } } },
    }),
    db.property.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    db.property.groupBy({ by: ["status"], _count: { _all: true } }),
    db.property.aggregate({ where: { status: "AVAILABLE", listingType: "SALE" }, _sum: { price: true } }),
  ]);

  const countOf = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const totalAll = statusCounts.reduce((a, c) => a + c._count._all, 0);
  const filterKeys = ["q", "type", "listingType", "status", "city", "bedrooms", "minPrice", "maxPrice"];

  return (
    <>
      <PageHeader
        title="Properties"
        description="Your complete inventory of listings for sale and rent."
        icon={Building2}
        actions={
          <LinkButton href="/properties/new">
            <Plus /> Add property
          </LinkButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total listings" value={totalAll} icon={Building2} tone="brand" sub="across all statuses" />
        <StatCard label="Available" value={countOf("AVAILABLE")} icon={CircleCheck} tone="emerald" sub="ready to pitch" />
        <StatCard label="Reserved" value={countOf("RESERVED")} icon={Clock} tone="amber" sub={`${countOf("SOLD")} sold, ${countOf("RENTED")} rented`} />
        <StatCard label="Available sale inventory" value={formatCompact(saleValue._sum.price ?? 0, currency)} icon={Wallet} tone="violet" sub="total asking value" />
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-2 p-3">
        <SearchInput placeholder="Search title, code, locality, owner..." className="w-full sm:w-72" />
        <FilterSelect param="listingType" options={LISTING_TYPES} placeholder="Sale and rent" />
        <FilterSelect param="type" options={PROPERTY_TYPES} placeholder="All types" />
        <FilterSelect param="status" options={PROPERTY_STATUSES} placeholder="Any status" />
        <FilterSelect param="city" options={cities.map((c) => ({ value: c.city, label: c.city }))} placeholder="All cities" />
        <FilterSelect param="bedrooms" options={BEDROOM_OPTIONS} placeholder="Any BHK" className="min-w-28" />
        <PriceRangeFilter />
        <ClearFilters keys={filterKeys} />
        <div className="ml-auto">
          <ViewToggle />
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title={totalAll === 0 ? "No properties yet" : "No properties match your filters"}
            description={totalAll === 0 ? "Add your first listing to start matching it with leads." : "Try removing a filter or searching for something else."}
            action={
              totalAll === 0 ? (
                <LinkButton href="/properties/new">
                  <Plus /> Add property
                </LinkButton>
              ) : undefined
            }
          />
        </div>
      ) : view === "grid" ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                currency={currency}
                p={{ ...p, cover: parseImages(p.images)[0] ?? null, interested: p._count.interests }}
              />
            ))}
          </div>
          <div className="card mt-5 overflow-hidden">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/properties" searchParams={sp} />
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Property</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Location</th>
                  <th className="table-th text-right">Price</th>
                  <th className="table-th">Config</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Agent</th>
                  <th className="table-th text-right">Interested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {properties.map((p) => {
                  const cover = parseImages(p.images)[0];
                  return (
                    <tr key={p.id} className="transition hover:bg-slate-50/70">
                      <td className="table-td">
                        <Link href={`/properties/${p.id}`} className="flex items-center gap-3">
                          <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full items-center justify-center text-slate-300">
                                <Building2 className="size-4" />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="flex max-w-xs items-center gap-1.5 truncate font-medium text-slate-900 hover:text-brand-700">
                              {p.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                              <span className="truncate">{p.title}</span>
                            </span>
                            <span className="block text-xs text-slate-500">{p.code}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="table-td">
                        <span className="block">{labelOf(PROPERTY_TYPES, p.type)}</span>
                        <span className="text-xs text-slate-500">{labelOf(LISTING_TYPES, p.listingType)}</span>
                      </td>
                      <td className="table-td">{[p.locality, p.city].filter(Boolean).join(", ")}</td>
                      <td className="table-td text-right font-medium text-slate-900">
                        {formatCompact(p.price, currency)}
                        {p.listingType === "RENT" && <span className="text-xs font-normal text-slate-500">/mo</span>}
                      </td>
                      <td className="table-td">
                        {p.bedrooms ? `${p.bedrooms} BHK` : "-"}
                        {p.area ? <span className="block text-xs text-slate-500">{p.area.toLocaleString("en-IN")} {p.areaUnit}</span> : null}
                      </td>
                      <td className="table-td">
                        <OptionBadge list={PROPERTY_STATUSES} value={p.status} withDot />
                      </td>
                      <td className="table-td">
                        {p.agent ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={p.agent.name} size="xs" /> {p.agent.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="table-td text-right">{p._count.interests}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/properties" searchParams={sp} />
        </div>
      )}
    </>
  );
}
