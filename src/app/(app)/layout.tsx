import { endOfDay } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
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
