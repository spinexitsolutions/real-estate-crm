import "server-only";
import type { Prisma } from "@prisma/client";
import { rawDb } from "./db";
import { orgMrr } from "./admin";

export type CompanyFilters = { q?: string; status?: string; plan?: string; type?: string; sort?: string };

/** Companies with usage counts for the admin list / CSV (filtered + sorted in memory; platform scale). */
export async function loadCompanies(f: CompanyFilters) {
  const where: Prisma.OrganizationWhereInput = {};
  if (f.q) {
    const q = f.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { ownerEmail: { contains: q, mode: "insensitive" } },
      { ownerPhone: { contains: q } },
      { ownerName: { contains: q, mode: "insensitive" } },
      { users: { some: { email: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (f.status) where.status = f.status;
  if (f.plan) where.planId = f.plan === "none" ? null : f.plan;
  if (f.type) where.businessType = f.type;

  const orgs = await rawDb.organization.findMany({
    where,
    include: {
      plan: { select: { id: true, name: true, priceMonthly: true, priceYearly: true } },
      _count: { select: { users: true, leads: true, properties: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const ids = orgs.map((o) => o.id);
  const last = ids.length
    ? await rawDb.activity.groupBy({ by: ["organizationId"], where: { organizationId: { in: ids } }, _max: { createdAt: true } })
    : [];
  const lastMap = new Map(last.map((l) => [l.organizationId, l._max.createdAt]));
  const rows = orgs.map((o) => ({ ...o, mrr: orgMrr(o), lastActivity: lastMap.get(o.id) ?? null }));
  if (f.sort === "mrr") rows.sort((a, b) => b.mrr - a.mrr);
  else if (f.sort === "active") rows.sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));
  else if (f.sort === "oldest") rows.reverse();
  else if (f.sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}
