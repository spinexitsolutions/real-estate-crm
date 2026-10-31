"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { db, requireOrgId } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/action";
import { distanceMeters, formatDistance, isValidCoord } from "@/lib/geo";
import { inAppTz } from "@/lib/timezone";

export type GeoInput = { lat: number; lng: number; accuracy?: number | null; notes?: string | null };

function todayKey(d = new Date()) {
  return format(inAppTz(d), "yyyy-MM-dd");
}

async function officeDistance(lat: number, lng: number) {
  const s = await db.settings.findFirst({ select: { officeLatitude: true, officeLongitude: true, officeRadiusM: true } });
  if (s?.officeLatitude === null || s?.officeLatitude === undefined || s.officeLongitude === null) return { distance: null as number | null, radius: s?.officeRadiusM ?? 300 };
  return { distance: distanceMeters(lat, lng, s.officeLatitude, s.officeLongitude), radius: s.officeRadiusM };
}

export async function checkIn(input: GeoInput): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  if (!isValidCoord(input.lat, input.lng)) return { error: "Could not read your location. Please allow location access and try again." };
  const date = todayKey();
  const existing = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing) return { error: "You have already checked in today." };
  const { distance, radius } = await officeDistance(input.lat, input.lng);

  await db.attendance.create({
    data: {
      userId: user.id,
      date,
      checkInAt: new Date(),
      checkInLat: input.lat,
      checkInLng: input.lng,
      checkInAccuracy: input.accuracy ?? null,
      checkInDistanceM: distance,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath("/attendance");
  const where = distance === null ? "" : distance <= radius ? " at office" : ` - ${formatDistance(distance)} from office (outside the ${radius} m radius)`;
  return { ok: true, data: { message: `Checked in${where}` } };
}

export async function checkOut(input: GeoInput): Promise<ActionResult<{ message: string }>> {
  const user = await requireUser();
  if (!isValidCoord(input.lat, input.lng)) return { error: "Could not read your location. Please allow location access and try again." };
  const date = todayKey();
  const existing = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!existing) return { error: "You have not checked in today." };
  if (existing.checkOutAt) return { error: "You have already checked out today." };
  const { distance } = await officeDistance(input.lat, input.lng);
  const now = new Date();
  await db.attendance.update({
    where: { id: existing.id },
    data: {
      checkOutAt: now,
      checkOutLat: input.lat,
      checkOutLng: input.lng,
      checkOutDistanceM: distance,
      ...(input.notes?.trim() ? { notes: [existing.notes, input.notes.trim()].filter(Boolean).join("\n") } : {}),
    },
  });
  revalidatePath("/attendance");
  const mins = Math.round((now.getTime() - existing.checkInAt.getTime()) / 60000);
  return { ok: true, data: { message: `Checked out after ${Math.floor(mins / 60)}h ${mins % 60}m` } };
}

export async function saveOfficeLocation(input: { lat: number | null; lng: number | null; radius: number }): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can set the office location." };
  if (input.lat !== null || input.lng !== null) {
    if (!isValidCoord(input.lat, input.lng)) return { error: "Please enter a valid latitude and longitude." };
  }
  const radius = Math.round(Number(input.radius) || 300);
  if (radius < 50 || radius > 20000) return { error: "Radius must be between 50 m and 20 km." };
  await db.settings.upsert({
    where: { organizationId: await requireOrgId() },
    create: { officeLatitude: input.lat, officeLongitude: input.lng, officeRadiusM: radius },
    update: { officeLatitude: input.lat, officeLongitude: input.lng, officeRadiusM: radius },
  });
  revalidatePath("/attendance");
  return { ok: true };
}
