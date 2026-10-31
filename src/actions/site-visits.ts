"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { distanceMeters, formatDistance, isValidCoord } from "@/lib/geo";

export type SiteCheckInInput = {
  leadId: string;
  propertyId?: string | null;
  followUpId?: string | null;
  lat: number;
  lng: number;
  accuracy?: number | null;
  notes?: string | null;
};

export async function checkInAtSite(input: SiteCheckInInput): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  if (!isValidCoord(input.lat, input.lng)) return { error: "Could not read your location. Please allow location access and try again." };

  const lead = await db.lead.findUnique({ where: { id: input.leadId }, select: { id: true, name: true, assignedToId: true, status: true } });
  if (!lead) return { error: "Lead not found." };

  const followUp = input.followUpId ? await db.followUp.findUnique({ where: { id: input.followUpId } }) : null;
  if (input.followUpId && (!followUp || followUp.leadId !== lead.id)) return { error: "Follow-up not found." };
  if (user.role === "AGENT" && lead.assignedToId !== user.id && followUp?.assignedToId !== user.id) {
    return { error: "You can only check in for your own leads." };
  }

  const propertyId = input.propertyId ?? followUp?.propertyId ?? null;
  const property = propertyId ? await db.property.findUnique({ where: { id: propertyId }, select: { id: true, title: true, latitude: true, longitude: true } }) : null;
  const distance = property?.latitude != null && property.longitude != null ? distanceMeters(input.lat, input.lng, property.latitude, property.longitude) : null;

  await db.siteVisitCheckIn.create({
    data: {
      leadId: lead.id,
      propertyId: property?.id ?? null,
      followUpId: followUp?.id ?? null,
      userId: user.id,
      latitude: input.lat,
      longitude: input.lng,
      accuracy: input.accuracy ?? null,
      distanceM: distance,
      notes: input.notes?.trim() || null,
    },
  });

  const where = property ? `at ${property.title}` : "at site";
  const dist = distance !== null ? ` (${formatDistance(distance)} from the property location)` : "";
  await logActivity({
    type: "SITE_VISIT",
    content: `Checked in ${where}${dist}${input.notes?.trim() ? `\n${input.notes.trim()}` : ""}`,
    leadId: lead.id,
    propertyId: property?.id ?? null,
    userId: user.id,
  });

  if (followUp && followUp.status === "PENDING") {
    await db.followUp.update({
      where: { id: followUp.id },
      data: { status: "COMPLETED", completedAt: new Date(), outcome: "Site visit done", notes: [followUp.notes, input.notes?.trim()].filter(Boolean).join("\n") || null },
    });
  }
  await db.lead.update({
    where: { id: lead.id },
    data: { lastContactedAt: new Date(), ...(["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status) ? { status: "SITE_VISIT" } : {}) },
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { message: `Checked in ${where}${distance !== null ? ` - ${formatDistance(distance)} away` : ""}` } };
}
