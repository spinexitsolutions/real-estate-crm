import { startOfMonth } from "date-fns";
import { UserCog } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { TeamTable, type TeamMember } from "./team-table";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const settings = await getSettings();
  const monthStart = startOfMonth(new Date());

  const [users, openLeads, wonDeals] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    db.lead.groupBy({ by: ["assignedToId"], where: { status: { in: OPEN_LEAD_STATUSES } }, _count: { _all: true } }),
    db.deal.groupBy({ by: ["agentId"], where: { stage: "WON", closedAt: { gte: monthStart } }, _count: { _all: true }, _sum: { value: true } }),
  ]);

  const members: TeamMember[] = users.map((u) => {
    const deals = wonDeals.find((d) => d.agentId === u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      monthlyTarget: u.monthlyTarget,
      openLeads: openLeads.find((l) => l.assignedToId === u.id)?._count._all ?? 0,
      wonThisMonth: deals?._count._all ?? 0,
      revenueThisMonth: deals?._sum.value ?? 0,
    };
  });

  const active = members.filter((m) => m.active).length;

  return (
    <div>
      <PageHeader
        title="Team"
        description={`${active} active member${active === 1 ? "" : "s"}${members.length > active ? `, ${members.length - active} inactive` : ""}`}
        icon={UserCog}
      />
      <TeamTable members={members} currentUserId={user.id} canEdit={user.role === "ADMIN"} currency={settings.currency} />
    </div>
  );
}
