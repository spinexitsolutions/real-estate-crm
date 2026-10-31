import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { getSite } from "@/lib/site";
import { originFrom } from "@/lib/brochure-link";
import { waLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const origin = originFrom(await headers());
  return {
    metadataBase: new URL(origin),
    title: { default: `${site.companyName} - Properties for sale and rent`, template: `%s | ${site.companyName}` },
    description: site.tagline,
    openGraph: { siteName: site.companyName, type: "website" },
    icons: site.logoUrl ? { icon: site.logoUrl } : undefined,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const style = { "--brand": site.brandColor } as React.CSSProperties;

  if (!site.enabled) {
    return (
      <div style={style} className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Building2 className="size-7" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">This website is not available</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {site.companyName}&apos;s property website is currently offline.{site.phone ? ` Please call ${site.phone} for current listings.` : ""}
        </p>
      </div>
    );
  }

  const wa = site.phone ? waLink(site.phone, `Hi ${site.companyName}, I am looking for a property.`, site.countryCode) : null;

  return (
    <div style={style} className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/site" className="flex min-w-0 items-center gap-2.5">
            {site.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.logoUrl} alt={site.companyName} className="h-9 max-w-36 object-contain" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] text-base font-bold text-white">{site.companyName.charAt(0)}</span>
            )}
            <span className="truncate text-base font-semibold tracking-tight">{site.companyName}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link href="/site/properties?for=buy" className="hover:text-slate-900">
              Buy
            </Link>
            <Link href="/site/properties?for=rent" className="hover:text-slate-900">
              Rent
            </Link>
            <Link href="/site#about" className="hover:text-slate-900">
              About
            </Link>
            <Link href="/site#contact" className="hover:text-slate-900">
              Contact
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" aria-label="WhatsApp us">
                <WhatsAppIcon className="size-[18px] text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            {site.phone && (
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--brand)] px-3.5 text-sm font-semibold text-white hover:brightness-110" aria-label="Call us">
                <Phone className="size-4" />
                <span className="hidden sm:inline">{site.phone}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer id="contact" className="mt-20 bg-[#0b1020] text-slate-400">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <p className="text-lg font-semibold text-white">{site.companyName}</p>
            <p className="mt-2 text-sm leading-relaxed">{site.tagline}</p>
            {site.reraNumber && <p className="mt-4 text-xs text-slate-500">RERA Registration No. {site.reraNumber}</p>}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-300">Contact</p>
            <ul className="mt-4 space-y-3 text-sm">
              {site.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0" />
                  <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-white">
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0" />
                  <a href={`mailto:${site.email}`} className="hover:text-white">
                    {site.email}
                  </a>
                </li>
              )}
              {site.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>{site.address}</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-300">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/site/properties?for=buy" className="hover:text-white">
                  Properties for sale
                </Link>
              </li>
              <li>
                <Link href="/site/properties?for=rent" className="hover:text-white">
                  Properties for rent
                </Link>
              </li>
              <li>
                <Link href="/site#enquire" className="hover:text-white">
                  Post your requirement
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8">
            &copy; {new Date().getFullYear()} {site.companyName}. All rights reserved. Prices and availability are subject to change.
          </p>
        </div>
      </footer>
    </div>
  );
}
