import Link from "next/link";
import { notFound } from "next/navigation";
import { startOfMonth, subDays } from "date-fns";
import { ArrowLeft, ExternalLink, Phone, Mail } from "lucide-react";
import { rawDb } from "@/lib/db";
import { requireSuperAdmin, orgMrr, ORG_STATUSES, BUSINESS_TYPES, AUDIT_LABELS } from "@/lib/admin";
import { orgAccess } from "@/lib/tenancy";
import { ROLES } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatRelative, toDateInput } from "@/lib/format";
import { waLink } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { WhatsAppIcon } from "@/components/ui/icons";
import { DeleteCompanyCard, LoginAsButton, ProfileForm, RecordInvoiceButton, SubscriptionPanel } from "./company-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await rawDb.organization.findUnique({ where: { id }, select: { name: true } });
  return { title: org?.name ?? "Company" };
}

function bytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const org = await rawDb.organization.findUnique({ where: { id }, include: { plan: true } });
  if (!org) notFound();

  const now = new Date();
  const where = { organizationId: id };
  const [plans, users, lastByUser, leads, properties, bookings, documents, storage, waMonth, activity30, invoices, audit, settings] = await Promise.all([
    rawDb.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    rawDb.user.findMany({ where, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true } }),
    rawDb.activity.groupBy({ by: ["userId"], where, _max: { createdAt: true } }),
    rawDb.lead.count({ where }),
    rawDb.property.count({ where }),
    rawDb.booking.count({ where }),
    rawDb.document.count({ where }),
    rawDb.document.aggregate({ where, _sum: { size: true } }),
    rawDb.whatsAppMessage.count({ where: { ...where, createdAt: { gte: startOfMonth(now) } } }),
    rawDb.activity.count({ where: { ...where, createdAt: { gte: subDays(now, 30) } } }),
    rawDb.invoice.findMany({ where, orderBy: { createdAt: "desc" } }),
    rawDb.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
    rawDb.settings.findUnique({ where, select: { companyName: true, companyPhone: true, websiteEnabled: true, logoUrl: true } }),
  ]);
  const lastMap = new Map(lastByUser.map((l) => [l.userId, l._max.createdAt]));
  const lastActivity = lastByUser.reduce<Date | null>((m, l) => (l._max.createdAt && (!m || l._max.createdAt > m) ? l._max.createdAt : m), null);
  const access = orgAccess(org, now);
  const mrr = orgMrr(org);
  const paidTotal = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  const limit = (used: number, max: number | undefined) => (max ? `${formatNumber(used)} / ${formatNumber(max)}` : formatNumber(used));
  const ownCompany = admin.organizationId === org.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/companies" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-4" /> All companies
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            {settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="size-14 rounded-xl border border-zinc-200 bg-white object-contain p-1" />
            ) : (
              <Avatar name={org.name} size="xl" className="rounded-xl" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{org.name}</h1>
                <OptionBadge list={ORG_STATUSES} value={org.status} withDot />
                {access.readOnly && <Badge className="bg-rose-50 text-rose-700 ring-rose-600/20">Read-only</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                <span>/{org.slug}</span>
                {org.ownerPhone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {org.ownerPhone}
                  </span>
                )}
                {org.ownerEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {org.ownerEmail}
                  </span>
                )}
                <span>Signed up {formatDate(org.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {org.ownerPhone && (
              <a href={waLink(org.ownerPhone, `Hi ${org.ownerName?.split(" ")[0] ?? ""}, `)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-sm font-medium text-white hover:bg-emerald-700">
                <WhatsAppIcon className="size-4" /> WhatsApp owner
              </a>
            )}
            {settings?.websiteEnabled && (
              <a href={`/site/${org.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <ExternalLink className="size-4" /> Public website
              </a>
            )}
          </div>
        </div>
        {org.status === "SUSPENDED" && org.suspendedReason && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            <span className="font-medium">Suspended:</span> {org.suspendedReason}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Plan" value={org.plan?.name ?? "None"} sub={org.plan ? `${org.billingCycle === "YEARLY" ? "Yearly" : "Monthly"} - ${formatCurrency(org.billingCycle === "YEARLY" ? org.plan.priceYearly : org.plan.priceMonthly)}` : "No plan selected"} />
        <Kpi
          label={org.status === "TRIAL" ? "Trial ends" : "Paid until"}
          value={formatDate(org.status === "TRIAL" ? org.trialEndsAt : org.currentPeriodEnd)}
          sub={access.daysLeft !== null ? (access.daysLeft > 0 ? `${access.daysLeft} days left` : "Ended") : "-"}
        />
        <Kpi label="MRR" value={mrr ? formatCurrency(Math.round(mrr)) : "-"} sub={`${formatCurrency(paidTotal)} paid in total`} />
        <Kpi label="Last activity" value={lastActivity ? formatRelative(lastActivity) : "Never"} sub={`${formatNumber(activity30)} actions in 30 days`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Subscription" description="Plan, status and billing dates" />
            <SubscriptionPanel
              org={{
                id: org.id,
                status: org.status,
                planId: org.planId,
                billingCycle: org.billingCycle,
                trialEndsAt: toDateInput(org.trialEndsAt),
                currentPeriodEnd: toDateInput(org.currentPeriodEnd),
                suspendedReason: org.suspendedReason,
              }}
              plans={plans.map((p) => ({ value: p.id, label: `${p.name}${p.active ? "" : " (inactive)"}`, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly }))}
              statuses={ORG_STATUSES}
            />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Users" description={`${users.length} of ${org.plan?.maxUsers ? org.plan.maxUsers : "unlimited"} seats`} />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-100">
                <thead className="bg-zinc-50/80">
                  <tr>
                    <th className="table-th">User</th>
                    <th className="table-th">Role</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Last activity</th>
                    <th className="table-th text-right">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <p className="font-medium text-zinc-900">{u.name}</p>
                            <p className="text-xs text-zinc-500">{[u.email, u.phone].filter(Boolean).join(" - ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <OptionBadge list={ROLES} value={u.role} />
                      </td>
                      <td className="table-td">{u.active ? <span className="text-emerald-700">Active</span> : <span className="text-zinc-400">Deactivated</span>}</td>
                      <td className="table-td text-zinc-600">{lastMap.get(u.id) ? formatRelative(lastMap.get(u.id)!) : "Never"}</td>
                      <td className="table-td text-right">
                        <LoginAsButton userId={u.id} name={u.name} disabled={!u.active || u.id === admin.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Company profile" />
            <ProfileForm
              businessTypes={BUSINESS_TYPES}
              org={{
                id: org.id,
                name: org.name,
                slug: org.slug,
                ownerName: org.ownerName,
                ownerEmail: org.ownerEmail,
                ownerPhone: org.ownerPhone,
                city: org.city,
                businessType: org.businessType,
                teamSize: org.teamSize,
                notes: org.notes,
              }}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Usage" />
            <dl className="divide-y divide-zinc-100 text-sm">
              <UsageRow label="Users" value={limit(users.filter((u) => u.active).length, org.plan?.maxUsers)} />
              <UsageRow label="Leads" value={limit(leads, org.plan?.maxLeads)} />
              <UsageRow label="Properties" value={limit(properties, org.plan?.maxProperties)} />
              <UsageRow label="Bookings" value={formatNumber(bookings)} />
              <UsageRow label="Documents" value={`${formatNumber(documents)} (${bytes(storage._sum.size ?? 0)}${org.plan ? ` of ${org.plan.storageGb} GB` : ""})`} />
              <UsageRow label="WhatsApp this month" value={formatNumber(waMonth)} />
              <UsageRow label="Activity (30 days)" value={formatNumber(activity30)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Invoices" description={`${invoices.length} recorded`} action={<RecordInvoiceButton orgId={org.id} />} />
            {invoices.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-zinc-500">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{i.number}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {formatDate(i.createdAt)}
                        {i.description ? ` - ${i.description}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900">{formatCurrency(i.amount)}</p>
                      <p className={i.status === "PAID" ? "text-xs text-emerald-700" : "text-xs text-rose-600"}>{i.status.charAt(0) + i.status.slice(1).toLowerCase()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Admin history" description="Changes made by platform admins" />
            {audit.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-zinc-500">No admin changes yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {audit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <p className="text-sm font-medium text-zinc-800">{AUDIT_LABELS[a.action] ?? a.action}</p>
                    <p className="text-xs text-zinc-500">
                      {a.actorEmail} - {formatDateTime(a.createdAt)}
                    </p>
                    {a.details && <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500">{a.details.length > 220 ? `${a.details.slice(0, 220)}...` : a.details}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="border-rose-200">
        <CardHeader title={<span className="text-rose-700">Danger zone</span>} description={ownCompany ? "This is the company your admin account belongs to, so it cannot be deleted." : undefined} />
        <DeleteCompanyCard orgId={org.id} slug={org.slug} name={org.name} disabled={ownCompany} />
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-900">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
