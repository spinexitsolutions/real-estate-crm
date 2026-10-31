import Link from "next/link";
import { startOfMonth } from "date-fns";
import { CircleCheck, CircleX, FileText, Inbox, Megaphone, MessageSquareText, PlugZap, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager, leadScope, type CurrentUser } from "@/lib/auth";
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
import { InboxView } from "./inbox";

export const metadata = { title: "WhatsApp" };

const PAGE_SIZE = 20;

type SP = { tab?: string; q?: string; channel?: string; page?: string; lead?: string };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const settings = await getSettings();
  const tab = ["inbox", "templates", "broadcast", "log"].includes(sp.tab ?? "") ? sp.tab! : "inbox";
  const apiReady = Boolean(settings.waApiEnabled && settings.waPhoneNumberId && settings.waAccessToken);

  const msgScope: Prisma.WhatsAppMessageWhereInput = user.role === "AGENT" ? { OR: [{ userId: user.id }, { lead: { assignedToId: user.id } }] } : {};
  const monthStart = startOfMonth(new Date());
  const [templates, sentMonth, failedMonth, reached, unreadAgg] = await Promise.all([
    db.whatsAppTemplate.findMany({ orderBy: { createdAt: "asc" } }),
    db.whatsAppMessage.count({ where: { ...msgScope, direction: "OUT", createdAt: { gte: monthStart }, status: { not: "FAILED" } } }),
    db.whatsAppMessage.count({ where: { ...msgScope, createdAt: { gte: monthStart }, status: "FAILED" } }),
    db.whatsAppMessage.groupBy({ by: ["leadId"], where: { ...msgScope, direction: "OUT", createdAt: { gte: monthStart }, leadId: { not: null } } }),
    db.lead.aggregate({ where: { ...leadScope(user), unreadMessages: { gt: 0 } }, _sum: { unreadMessages: true } }),
  ]);
  const unread = unreadAgg._sum.unreadMessages ?? 0;

  const tabs = [
    { value: "inbox", label: "Inbox", icon: Inbox, count: unread },
    { value: "templates", label: "Templates", icon: FileText },
    { value: "broadcast", label: "Broadcast", icon: Megaphone },
    { value: "log", label: "Message log", icon: MessageSquareText },
  ];

  return (
    <div>
      <PageHeader icon={WhatsAppIcon} title="WhatsApp" description="Two-way inbox, templates, bulk messaging and a complete log of every conversation." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Messages this month" value={sentMonth} icon={Send} tone="emerald" sub="Successfully sent" />
        <StatCard label="Leads reached" value={reached.length} icon={MessageSquareText} tone="sky" sub="Unique leads this month" />
        <StatCard label="Unread replies" value={unread} icon={Inbox} tone="violet" sub="Waiting in your inbox" />
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

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value === "inbox" ? "/whatsapp" : `/whatsapp?tab=${t.value}`}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center whitespace-nowrap gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              tab === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
            {"count" in t && t.count ? (
              <span className="rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-white">{t.count}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {tab === "inbox" && (
        <InboxSection
          user={user}
          sp={sp}
          apiEnabled={apiReady}
          countryCode={settings.defaultCountryCode}
          company={settings.companyName}
          templates={templates.map((t) => ({ id: t.id, name: t.name, body: t.body, metaName: t.metaName }))}
        />
      )}

      {tab === "templates" && (
        <TemplatesManager
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            body: t.body,
            updatedAt: t.updatedAt.toISOString(),
            metaName: t.metaName,
            metaLanguage: t.metaLanguage,
            metaParams: t.metaParams,
          }))}
          canDelete={manager}
        />
      )}

      {tab === "broadcast" && (
        <BroadcastPanel
          templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, body: t.body, metaName: t.metaName }))}
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
      ? { OR: [{ phone: { contains: sp.q, mode: "insensitive" } }, { body: { contains: sp.q, mode: "insensitive" } }, { lead: { name: { contains: sp.q, mode: "insensitive" } } }] }
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
                <th className="table-th">From</th>
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
                  <td className="table-td">{m.direction === "IN" ? <span className="text-slate-400">Customer</span> : (m.user?.name ?? "-")}</td>
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
                    ) : m.direction === "IN" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600">
                        <Inbox className="size-3.5" /> Received
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CircleCheck className="size-3.5" /> {m.status === "READ" ? "Read" : m.status === "DELIVERED" ? "Delivered" : "Sent"}
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

async function InboxSection({
  user,
  sp,
  apiEnabled,
  countryCode,
  company,
  templates,
}: {
  user: CurrentUser;
  sp: SP;
  apiEnabled: boolean;
  countryCode: string;
  company: string;
  templates: { id: string; name: string; body: string; metaName: string | null }[];
}) {
  const scope = leadScope(user);
  const groups = await db.whatsAppMessage.groupBy({
    by: ["leadId"],
    where: { leadId: { not: null }, lead: scope },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 150,
  });
  const ids = groups.map((g) => g.leadId!).filter(Boolean);
  const [leads, lastMessages] = await Promise.all([
    db.lead.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, unreadMessages: true } }),
    db.whatsAppMessage.findMany({
      where: { leadId: { in: ids } },
      orderBy: { createdAt: "desc" },
      distinct: ["leadId"],
      select: { leadId: true, body: true, direction: true, createdAt: true },
    }),
  ]);
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const lastMap = new Map(lastMessages.map((m) => [m.leadId!, m]));
  const conversations = ids
    .map((id) => {
      const l = leadMap.get(id);
      const m = lastMap.get(id);
      if (!l || !m) return null;
      return { leadId: id, name: l.name, phone: l.phone, unread: l.unreadMessages, lastAt: m.createdAt.toISOString(), lastBody: m.body, lastDirection: m.direction };
    })
    .filter((c): c is NonNullable<typeof c> => !!c);

  const selectedId = sp.lead ?? null;
  const lead = selectedId
    ? await db.lead.findFirst({
        where: { id: selectedId, ...scope },
        select: { id: true, name: true, phone: true, lastInboundAt: true, unreadMessages: true, status: true },
      })
    : null;
  const messages = lead
    ? (
        await db.whatsAppMessage.findMany({
          where: { leadId: lead.id },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { user: { select: { name: true } } },
        })
      ).reverse()
    : [];

  return (
    <InboxView
      conversations={conversations}
      lead={lead ? { id: lead.id, name: lead.name, phone: lead.phone, lastInboundAt: lead.lastInboundAt?.toISOString() ?? null, unread: lead.unreadMessages, status: lead.status } : null}
      messages={messages.map((m) => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        status: m.status,
        channel: m.channel,
        error: m.error,
        createdAt: m.createdAt.toISOString(),
        userName: m.user?.name ?? null,
      }))}
      templates={templates}
      apiEnabled={apiEnabled}
      countryCode={countryCode}
      company={company}
      agentName={user.name}
      q={sp.q ?? ""}
    />
  );
}
