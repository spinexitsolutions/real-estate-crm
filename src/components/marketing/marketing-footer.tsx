import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { LogoMark } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
      { href: "/signup", label: "Start free trial" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund-policy", label: "Cancellation & Refunds" },
    ],
  },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-[#0b1020] text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="text-[17px] font-semibold tracking-tight text-white">{BRAND.name}</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{BRAND.tagline}.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-white">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="text-sm font-semibold text-white">Contact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a href={`mailto:${BRAND.supportEmail}`} className="flex items-center gap-2 transition hover:text-white">
                <Mail className="size-4 shrink-0" /> {BRAND.supportEmail}
              </a>
            </li>
            {BRAND.supportPhone && (
              <li>
                <a href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`} className="flex items-center gap-2 transition hover:text-white">
                  <Phone className="size-4 shrink-0" /> {BRAND.supportPhone}
                </a>
              </li>
            )}
            {BRAND.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" /> <span>{BRAND.address}</span>
              </li>
            )}
            <li>
              <Link href="/contact" className="font-medium text-brand-200 transition hover:text-white">
                Send us a message
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {year} {BRAND.legalName || BRAND.name}. All rights reserved.
          </p>
          <p>Made in India for real estate teams. Payments secured by Razorpay.</p>
        </div>
      </div>
    </footer>
  );
}
