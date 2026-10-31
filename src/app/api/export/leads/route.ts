import type { Prisma } from "@prisma/client";
import { getCurrentUser, leadScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { labelOf, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PURPOSES, PROPERTY_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const source = sp.get("source");
  const priority = sp.get("priority");
  const assignee = sp.get("assignee");

  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { preferredLocation: { contains: q } }];
  if (status) where.status = status;
  if (source) where.source = source;
  if (priority) where.priority = priority;
  if (assignee && user.role !== "AGENT") where.assignedToId = assignee === "unassigned" ? null : assignee;

  const leads = await db.lead.findMany({ where, include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } });

  const csv = toCsv(
    ["Name", "Phone", "Email", "Status", "Priority", "Source", "Purpose", "Property Type", "Location", "Bedrooms", "Budget Min", "Budget Max", "Assigned To", "Tags", "Created At", "Last Contacted"],
    leads.map((l) => [
      l.name,
      l.phone,
      l.email ?? "",
      labelOf(LEAD_STATUSES, l.status),
      labelOf(PRIORITIES, l.priority),
      labelOf(LEAD_SOURCES, l.source),
      labelOf(PURPOSES, l.purpose),
      l.propertyType ? labelOf(PROPERTY_TYPES, l.propertyType) : "",
      l.preferredLocation ?? "",
      l.bedrooms ?? "",
      l.budgetMin ?? "",
      l.budgetMax ?? "",
      l.assignedTo?.name ?? "",
      l.tags,
      formatDateTime(l.createdAt),
      l.lastContactedAt ? formatDateTime(l.lastContactedAt) : "",
    ]),
  );

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
