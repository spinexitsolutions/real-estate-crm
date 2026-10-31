import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";

export type DocLinks = { leadId?: string | null; dealId?: string | null; bookingId?: string | null; propertyId?: string | null };

/**
 * Resolves the lead a document belongs to (directly, or via its deal/booking) and checks the user may use it.
 * Agents may only touch documents of leads assigned to them. Property-only documents are visible to the team.
 */
export async function resolveDocLinks(user: CurrentUser, links: DocLinks): Promise<{ ok: true; leadId: string | null; dealId: string | null; bookingId: string | null; propertyId: string | null } | { ok: false; error: string }> {
  let leadId = links.leadId || null;
  const dealId = links.dealId || null;
  const bookingId = links.bookingId || null;
  let propertyId = links.propertyId || null;

  if (dealId) {
    const deal = await db.deal.findUnique({ where: { id: dealId }, select: { leadId: true, propertyId: true } });
    if (!deal) return { ok: false, error: "Deal not found." };
    leadId = leadId ?? deal.leadId;
    propertyId = propertyId ?? deal.propertyId;
  }
  if (bookingId) {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { leadId: true, propertyId: true } });
    if (!booking) return { ok: false, error: "Booking not found." };
    leadId = leadId ?? booking.leadId;
    propertyId = propertyId ?? booking.propertyId;
  }
  if (!leadId && !propertyId) return { ok: false, error: "Attach the document to a lead, deal, booking or property." };
  if (leadId) {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
    if (!lead) return { ok: false, error: "Lead not found." };
    if (user.role === "AGENT" && lead.assignedToId !== user.id) return { ok: false, error: "You can only manage documents of your own leads." };
  }
  return { ok: true, leadId, dealId, bookingId, propertyId };
}

/** Prisma filter limiting documents to what the user may see. */
export function documentScope(user: CurrentUser): Prisma.DocumentWhereInput {
  if (user.role !== "AGENT") return {};
  return { OR: [{ lead: { assignedToId: user.id } }, { leadId: null }] };
}

export async function getDocumentForUser(user: CurrentUser, id: string) {
  const doc = await db.document.findUnique({ where: { id }, include: { lead: { select: { id: true, name: true, assignedToId: true } } } });
  if (!doc) return null;
  if (user.role === "AGENT" && doc.leadId && doc.lead?.assignedToId !== user.id) return null;
  return doc;
}
