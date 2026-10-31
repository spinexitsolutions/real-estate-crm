import { endOfDay } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { isSuperAdminEmail, requireUser } from "@/lib/auth";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getOrgPlan, readOnlyReasonFor } from "@/lib/plans";
import { planFeatures } from "@/lib/billing-core";
import { orgAccess } from "@/lib/tenancy";
import { StatusBanner } from "@/components/billing/status-banner";
import { SuspendedScreen } from "@/components/billing/suspended-screen";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  const org = await getOrgPlan(user.organizationId);
  const access = org ? orgAccess(org) : null;
  const readOnlyReason = readOnlyReasonFor(org);
  const isAdmin = user.role === "ADMIN";
  const now = new Date();
  const where = {
    status: "PENDING",
    dueAt: { lte: endOfDay(now) },
    ...(user.role === "AGENT" ? { assignedToId: user.id } : {}),
  };
  const [count, due, waUnread] = await Promise.all([
    db.followUp.count({ where }),
    db.followUp.findMany({
      where,
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { lead: { select: { name: true } } },
    }),
    db.lead.aggregate({
      where: { unreadMessages: { gt: 0 }, ...(user.role === "AGENT" ? { assignedToId: user.id } : {}) },
      _sum: { unreadMessages: true },
    }),
  ]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      company={settings.companyName}
      logoUrl={settings.logoUrl}
      features={planFeatures(org?.plan)}
      readOnlyReason={readOnlyReason}
      statusBanner={access ? <StatusBanner state={access.state} daysLeft={access.daysLeft} readOnly={access.readOnly} isAdmin={isAdmin} /> : null}
      suspendedScreen={
        access?.state === "suspended" ? <SuspendedScreen supportEmail={process.env.PLATFORM_SUPPORT_EMAIL} supportPhone={process.env.PLATFORM_SUPPORT_PHONE} /> : undefined
      }
      topBanner={<ImpersonationBanner />}
      isSuperAdmin={isSuperAdminEmail(user.email) && !user.impersonatorId}
      needsOnboarding={isAdmin && !!org && !org.onboardedAt}
      followupCount={count}
      whatsappUnread={waUnread._sum.unreadMessages ?? 0}
      notifications={due.map((f) => ({
        id: f.id,
        title: f.title,
        type: f.type,
        dueAt: f.dueAt.toISOString(),
        leadId: f.leadId,
        leadName: f.lead.name,
        overdue: f.dueAt < now,
      }))}
    >
      {children}
    </AppShell>
  );
}
