import Link from "next/link";
import { startOfMonth } from "date-fns";
import { CircleCheck, CircleX, FileText, Megaphone, MessageSquareText, PlugZap, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatRelative } from "@/lib/format";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { Pagination, SearchInput, FilterSelect, ClearFilters } from "@/components/ui/filters";
import { WhatsAppIcon } from "@/components/ui/icons";
import { TemplatesManager } from "./templates-manager";
import { BroadcastPanel } from "./broadcast-panel";

export const metadata = { title: "WhatsApp" };

const PAGE_SIZE = 20;

type SP = { tab?: string; q?: string; channel?: string; page?: string };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const settings = await getSettings();
  const tab = ["templates", "broadcast", "log"].includes(sp.tab ?? "") ? sp.tab! : "templates";
  const apiReady = Boolean(settings.waApiEnabled && settings.waPhoneNumberId && settings.waAccessToken);

  const msgScope: Prisma.WhatsAppMessageWhereInput = user.role === "AGENT" ? { userId: user.id } : {};
  const monthStart = startOfMonth(new Date());
  const [templates, sentMonth, failedMonth, reached] = await Promise.all([
    db.whatsAppTemplate.findMany({ orderBy: { createdAt: "asc" } }),
    db.whatsAppMessage.count({ where: { ...msgScope, createdAt: { gte: monthStart }, status: "SENT" } }),
    db.whatsAppMessage.count({ where: { ...msgScope, createdAt: { gte: monthStart }, status: "FAILED" } }),
    db.whatsAppMessage.groupBy({ by: ["leadId"], where: { ...msgScope, createdAt: { gte: monthStart }, leadId: { not: null } } }),
  ]);

  const tabs = [
    { value: "templates", label: "Templates", icon: FileText },
    { value: "broadcast", label: "Broadcast", icon: Megaphone },
    { value: "log", label: "Message log", icon: MessageSquareText },
  ];

  return (
    <div>
      <PageHeader icon={WhatsAppIcon} title="WhatsApp" description="Templates, bulk messaging and a complete log of every conversation started from the CRM." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Messages this month" value={sentMonth} icon={Send} tone="emerald" sub="Successfully sent" />
        <StatCard label="Leads reached" value={reached.length} icon={MessageSquareText} tone="sky" sub="Unique leads this month" />
        <StatCard label="Templates" value={templates.length} icon={FileText} tone="violet" sub="Ready to use" />
        <StatCard label="Failed" value={failedMonth} icon={CircleX} tone="rose" sub="API delivery errors" />
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", apiReady ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
            <PlugZap className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">WhatsApp Business API</p>
              {apiReady ? (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" dot="bg-emerald-500">
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20" dot="bg-amber-500">
                  Click-to-chat mode
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {apiReady
                ? "Messages can be sent directly from the CRM and are delivered through your WhatsApp Business number."
                : "Messages open in WhatsApp Web or the app with text pre-filled. Connect the Cloud API to send directly and broadcast automatically."}
            </p>
          </div>
          {user.role === "ADMIN" && (
            <Link href="/settings" className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50">
              {apiReady ? "Manage" : "Set up API"}
            </Link>
          )}
        </div>
      </Card>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value === "templates" ? "/whatsapp" : `/whatsapp?tab=${t.value}`}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              tab === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "templates" && (
        <TemplatesManager templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, body: t.body, updatedAt: t.updatedAt.toISOString() }))} canDelete={manager} />
      )}

      {tab === "broadcast" && (
        <BroadcastPanel
          templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, body: t.body }))}
          apiEnabled={apiReady}
          manager={manager}
          users={manager ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : []}
          statuses={LEAD_STATUSES}
          priorities={PRIORITIES}
          sources={LEAD_SOURCES}
          company={settings.companyName}
          agentName={user.name}
        />
      )}

      {tab === "log" && <MessageLog sp={sp} scope={msgScope} />}
    </div>
  );
}

async function MessageLog({ sp, scope }: { sp: SP; scope: Prisma.WhatsAppMessageWhereInput }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.WhatsAppMessageWhereInput = {
    ...scope,
    ...(sp.channel ? { channel: sp.channel } : {}),
    ...(sp.q
      ? { OR: [{ phone: { contains: sp.q } }, { body: { contains: sp.q } }, { lead: { name: { contains: sp.q } } }] }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.whatsAppMessage.count({ where }),
    db.whatsAppMessage.findMany({
      where,
      include: { lead: { select: { id: true, name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-4">
        <SearchInput placeholder="Search lead, phone or message" className="w-full sm:w-72" />
        <FilterSelect
          param="channel"
          placeholder="All channels"
          options={[
            { value: "LINK", label: "Click-to-chat" },
            { value: "API", label: "Business API" },
          ]}
        />
        <ClearFilters keys={["q", "channel"]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No messages yet" description="Messages you send to leads from the CRM will be logged here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-100 bg-slate-50/60">
              <tr>
                <th className="table-th">Recipient</th>
                <th className="table-th">Message</th>
                <th className="table-th">Sent by</th>
                <th className="table-th">Channel</th>
                <th className="table-th">Status</th>
                <th className="table-th">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="table-td">
                    {m.lead ? (
                      <Link href={`/leads/${m.lead.id}`} className="flex items-center gap-2.5">
                        <Avatar name={m.lead.name} size="sm" />
                        <span>
                          <span className="block font-medium text-slate-900 hover:text-brand-700">{m.lead.name}</span>
                          <span className="block text-xs text-slate-500">+{m.phone}</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-600">+{m.phone}</span>
                    )}
                  </td>
                  <td className="table-td max-w-md">
                    <p className="truncate text-slate-600" title={m.body}>
                      {m.body || "-"}
                    </p>
                    {m.error && <p className="mt-0.5 truncate text-xs text-rose-600">{m.error}</p>}
                  </td>
                  <td className="table-td">{m.user?.name ?? "-"}</td>
                  <td className="table-td">
                    <Badge className={m.channel === "API" ? "bg-violet-50 text-violet-700 ring-violet-600/20" : "bg-slate-50 text-slate-600 ring-slate-500/20"}>
                      {m.channel === "API" ? "Business API" : "Click-to-chat"}
                    </Badge>
                  </td>
                  <td className="table-td">
                    {m.status === "FAILED" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                        <CircleX className="size-3.5" /> Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CircleCheck className="size-3.5" /> Sent
                      </span>
                    )}
                  </td>
                  <td className="table-td" title={formatDateTime(m.createdAt)}>
                    {formatRelative(m.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/whatsapp" searchParams={{ ...sp }} />
    </Card>
  );
}
