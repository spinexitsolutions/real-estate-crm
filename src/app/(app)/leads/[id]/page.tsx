import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CircleDot,
  Clock,
  Handshake,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  PhoneCall,
  Sparkles,
  StickyNote,
  Tag,
  UserPlus,
  Users,
  Wallet,
  ArrowRightLeft,
  CalendarCheck,
  FileText,
  MapPinCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { leadScore, scoreTone } from "@/lib/lead-score";
import { matchScore } from "@/lib/matching";
import { DEAL_STAGES, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PROPERTY_TYPES, PURPOSES, labelOf } from "@/lib/constants";
import { formatBudget, formatCompact, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { cn, parseImages, splitList } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, OptionBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/ui/icons";
import { SendWhatsAppButton } from "@/components/whatsapp/send-whatsapp";
import { FollowUpList } from "@/components/followups/followup-list";
import { telephonyStatus } from "@/lib/telephony";
import { orgFeatures } from "@/lib/plans";
import { LeadCallsCard } from "@/components/calls/lead-calls-card";
import { LeadCheckInsCard } from "@/components/site-visits/lead-checkins-card";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { LeadBookingsCard } from "@/components/bookings/lead-bookings-card";
import { PortalAccessCard } from "@/components/portal/portal-access-card";
import { AssignSelect, DeleteActivityButton, LeadHeaderActions, NoteComposer, ShortlistButton, StatusStepper } from "@/components/leads/lead-detail-client";

const ACTIVITY_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  NOTE: { icon: StickyNote, tone: "bg-amber-50 text-amber-600" },
  CALL: { icon: PhoneCall, tone: "bg-sky-50 text-sky-600" },
  MEETING: { icon: Users, tone: "bg-violet-50 text-violet-600" },
  EMAIL: { icon: Mail, tone: "bg-indigo-50 text-indigo-600" },
  WHATSAPP: { icon: WhatsAppIcon, tone: "bg-emerald-50 text-emerald-600" },
  STATUS: { icon: ArrowRightLeft, tone: "bg-slate-100 text-slate-600" },
  FOLLOWUP: { icon: CalendarCheck, tone: "bg-teal-50 text-teal-600" },
  CREATED: { icon: Sparkles, tone: "bg-brand-50 text-brand-600" },
  ASSIGNED: { icon: UserPlus, tone: "bg-slate-100 text-slate-600" },
  DEAL: { icon: Handshake, tone: "bg-emerald-50 text-emerald-600" },
  PROPERTY: { icon: Building2, tone: "bg-orange-50 text-orange-600" },
  DOCUMENT: { icon: FileText, tone: "bg-slate-100 text-slate-600" },
  SITE_VISIT: { icon: MapPinCheck, tone: "bg-amber-50 text-amber-600" },
  PAYMENT: { icon: Wallet, tone: "bg-emerald-50 text-emerald-600" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: lead?.name ?? "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const settings = await getSettings();
  const cur = settings.currency;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { name: true } },
      followUps: {
        orderBy: [{ status: "desc" }, { dueAt: "asc" }],
        include: { lead: { select: { id: true, name: true, phone: true } }, property: { select: { id: true, title: true, code: true } }, assignedTo: { select: { id: true, name: true } } },
      },
      activities: { orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } },
      deals: { orderBy: { createdAt: "desc" }, include: { property: { select: { title: true } } } },
      interests: { include: { property: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { messages: true } },
      portalAccess: true,
    },
  });
  if (!lead) notFound();
  if (user.role === "AGENT" && lead.assignedToId !== user.id) notFound();

  const manager = isManager(user);
  const feats = new Set(await orgFeatures());
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  const pa = lead.portalAccess;
  const [users, properties, leadsForDeal] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.property.findMany({ where: { status: { in: ["AVAILABLE", "RESERVED"] } }, orderBy: { createdAt: "desc" } }),
    Promise.resolve([{ id: lead.id, name: lead.name, phone: lead.phone }]),
  ]);

  const shortlistedIds = new Set(lead.interests.map((i) => i.propertyId));
  const matches = properties
    .filter((p) => p.status === "AVAILABLE" && !shortlistedIds.has(p.id))
    .map((p) => ({ p, score: matchScore(lead, p) }))
    .filter((m) => m.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const score = leadScore(lead);
  const tone = scoreTone(score);
  const pending = lead.followUps.filter((f) => f.status === "PENDING");
  const done = lead.followUps.filter((f) => f.status !== "PENDING");
  const toItem = (f: (typeof lead.followUps)[number]) => ({
    ...f,
    dueAt: f.dueAt.toISOString(),
    completedAt: f.completedAt?.toISOString() ?? null,
  });
  const tags = splitList(lead.tags);
  const firstProperty = lead.interests[0]?.property;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" /> All leads
        </Link>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={lead.name} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{lead.name}</h1>
                <OptionBadge list={LEAD_STATUSES} value={lead.status} withDot />
                <OptionBadge list={PRIORITIES} value={lead.priority} withDot />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {lead.phone}
                </span>
                {lead.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {lead.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Added {formatRelative(lead.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SendWhatsAppButton
              lead={{ id: lead.id, name: lead.name, phone: lead.phone }}
              property={firstProperty ? { title: firstProperty.title, price: firstProperty.price, location: [firstProperty.locality, firstProperty.city].filter(Boolean).join(", ") } : undefined}
              followUpDate={pending[0] ? formatDateTime(pending[0].dueAt) : undefined}
              variant="success"
              label="WhatsApp"
            />
            <LeadHeaderActions
              lead={{
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                alternatePhone: lead.alternatePhone,
                email: lead.email,
                source: lead.source,
                status: lead.status,
                priority: lead.priority,
                purpose: lead.purpose,
                propertyType: lead.propertyType,
                preferredLocation: lead.preferredLocation,
                bedrooms: lead.bedrooms,
                budgetMin: lead.budgetMin,
                budgetMax: lead.budgetMax,
                notes: lead.notes,
                tags: lead.tags,
                assignedToId: lead.assignedToId,
              }}
              users={users}
              properties={properties.map((p) => ({ id: p.id, title: p.title, code: p.code, price: p.price }))}
              leadsForDeal={leadsForDeal}
              canManage={manager}
              currentUserId={user.id}
              defaultCommission={settings.defaultCommission}
              currency={cur}
              clickToCallEnabled={telephonyStatus(settings).enabled && feats.has("click_to_call")}
            />
          </div>
        </div>
      </div>

      <StatusStepper key={lead.status} leadId={lead.id} status={lead.status} />
      {lead.status === "LOST" && lead.lostReason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <span className="font-medium">Lost reason:</span> {lead.lostReason}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Follow-ups"
              description={pending.length ? `${pending.length} pending` : "No pending follow-ups"}
              action={<span className="text-xs text-slate-500">{done.length} completed</span>}
            />
            {lead.followUps.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No follow-ups scheduled" description="Schedule a call, meeting or site visit so this lead never goes cold." />
            ) : (
              <FollowUpList items={[...pending, ...done.slice(0, 5)].map(toItem)} users={users} properties={properties.map((p) => ({ id: p.id, title: p.title, code: p.code }))} showLead={false} />
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" description="Notes, calls and every change on this lead" />
            <div className="p-5">
              <NoteComposer leadId={lead.id} />
              <ol className="relative mt-6 space-y-5 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-slate-200">
                {lead.activities.map((a) => {
                  const meta = ACTIVITY_ICONS[a.type] ?? { icon: CircleDot, tone: "bg-slate-100 text-slate-600" };
                  const Icon = meta.icon;
                  const editable = ["NOTE", "CALL", "MEETING", "EMAIL"].includes(a.type);
                  return (
                    <li key={a.id} className="group relative flex gap-4">
                      <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white", meta.tone)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-line text-sm text-slate-800">{a.content}</p>
                          {editable && <DeleteActivityButton id={a.id} />}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {a.user?.name ?? "System"} - {formatDateTime(a.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
                {lead.activities.length === 0 && <li className="pl-12 text-sm text-slate-500">No activity yet.</li>}
              </ol>
            </div>
          </Card>

          <LeadCallsCard leadId={lead.id} />
          {feats.has("documents") && <DocumentsPanel leadId={lead.id} />}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-slate-500">Lead score</p>
              <span className={cn("text-xs font-semibold", tone.text)}>{tone.label} intent</span>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">{score}</span>
              <span className="pb-1 text-sm text-slate-400">/ 100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${score}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100 text-center">
              <MiniStat label="Follow-ups" value={lead.followUps.length} />
              <MiniStat label="WhatsApp" value={lead._count.messages} />
              <MiniStat label="Last contact" value={lead.lastContactedAt ? formatRelative(lead.lastContactedAt).replace(" ago", "") : "Never"} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Requirement" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row icon={Wallet} label="Budget" value={formatBudget(lead.budgetMin, lead.budgetMax, cur)} />
              <Row icon={Building2} label="Looking for" value={[lead.bedrooms ? `${lead.bedrooms} BHK` : null, lead.propertyType ? labelOf(PROPERTY_TYPES, lead.propertyType) : "Any type", `(${labelOf(PURPOSES, lead.purpose)})`].filter(Boolean).join(" ")} />
              <Row icon={MapPin} label="Location" value={lead.preferredLocation || "Any"} />
              <Row icon={Sparkles} label="Source" value={labelOf(LEAD_SOURCES, lead.source)} />
              {tags.length > 0 && (
                <div className="flex gap-3 px-5 py-3">
                  <Tag className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Badge key={t} className="bg-brand-50 text-brand-700 ring-brand-600/20">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </dl>
            {lead.notes && (
              <div className="border-t border-slate-100 px-5 py-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Notes</p>
                <p className="whitespace-pre-line text-sm text-slate-700">{lead.notes}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Assignment" />
            <div className="space-y-3 p-5">
              {manager ? (
                <AssignSelect leadId={lead.id} value={lead.assignedToId} users={users} />
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar name={lead.assignedTo?.name ?? "?"} size="sm" />
                  <span className="text-sm font-medium text-slate-800">{lead.assignedTo?.name ?? "Unassigned"}</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Created by {lead.createdBy?.name ?? "System"} on {formatDate(lead.createdAt)}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Shortlisted properties" description={`${lead.interests.length} saved`} />
            {lead.interests.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No properties shortlisted yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lead.interests.map(({ property: p }) => (
                  <PropertyRow key={p.id} p={p} cur={cur} action={<ShortlistButton leadId={lead.id} propertyId={p.id} shortlisted />} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Matching properties" description="Auto-matched on budget, type, BHK and location" />
            {matches.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No close matches in available inventory.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {matches.map(({ p, score: s }) => (
                  <PropertyRow
                    key={p.id}
                    p={p}
                    cur={cur}
                    match={s}
                    action={
                      <div className="flex items-center">
                        <SendWhatsAppButton
                          lead={{ id: lead.id, name: lead.name, phone: lead.phone }}
                          property={{ title: p.title, price: p.price, location: [p.locality, p.city].filter(Boolean).join(", ") }}
                          iconOnly
                          variant="ghost"
                          size="icon"
                        />
                        <ShortlistButton leadId={lead.id} propertyId={p.id} shortlisted={false} />
                      </div>
                    }
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Deals" description={`${lead.deals.length} linked`} />
            {lead.deals.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No deals yet. Create one when negotiation starts.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lead.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deals?open=${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{d.title}</p>
                        <p className="text-xs text-slate-500">{formatCompact(d.value, cur)}</p>
                      </div>
                      <OptionBadge list={DEAL_STAGES} value={d.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {feats.has("bookings") && <LeadBookingsCard leadId={lead.id} />}

          {feats.has("customer_portal") && (
          <PortalAccessCard
            leadId={lead.id}
            leadName={lead.name}
            leadPhone={lead.phone}
            origin={origin}
            companyName={settings.companyName}
            access={pa ? { token: pa.token, hasPin: !!pa.pin, lastViewedAt: pa.lastViewedAt?.toISOString() ?? null, revokedAt: pa.revokedAt?.toISOString() ?? null } : null}
          />
          )}

          {feats.has("attendance") && <LeadCheckInsCard leadId={lead.id} />}

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <MessageSquareText className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">{lead._count.messages} WhatsApp messages sent</p>
                <Link href={`/whatsapp?tab=log&q=${encodeURIComponent(lead.phone)}`} className="text-xs font-medium text-brand-600 hover:underline">
                  View message history
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 py-2.5">
      <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function PropertyRow({
  p,
  cur,
  match,
  action,
}: {
  p: { id: string; title: string; code: string; price: number; images: string; locality: string | null; city: string; listingType: string };
  cur: string;
  match?: number;
  action: React.ReactNode;
}) {
  const img = parseImages(p.images)[0];
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Link href={`/properties/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Building2 className="size-5" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">{p.title}</span>
          <span className="block truncate text-xs text-slate-500">
            {formatCompact(p.price, cur)}
            {p.listingType === "RENT" ? "/mo" : ""} - {[p.locality, p.city].filter(Boolean).join(", ")}
          </span>
          {match !== undefined && <span className="mt-0.5 inline-block text-[11px] font-semibold text-emerald-600">{match}% match</span>}
        </span>
      </Link>
      {action}
    </li>
  );
}
