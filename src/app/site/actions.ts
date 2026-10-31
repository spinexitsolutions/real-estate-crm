"use server";

import { headers } from "next/headers";
import { subMinutes } from "date-fns";
import { db } from "@/lib/db";
import { intakeLead } from "@/lib/lead-intake";
import { publicWhere } from "@/lib/site";
import { formatDate } from "@/lib/format";
import { str } from "@/lib/utils";

export type EnquiryState = { ok?: boolean; error?: string } | undefined;

const WINDOW_MIN = 10;
const MAX_PER_WINDOW = 5;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Website enquiry form: creates (or updates) a lead in the CRM, auto-assigned with a call reminder. */
export async function submitEnquiry(_: EnquiryState, fd: FormData): Promise<EnquiryState> {
  // Honeypot: real people never fill this hidden field
  if (str(fd, "company_website")) return { ok: true };

  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { websiteEnabled: true } });
  if (!settings?.websiteEnabled) return { error: "Enquiries are not being accepted right now." };

  const name = str(fd, "name").slice(0, 120);
  const phone = str(fd, "phone");
  const email = str(fd, "email").slice(0, 160);
  const message = str(fd, "message").slice(0, 1500);
  const visitDate = str(fd, "visitDate");
  const propertyId = str(fd, "propertyId") || null;

  if (name.length < 2) return { error: "Please enter your name." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return { error: "Please enter a valid mobile number." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };

  const ip = await clientIp();
  const key = `enquiry:${ip}`;
  const recent = await db.loginAttempt.count({ where: { key, createdAt: { gte: subMinutes(new Date(), WINDOW_MIN) } } });
  if (recent >= MAX_PER_WINDOW) return { error: "Too many enquiries from this device. Please try again in a few minutes or call us." };
  await db.loginAttempt.create({ data: { key, success: true } });

  let property: { id: string; code: string; title: string; listingType: string; type: string; bedrooms: number | null; city: string; locality: string | null; price: number } | null = null;
  if (propertyId) {
    property = await db.property.findFirst({
      where: { id: propertyId, ...publicWhere },
      select: { id: true, code: true, title: true, listingType: true, type: true, bedrooms: true, city: true, locality: true, price: true },
    });
  }

  const visit = visitDate && /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? formatDate(`${visitDate}T12:00:00`) : null;
  const fullMessage = [
    property ? `Enquiry for ${property.code} - ${property.title}` : "General enquiry from the website",
    message || null,
    visit ? `Preferred site visit: ${visit}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await intakeLead({
      name,
      phone,
      email: email || null,
      source: "WEBSITE",
      channelLabel: property ? `Website - ${property.code}` : "Website",
      message: fullMessage,
      propertyId: property?.id ?? null,
      purpose: property ? (property.listingType === "RENT" ? "RENT" : "BUY") : null,
      propertyType: property?.type ?? null,
      bedrooms: property?.bedrooms ?? null,
      location: property ? [property.locality, property.city].filter(Boolean).join(", ") : null,
      budget: property?.price ?? null,
      tags: visit ? ["Site visit requested"] : [],
    });
    await db.integrationLog.create({
      data: {
        source: "PUBLIC_SITE",
        status: res.ok ? (res.duplicate ? "DUPLICATE" : "OK") : "ERROR",
        message: res.ok ? (property ? `Enquiry for ${property.code}` : "General enquiry") : res.error,
        payload: JSON.stringify({ name, phone: digits.slice(-4).padStart(digits.length, "*"), propertyId, visitDate: visitDate || null }),
        leadId: res.ok ? res.leadId : null,
      },
    });
    if (!res.ok) return { error: res.error };
    return { ok: true };
  } catch (e) {
    console.error("Website enquiry failed", e);
    return { error: "Something went wrong. Please call us directly." };
  }
}
