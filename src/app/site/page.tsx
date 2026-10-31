import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, Handshake, Landmark } from "lucide-react";
import { db } from "@/lib/db";
import { getSite, publicCities, publicSelect, publicWhere } from "@/lib/site";
import { parseImages } from "@/lib/utils";
import { ListingCard } from "@/components/site/listing-card";
import { SearchForm } from "@/components/site/search-form";
import { EnquiryForm } from "@/components/site/enquiry-form";

const WHY = [
  { icon: BadgeCheck, title: "Verified listings", text: "Every property is personally checked by our team before it goes live." },
  { icon: Handshake, title: "Best price negotiation", text: "We negotiate hard so you get the right price and terms." },
  { icon: Landmark, title: "Home loan assistance", text: "Quick approvals through our partner banks and NBFCs." },
  { icon: CalendarCheck, title: "Hassle-free site visits", text: "Pick a time and we will arrange everything for you." },
];

export default async function SiteHome() {
  const site = await getSite();
  if (!site.enabled) return null;
  const [featured, latest, cities, counts] = await Promise.all([
    db.property.findMany({ where: { ...publicWhere, featured: true }, select: publicSelect, orderBy: { updatedAt: "desc" }, take: 3 }),
    db.property.findMany({ where: publicWhere, select: publicSelect, orderBy: { createdAt: "desc" }, take: 6 }),
    publicCities(),
    db.property.groupBy({ by: ["listingType"], where: publicWhere, _count: true }),
  ]);
  const heroImage = parseImages((featured[0] ?? latest[0])?.images)[0];
  const forSale = counts.find((c) => c.listingType === "SALE")?._count ?? 0;
  const forRent = counts.find((c) => c.listingType === "RENT")?._count ?? 0;
  const top = featured.length ? featured : latest.slice(0, 3);
  const rest = latest.filter((p) => !top.some((t) => t.id === p.id)).slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden bg-[#0b1020]">
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1020]/60 via-[#0b1020]/50 to-[#0b1020]/90" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pb-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">{site.companyName}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">{site.tagline}</h1>
          <p className="mt-4 max-w-xl text-base text-slate-300">
            {forSale} homes for sale and {forRent} for rent{cities.length ? ` across ${cities.slice(0, 3).join(", ")}` : ""}. Talk to an expert today.
          </p>
          <div className="mt-8 max-w-5xl">
            <SearchForm cities={cities} />
          </div>
        </div>
      </section>

      {top.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <SectionHead title={featured.length ? "Featured properties" : "New on the market"} subtitle="Hand-picked homes our team recommends this week" href="/site/properties" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((p) => (
              <ListingCard key={p.id} p={p} currency={site.currency} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <SectionHead title="Latest listings" subtitle="Fresh properties added by our team" href="/site/properties" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <ListingCard key={p.id} p={p} currency={site.currency} />
            ))}
          </div>
        </section>
      )}

      {top.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 text-center sm:px-6 lg:px-8">
          <p className="text-slate-500">New listings are coming soon. Share your requirement below and we will call you with matching options.</p>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.title} className="rounded-2xl border border-slate-200 p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
                <w.icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold text-slate-900">{w.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-20 sm:px-6 lg:px-8">
        <div id="enquire" className="grid scroll-mt-20 gap-10 overflow-hidden rounded-3xl bg-slate-50 p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--brand)]">About us</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Your trusted property partner</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">
              {site.about ||
                `${site.companyName} helps families and investors find the right property with honest advice, verified listings and complete support from the first site visit to registration.`}
            </p>
            {site.reraNumber && <p className="mt-6 text-sm text-slate-500">RERA Registration No. {site.reraNumber}</p>}
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <p className="text-lg font-semibold text-slate-900">Tell us what you are looking for</p>
            <p className="mb-5 mt-1 text-sm text-slate-500">Share your requirement and an expert will call you with matching options.</p>
            <EnquiryForm showVisitDate={false} />
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-1.5 text-slate-500">{subtitle}</p>
      </div>
      <Link href={href} className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline sm:inline-flex">
        View all <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
