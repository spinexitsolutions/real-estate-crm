"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, isManager } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { assertWithinLimit, guardWritable } from "@/lib/plans";
import { optInt, optNum, optStr, parseImages, str } from "@/lib/utils";
import { labelOf, PROPERTY_STATUSES } from "@/lib/constants";
import { deleteImages } from "@/lib/storage";

function readProperty(fd: FormData) {
  const images = fd
    .getAll("images")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => /^https?:\/\//i.test(v) || v.startsWith("/uploads/"));
  const amenities = fd
    .getAll("amenities")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    type: str(fd, "type") || "APARTMENT",
    listingType: str(fd, "listingType") || "SALE",
    status: str(fd, "status") || "AVAILABLE",
    price: optNum(fd, "price"),
    area: optNum(fd, "area"),
    areaUnit: str(fd, "areaUnit") || "sqft",
    bedrooms: optInt(fd, "bedrooms"),
    bathrooms: optInt(fd, "bathrooms"),
    furnishing: optStr(fd, "furnishing"),
    address: optStr(fd, "address"),
    locality: optStr(fd, "locality"),
    city: str(fd, "city"),
    amenities: amenities.join(", "),
    images: JSON.stringify(images),
    ownerName: optStr(fd, "ownerName"),
    ownerPhone: optStr(fd, "ownerPhone"),
    featured: fd.get("featured") === "on" || fd.get("featured") === "true",
    published: fd.get("published") === "on" || fd.get("published") === "true",
    latitude: validCoord(optNum(fd, "latitude"), 90),
    longitude: validCoord(optNum(fd, "longitude"), 180),
    agentId: optStr(fd, "agentId"),
  };
}

function validCoord(v: number | null, max: number) {
  return v !== null && Math.abs(v) <= max ? v : null;
}

async function nextCode() {
  const all = await db.property.findMany({ select: { code: true } });
  let max = 1000;
  for (const p of all) {
    const n = Number(p.code.replace(/\D/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `PR-${max + 1}`;
}

export async function createProperty(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const locked = await guardWritable();
  if (locked) return { error: locked };
  const overLimit = await assertWithinLimit("properties");
  if (overLimit) return { error: overLimit };
  const data = readProperty(fd);
  if (!data.title) return { error: "Title is required." };
  if (!data.city) return { error: "City is required." };
  if (data.price === null || data.price <= 0) return { error: "Please enter a valid price." };
  const property = await db.property.create({
    data: { ...data, price: data.price, code: await nextCode(), agentId: data.agentId ?? user.id },
  });
  await logActivity({ type: "PROPERTY", content: `Property listed: ${property.title}`, propertyId: property.id, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: property.id } };
}

export async function updateProperty(id: string, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const existing = await db.property.findUnique({ where: { id } });
  if (!existing) return { error: "Property not found." };
  const data = readProperty(fd);
  if (!data.title) return { error: "Title is required." };
  if (!data.city) return { error: "City is required." };
  if (data.price === null || data.price <= 0) return { error: "Please enter a valid price." };
  await db.property.update({ where: { id }, data: { ...data, price: data.price } });
  const kept = new Set(parseImages(data.images));
  const removed = parseImages(existing.images).filter((u) => !kept.has(u));
  if (removed.length) await deleteImages(removed);
  if (existing.status !== data.status) {
    await logActivity({ type: "STATUS", content: `Status changed to ${labelOf(PROPERTY_STATUSES, data.status)}`, propertyId: id, userId: user.id });
  } else {
    await logActivity({ type: "PROPERTY", content: "Property details updated", propertyId: id, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id } };
}

export async function updatePropertyStatus(id: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!PROPERTY_STATUSES.some((s) => s.value === status)) return { error: "Invalid status." };
  await db.property.update({ where: { id }, data: { status } });
  await logActivity({ type: "STATUS", content: `Status changed to ${labelOf(PROPERTY_STATUSES, status)}`, propertyId: id, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleFeatured(id: string): Promise<ActionResult> {
  await requireUser();
  const p = await db.property.findUnique({ where: { id }, select: { featured: true } });
  if (!p) return { error: "Property not found." };
  await db.property.update({ where: { id }, data: { featured: !p.featured } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function publishProperty(id: string, published: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const p = await db.property.findUnique({ where: { id }, select: { id: true } });
  if (!p) return { error: "Property not found." };
  await db.property.update({ where: { id }, data: { published } });
  await logActivity({ type: "PROPERTY", content: published ? "Published on the public website" : "Removed from the public website", propertyId: id, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isManager(user)) {
    const p = await db.property.findUnique({ where: { id }, select: { agentId: true } });
    if (p?.agentId !== user.id) return { error: "Only managers or the listing agent can delete this property." };
  }
  const deleted = await db.property.delete({ where: { id } });
  await deleteImages(parseImages(deleted.images));
  revalidatePath("/", "layout");
  redirect("/properties");
}

export async function toggleShortlist(leadId: string, propertyId: string): Promise<ActionResult<{ shortlisted: boolean }>> {
  const user = await requireUser();
  const [lead, property] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedToId: true } }),
    db.property.findUnique({ where: { id: propertyId }, select: { id: true, title: true, code: true } }),
  ]);
  if (!lead || !property) return { error: "Lead or property not found." };
  if (user.role === "AGENT" && lead.assignedToId !== user.id) return { error: "You do not have access to this lead." };

  const existing = await db.leadProperty.findUnique({ where: { leadId_propertyId: { leadId, propertyId } } });
  if (existing) {
    await db.leadProperty.delete({ where: { leadId_propertyId: { leadId, propertyId } } });
    await logActivity({ type: "PROPERTY", content: `Removed ${property.code} (${property.title}) from shortlist`, leadId, propertyId, userId: user.id });
  } else {
    await db.leadProperty.create({ data: { leadId, propertyId } });
    await logActivity({ type: "PROPERTY", content: `Shortlisted ${property.code} (${property.title})`, leadId, propertyId, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { shortlisted: !existing } };
}
