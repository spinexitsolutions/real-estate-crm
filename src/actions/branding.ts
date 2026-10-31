"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { optStr, str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

async function guard() {
  const u = await getCurrentUser();
  return u && u.role === "ADMIN" ? u : null;
}

async function upsert(data: Record<string, unknown>) {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/", "layout");
  revalidatePath("/site", "layout");
}

function validLogoUrl(v: string | null) {
  if (!v) return null;
  return /^https:\/\//i.test(v) || v.startsWith("/uploads/") ? v : undefined;
}

export async function saveBranding(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change branding." };
  const logoUrl = validLogoUrl(optStr(fd, "logoUrl"));
  if (logoUrl === undefined) return { error: "Logo must be an uploaded image or an https link." };
  const brandColor = str(fd, "brandColor").toLowerCase() || "#4f46e5";
  if (!/^#[0-9a-f]{6}$/.test(brandColor)) return { error: "Brand colour must be a hex value like #4f46e5." };
  const reraNumber = optStr(fd, "reraNumber");
  if (reraNumber && reraNumber.length > 80) return { error: "RERA number is too long." };
  await upsert({ logoUrl, brandColor, reraNumber });
  return { ok: true };
}

export async function saveWebsite(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change website settings." };
  const websiteEnabled = fd.get("websiteEnabled") === "on" || fd.get("websiteEnabled") === "true";
  const websiteTagline = optStr(fd, "websiteTagline");
  const websiteAbout = optStr(fd, "websiteAbout");
  if (websiteTagline && websiteTagline.length > 160) return { error: "Tagline should be under 160 characters." };
  if (websiteAbout && websiteAbout.length > 2000) return { error: "About text should be under 2000 characters." };
  await upsert({ websiteEnabled, websiteTagline, websiteAbout });
  return { ok: true };
}
