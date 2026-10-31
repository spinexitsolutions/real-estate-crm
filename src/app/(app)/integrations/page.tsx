import Link from "next/link";
import { headers } from "next/headers";
import { subDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { Building, Building2, Camera, CircleCheck, CircleDashed, Globe, House, Mail, Megaphone, PlugZap, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { INTEGRATION_SOURCES, LEAD_SOURCES, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { FilterSelect, Pagination } from "@/components/ui/filters";
import { CopyField, FacebookSettingsForm, GenerateKeyButton, TestLeadButton } from "./integrations-client";

export const metadata = { title: "Integrations" };

type SP = { source?: string; status?: string; page?: string };
const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  DUPLICATE: "bg-sky-50 text-sky-700 ring-sky-600/20",
  ERROR: "bg-rose-50 text-rose-700 ring-rose-600/20",
  IGNORED: "bg-slate-50 text-slate-600 ring-slate-500/20",
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const settings = await db.settings.findFirst();
  const key = settings?.leadWebhookKey ?? "";
  const since7 = subDays(new Date(), 7);
  const since30 = subDays(new Date(), 30);

  const logWhere: Prisma.IntegrationLogWhereInput = {};
  if (sp.source) logWhere.source = sp.source;
  if (sp.status) logWhere.status = sp.status;

  const [recentOk, lastEvents, bySource, logTotal, logs] = await Promise.all([
    db.integrationLog.groupBy({ by: ["source"], where: { status: { in: ["OK", "DUPLICATE"] }, createdAt: { gte: since7 } }, _count: true }),
    db.integrationLog.groupBy({ by: ["source"], _max: { createdAt: true } }),
    db.lead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since30 }, source: { in: ["FACEBOOK", "INSTAGRAM", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING", "WEBSITE", "WHATSAPP"] } },
      _count: true,
    }),
    db.integrationLog.count({ where: logWhere }),
    db.integrationLog.findMany({ where: logWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const leadIds = logs.map((l) => l.leadId).filter((x): x is string => !!x);
  const leadNames = new Map((await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })).map((l) => [l.id, l.name]));

  const okCount = (src: string) => recentOk.find((r) => r.source === src)?._count ?? 0;
  const lastAt = (src: string) => lastEvents.find((r) => r.source === src)?._max.createdAt ?? null;
  const leads30 = (src: string) => bySource.find((r) => r.source === src)?._count ?? 0;

  const portalUrl = (p: string) => `${origin}/api/webhooks/portal/${p}?key=${key}`;
  const fbConfigured = !!(settings?.fbVerifyToken && settings?.fbPageAccessToken);

  const cards: {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    logSource: string;
    leadSource: string;
    configured: boolean;
    url?: string;
    steps: React.ReactNode[];
    test?: string;
  }[] = [
    {
      id: "facebook",
      title: "Facebook Lead Ads",
      icon: Megaphone,
      tone: "bg-blue-50 text-blue-600",
      logSource: "FACEBOOK",
      leadSource: "FACEBOOK",
      configured: fbConfigured,
      url: `${origin}/api/webhooks/facebook?org=${user.organizationId}`,
      steps: [
        "In Meta for Developers, open your app and add the Webhooks product.",
        <>Choose <b>Page</b>, click Subscribe and paste the callback URL and the verify token from the form below.</>,
        <>Subscribe to the <b>leadgen</b> field, then connect your Facebook Page to the app.</>,
        <>Create a long-lived Page access token with <b>leads_retrieval</b> permission and save it below.</>,
        "Test with Meta's Lead Ads Testing Tool. The lead appears here within seconds.",
      ],
    },
    {
      id: "instagram",
      title: "Instagram Lead Ads",
      icon: Camera,
      tone: "bg-pink-50 text-pink-600",
      logSource: "INSTAGRAM",
      leadSource: "INSTAGRAM",
      configured: fbConfigured,
      url: `${origin}/api/webhooks/facebook?org=${user.organizationId}`,
      steps: [
        "Instagram lead forms are delivered through the same Facebook Page webhook.",
        "Link your Instagram professional account to the Facebook Page used above.",
        "Leads from Instagram ads are tagged with source Instagram automatically.",
      ],
    },
    {
      id: "99acres",
      title: "99acres",
      icon: Building2,
      tone: "bg-sky-50 text-sky-600",
      logSource: "99ACRES",
      leadSource: "PORTAL_99ACRES",
      configured: !!key,
      url: portalUrl("99acres"),
      test: "99acres",
      steps: [
        "Share this URL with your 99acres account manager and ask them to enable lead push to your CRM.",
        "Alternatively, forward 99acres lead emails to the email parser below.",
        "When a listing id matches a property code in EstateDesk, the property is shortlisted on the lead.",
      ],
    },
    {
      id: "magicbricks",
      title: "MagicBricks",
      icon: Building,
      tone: "bg-rose-50 text-rose-600",
      logSource: "MAGICBRICKS",
      leadSource: "PORTAL_MAGICBRICKS",
      configured: !!key,
      url: portalUrl("magicbricks"),
      test: "magicbricks",
      steps: ["Share this URL with your MagicBricks account manager and request CRM lead integration (API push).", "Or forward MagicBricks lead alert emails to the email parser."],
    },
    {
      id: "housing",
      title: "Housing.com",
      icon: House,
      tone: "bg-violet-50 text-violet-600",
      logSource: "HOUSING",
      leadSource: "PORTAL_HOUSING",
      configured: !!key,
      url: portalUrl("housing"),
      test: "housing",
      steps: ["Share this URL with your Housing.com account manager to push leads to your CRM.", "Or forward Housing.com lead emails to the email parser."],
    },
    {
      id: "website",
      title: "Website and landing pages",
      icon: Globe,
      tone: "bg-emerald-50 text-emerald-600",
      logSource: "WEBSITE",
      leadSource: "WEBSITE",
      configured: !!key,
      url: portalUrl("generic"),
      test: "generic",
      steps: ["POST JSON or form fields (name, phone, email, message, budget, city) from any form, Zapier, Make or Google Ads lead form webhook.", "Arrays of leads are accepted for bulk pushes."],
    },
    {
      id: "email",
      title: "Email forwarding",
      icon: Mail,
      tone: "bg-amber-50 text-amber-600",
      logSource: "WEBSITE",
      leadSource: "WEBSITE",
      configured: !!key,
      url: `${origin}/api/webhooks/email-lead?key=${key}`,
      steps: [
        "Works with any portal that sends lead notification emails.",
        "Set up an inbound email route (Cloudflare Email Workers, SendGrid Inbound Parse, Zapier Email Parser or Make) that POSTs from, subject and text to this URL.",
        "Name, mobile number, email, project and message are extracted automatically.",
      ],
    },
  ];

  return (
    <>
      <PageHeader icon={PlugZap} title="Integrations" description="Bring leads from Facebook, Instagram and property portals into the CRM automatically." />

      {!key && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <TriangleAlert className="size-4 shrink-0" /> Portal and website webhooks need a secret key before they can receive leads.
          </p>
          {user.role === "ADMIN" && <GenerateKeyButton />}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["FACEBOOK", "INSTAGRAM"],
          ["PORTAL_99ACRES"],
          ["PORTAL_MAGICBRICKS", "PORTAL_HOUSING"],
          ["WEBSITE"],
        ].map((group) => (
          <div key={group.join()} className="card p-4">
            {group.map((src) => (
              <div key={src} className="flex items-center justify-between py-0.5 text-sm">
                <span className="text-slate-600">{labelOf(LEAD_SOURCES, src)}</span>
                <span className="font-semibold text-slate-900">{leads30(src)}</span>
              </div>
            ))}
            <p className="mt-1 text-[11px] text-slate-400">Leads in the last 30 days</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {cards.map((c) => {
          const ok = okCount(c.logSource);
          const last = lastAt(c.logSource);
          const status = ok > 0 && c.id !== "email" ? "connected" : c.configured ? "ready" : "off";
          return (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-10 items-center justify-center rounded-xl", c.tone)}>
                    <c.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">{c.title}</h3>
                    <p className="text-xs text-slate-500">
                      {leads30(c.leadSource)} leads in 30 days{last && c.id !== "email" ? ` - last event ${formatRelative(last)}` : ""}
                    </p>
                  </div>
                </div>
                {status === "connected" ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                    <CircleCheck className="size-3.5" /> Connected
                  </Badge>
                ) : status === "ready" ? (
                  <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">
                    <CircleDashed className="size-3.5" /> Waiting for first lead
                  </Badge>
                ) : (
                  <Badge>Not configured</Badge>
                )}
              </div>
              <div className="flex-1 space-y-4 p-5">
                {c.url && (key || c.id === "facebook" || c.id === "instagram") && <CopyField value={c.url} label="Webhook URL" />}
                <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-slate-600 marker:text-slate-400">
                  {c.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                {c.test && <TestLeadButton portal={c.test} disabled={!key} />}
              </div>
            </Card>
          );
        })}

        <Card>
          <CardHeader title="Facebook and Instagram settings" description="Credentials used to fetch lead details from Meta" />
          <div className="p-5">
            <FacebookSettingsForm
              verifyToken={settings?.fbVerifyToken ?? ""}
              hasSecret={!!settings?.fbAppSecret}
              hasToken={!!settings?.fbPageAccessToken}
              canEdit={user.role === "ADMIN"}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Integration log"
          description="Every lead and event received from external sources"
          action={
            <div className="flex gap-2">
              <FilterSelect param="source" options={INTEGRATION_SOURCES} placeholder="All sources" />
              <FilterSelect
                param="status"
                options={[
                  { value: "OK", label: "New lead" },
                  { value: "DUPLICATE", label: "Repeat enquiry" },
                  { value: "ERROR", label: "Error" },
                  { value: "IGNORED", label: "Ignored" },
                ]}
                placeholder="All statuses"
              />
            </div>
          }
        />
        {logs.length === 0 ? (
          <EmptyState icon={PlugZap} title="No events yet" description="Leads received from portals, Facebook and forms will be listed here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Time</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Details</th>
                  <th className="table-th">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="table-td text-slate-500">{formatDateTime(l.createdAt)}</td>
                    <td className="table-td font-medium text-slate-800">{labelOf(INTEGRATION_SOURCES, l.source)}</td>
                    <td className="table-td">
                      <Badge className={STATUS_BADGE[l.status]}>{l.status === "OK" ? "New lead" : l.status === "DUPLICATE" ? "Repeat enquiry" : l.status === "ERROR" ? "Error" : "Ignored"}</Badge>
                    </td>
                    <td className="table-td max-w-md whitespace-normal text-slate-600">{l.message ?? "-"}</td>
                    <td className="table-td">
                      {l.leadId && leadNames.has(l.leadId) ? (
                        <Link href={`/leads/${l.leadId}`} className="font-medium text-brand-700 hover:underline">
                          {leadNames.get(l.leadId)}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={logTotal} basePath="/integrations" searchParams={sp as Record<string, string | undefined>} />
      </Card>
    </>
  );
}
