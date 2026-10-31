import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Building2, Check, Download, Layers, MapPin, Maximize, Phone, Sofa, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { getSite, publicSelect, publicWhere } from "@/lib/site";
import { FURNISHING, LISTING_TYPES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCompact, formatCurrency } from "@/lib/format";
import { parseImages, splitList, waLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/icons";
import { SiteGallery } from "@/components/site/gallery";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { ListingCard } from "@/components/site/listing-card";

async function getProperty(id: string) {
  return db.property.findFirst({ where: { id, ...publicWhere }, select: publicSelect });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, site] = await Promise.all([getProperty(id), getSite()]);
  if (!p || !site.enabled) return { title: "Property not found" };
  const cover = parseImages(p.images)[0];
  const price = `${formatCompact(p.price, site.currency)}${p.listingType === "RENT" ? " per month" : ""}`;
  const description = `${p.bedrooms ? `${p.bedrooms} BHK ` : ""}${labelOf(PROPERTY_TYPES, p.type)} ${p.listingType === "RENT" ? "for rent" : "for sale"} in ${[p.locality, p.city].filter(Boolean).join(", ")}. ${price}.`;
  return {
    title: p.title,
    description,
    openGraph: { title: `${p.title} - ${price}`, description, images: cover ? [{ url: cover }] : undefined, type: "website" },
    twitter: { card: "summary_large_image", title: p.title, description, images: cover ? [cover] : undefined },
  };
}

export default async function SitePropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSite();
  if (!site.enabled) return null;
  const p = await getProperty(id);
  if (!p) notFound();

  const images = parseImages(p.images);
  const amenities = splitList(p.amenities);
  const location = [p.locality, p.city].filter(Boolean).join(", ");
  const rent = p.listingType === "RENT";
  const unit = p.areaUnit === "sqft" ? "sq ft" : p.areaUnit;
  const mapQuery = p.latitude !== null && p.longitude !== null ? `${p.latitude},${p.longitude}` : `${location}`;

  const similar = await db.property.findMany({
    where: { ...publicWhere, id: { not: p.id }, listingType: p.listingType, OR: [{ city: p.city }, { type: p.type }] },
    select: publicSelect,
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const specs = [
    { icon: Building2, label: "Type", value: labelOf(PROPERTY_TYPES, p.type) },
    p.bedrooms ? { icon: BedDouble, label: "Bedrooms", value: `${p.bedrooms} BHK` } : null,
    p.bathrooms ? { icon: Bath, label: "Bathrooms", value: String(p.bathrooms) } : null,
    p.area ? { icon: Maximize, label: "Area", value: `${p.area.toLocaleString("en-IN")} ${unit}` } : null,
    p.furnishing ? { icon: Sofa, label: "Furnishing", value: labelOf(FURNISHING, p.furnishing) } : null,
    !rent && p.area ? { icon: Layers, label: `Rate per ${unit}`, value: formatCurrency(Math.round(p.price / p.area), site.currency) } : null,
    { icon: Tag, label: "Listing", value: labelOf(LISTING_TYPES, p.listingType) },
  ].filter(Boolean) as { icon: typeof Building2; label: string; value: string }[];

  const wa = site.phone ? waLink(site.phone, `Hi, I am interested in ${p.title} (${p.code}) at ${location}. Please share more details.`, site.countryCode) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <Link href="/site/properties" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> All properties
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--brand)]/10 px-2 py-1 text-xs font-semibold text-[var(--brand)]">{labelOf(LISTING_TYPES, p.listingType)}</span>
            {p.status === "RESERVED" && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Reserved</span>}
            <span className="text-xs text-slate-400">Ref {p.code}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{p.title}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-slate-500">
            <MapPin className="size-4" /> {location}
          </p>
        </div>
        <div className="lg:text-right">
          <p className="text-3xl font-semibold tracking-tight text-[var(--brand)]">
            {formatCompact(p.price, site.currency)}
            {rent && <span className="text-base font-normal text-slate-500"> /month</span>}
          </p>
          <p className="text-sm text-slate-500">{formatCurrency(p.price, site.currency)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <SiteGallery images={images} title={p.title} />

          <section>
            <h2 className="text-lg font-semibold">Overview</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
                    <s.icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {p.description && (
            <section>
              <h2 className="text-lg font-semibold">About this property</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{p.description}</p>
            </section>
          )}

          {amenities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Amenities</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {amenities.map((a) => (
                  <span key={a} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="size-3.5" />
                    </span>
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">Location</h2>
            <p className="mt-1 text-sm text-slate-500">{location}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <iframe
                title={`Map of ${location}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${p.latitude !== null ? 15 : 13}&output=embed`}
                className="h-80 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-lg font-semibold">Interested in this property?</p>
            <p className="mb-5 mt-1 text-sm text-slate-500">Get the best price, floor plans and a site visit.</p>
            <EnquiryForm propertyId={p.id} defaultMessage={`I am interested in ${p.title}. Please call me.`} />
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Your property advisor</p>
            <p className="mt-1.5 font-semibold text-slate-900">{p.agent?.name ?? site.companyName}</p>
            <p className="text-sm text-slate-500">{site.companyName}</p>
            <div className="mt-4 grid gap-2">
              {site.phone && (
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  <Phone className="size-4" /> Call {site.phone}
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                  <WhatsAppIcon className="size-4" /> Chat on WhatsApp
                </a>
              )}
              <a href={`/api/public/brochure/${p.id}?download=1`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <Download className="size-4" /> Download brochure
              </a>
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Similar properties</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <ListingCard key={s.id} p={s} currency={site.currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
