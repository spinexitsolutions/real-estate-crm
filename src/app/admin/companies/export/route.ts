import { getSuperAdmin } from "@/lib/admin";
import { loadCompanies } from "@/lib/admin-companies";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  if (!(await getSuperAdmin())) return new Response("Not found", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const rows = await loadCompanies(sp);
  const csv = toCsv(
    ["Company", "Slug", "Owner", "Owner email", "Owner phone", "City", "Business type", "Team size", "Plan", "Billing", "Status", "Trial ends", "Paid until", "Users", "Leads", "Properties", "MRR", "Last activity", "Created"],
    rows.map((o) => [
      o.name,
      o.slug,
      o.ownerName,
      o.ownerEmail,
      o.ownerPhone,
      o.city,
      o.businessType,
      o.teamSize,
      o.plan?.name ?? "",
      o.billingCycle,
      o.status,
      o.trialEndsAt?.toISOString().slice(0, 10) ?? "",
      o.currentPeriodEnd?.toISOString().slice(0, 10) ?? "",
      o._count.users,
      o._count.leads,
      o._count.properties,
      Math.round(o.mrr),
      o.lastActivity?.toISOString() ?? "",
      o.createdAt.toISOString(),
    ]),
  );
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
