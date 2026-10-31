import { UserCog } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OPEN_LEAD_STATUSES, ROLES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/card";
import { ProfileForms } from "./profile-forms";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [record, openLeads, pending, won] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
    db.lead.count({ where: { assignedToId: user.id, status: { in: OPEN_LEAD_STATUSES } } }),
    db.followUp.count({ where: { assignedToId: user.id, status: "PENDING" } }),
    db.deal.count({ where: { agentId: user.id, stage: "WON" } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My profile" description="Your personal details and security" icon={UserCog} />
      <div className="card mb-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={user.name} size="xl" />
        <div className="flex-1">
          <p className="text-lg font-semibold text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-500">
            {user.email} - {labelOf(ROLES, user.role)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Member since {formatDate(record?.createdAt)}</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-200 text-center">
          {[
            ["Open leads", openLeads],
            ["Pending tasks", pending],
            ["Deals won", won],
          ].map(([l, v]) => (
            <div key={l as string} className="px-4 py-2.5">
              <p className="text-lg font-semibold text-slate-900">{v}</p>
              <p className="text-[11px] text-slate-500">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <ProfileForms name={user.name} phone={user.phone ?? ""} email={user.email} />
    </div>
  );
}
