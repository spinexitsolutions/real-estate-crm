import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Only these statuses are ever shown on the public website. */
export const PUBLIC_STATUSES = ["AVAILABLE", "RESERVED"];

export const publicWhere: Prisma.PropertyWhereInput = { published: true, status: { in: PUBLIC_STATUSES } };

/** Fields that are safe to show publicly. Owner name/phone and internal data are never selected. */
export const publicSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  type: true,
  listingType: true,
  status: true,
  price: true,
  area: true,
  areaUnit: true,
  bedrooms: true,
  bathrooms: true,
  furnishing: true,
  locality: true,
  city: true,
  amenities: true,
  images: true,
  featured: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  agent: { select: { name: true } },
} satisfies Prisma.PropertySelect;

export type PublicProperty = Prisma.PropertyGetPayload<{ select: typeof publicSelect }>;

export const getSite = cache(async () => {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return {
    enabled: !!s?.websiteEnabled,
    companyName: s?.companyName ?? "Our Realty",
    phone: s?.companyPhone ?? null,
    email: s?.companyEmail ?? null,
    address: s?.companyAddress ?? null,
    logoUrl: s?.logoUrl ?? null,
    brandColor: s?.brandColor && /^#[0-9a-f]{6}$/i.test(s.brandColor) ? s.brandColor : "#4f46e5",
    tagline: s?.websiteTagline || "Find a home you will love",
    about: s?.websiteAbout ?? null,
    reraNumber: s?.reraNumber ?? null,
    currency: s?.currency ?? "INR",
    countryCode: s?.defaultCountryCode ?? "91",
  };
});

export type SiteInfo = Awaited<ReturnType<typeof getSite>>;

export const BUDGETS_SALE = [
  { value: "5000000", label: "Up to 50 L" },
  { value: "10000000", label: "Up to 1 Cr" },
  { value: "20000000", label: "Up to 2 Cr" },
  { value: "50000000", label: "Up to 5 Cr" },
];
export const BUDGETS_RENT = [
  { value: "25000", label: "Up to 25 K / month" },
  { value: "50000", label: "Up to 50 K / month" },
  { value: "100000", label: "Up to 1 L / month" },
];

export async function publicCities() {
  const rows = await db.property.findMany({ where: publicWhere, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } });
  return rows.map((r) => r.city);
}
