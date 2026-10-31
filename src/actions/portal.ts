"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { PORTAL_COOKIE_MAX_AGE, portalCookieName, portalCookieValue } from "@/lib/portal-session";

async function canAccessLead(leadId: string) {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedToId: true } });
  if (!lead || (user.role === "AGENT" && lead.assignedToId !== user.id)) return null;
  return user;
}

/** Creates the customer's private portal link, or rotates it (old link stops working). Optional 4-6 digit PIN. */
export async function createOrRotatePortalAccess(leadId: string, pin?: string): Promise<ActionResult<{ token: string }>> {
  const user = await canAccessLead(leadId);
  if (!user) return { error: "Lead not found or access denied." };
  const cleanPin = (pin ?? "").trim();
  if (cleanPin && !/^\d{4,6}$/.test(cleanPin)) return { error: "PIN must be 4 to 6 digits." };
  const token = randomBytes(24).toString("base64url");
  const pinHash = cleanPin ? await bcrypt.hash(cleanPin, 10) : null;
  const existing = await db.portalAccess.findUnique({ where: { leadId } });
  await db.portalAccess.upsert({
    where: { leadId },
    create: { leadId, token, pin: pinHash },
    update: { token, pin: pinHash, revokedAt: null, lastViewedAt: null },
  });
  await logActivity({
    type: "NOTE",
    content: existing ? `Customer portal link regenerated${cleanPin ? " with PIN" : ""}` : `Customer portal link created${cleanPin ? " with PIN" : ""}`,
    leadId,
    userId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { token } };
}

export async function revokePortalAccess(leadId: string): Promise<ActionResult> {
  const user = await canAccessLead(leadId);
  if (!user) return { error: "Lead not found or access denied." };
  await db.portalAccess.updateMany({ where: { leadId }, data: { revokedAt: new Date() } });
  await logActivity({ type: "NOTE", content: "Customer portal access revoked", leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

const MAX_PIN_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Public: customer enters the PIN for their portal link. */
export async function unlockPortal(token: string, _prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string } | undefined> {
  const access = await db.portalAccess.findUnique({ where: { token } });
  if (!access || access.revokedAt) return { error: "This link is no longer valid. Please contact your relationship manager." };
  if (!access.pin) redirect(`/portal/${token}`);
  const key = `portal:${token}`;
  const since = new Date(Date.now() - WINDOW_MS);
  const fails = await db.loginAttempt.count({ where: { key, success: false, createdAt: { gte: since } } });
  if (fails >= MAX_PIN_FAILS) return { error: "Too many wrong attempts. Please try again in 15 minutes." };

  const pin = String(fd.get("pin") ?? "").trim();
  const ok = /^\d{4,6}$/.test(pin) && (await bcrypt.compare(pin, access.pin));
  await db.loginAttempt.create({ data: { key, success: ok } });
  if (!ok) {
    const left = MAX_PIN_FAILS - fails - 1;
    return { error: left > 0 ? `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Please try again in 15 minutes." };
  }
  const h = await headers();
  const secure = (h.get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
  (await cookies()).set(portalCookieName(token), portalCookieValue(token), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: PORTAL_COOKIE_MAX_AGE });
  redirect(`/portal/${token}`);
}
