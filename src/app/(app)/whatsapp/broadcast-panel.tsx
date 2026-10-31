"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, ExternalLink, LoaderCircle, Megaphone, Send, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { OptionBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { LEAD_STATUSES, type Option } from "@/lib/constants";
import { cn, fillTemplate } from "@/lib/utils";
import { broadcast, logBroadcastLink, previewBroadcast, type BroadcastFilters } from "@/actions/whatsapp";
import { HighlightedBody } from "./templates-manager";

type Template = { id: string; name: string; category: string; body: string; metaName: string | null };
type Preview = Awaited<ReturnType<typeof previewBroadcast>>;

export function BroadcastPanel({
  templates,
  apiEnabled,
  manager,
  users,
  statuses,
  priorities,
  sources,
  company,
  agentName,
}: {
  templates: Template[];
  apiEnabled: boolean;
  manager: boolean;
  users: { id: string; name: string }[];
  statuses: Option[];
  priorities: Option[];
  sources: Option[];
  company: string;
  agentName: string;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [body, setBody] = useState(templates[0]?.body ?? "");
  const [filters, setFilters] = useState<BroadcastFilters>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [channel, setChannel] = useState<"LINK" | "API">(apiEnabled ? "API" : "LINK");
  const [pending, start] = useTransition();
  const [links, setLinks] = useState<{ id: string; name: string; url: string }[] | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedApproved = templates.find((t) => t.id === templateId && t.metaName);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    previewBroadcast(filters)
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && toast.error("Could not load recipients"))
      .finally(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const sample = useMemo(() => fillTemplate(body, { name: preview?.sample[0]?.name.split(" ")[0] ?? "Rahul", agent: agentName, company }), [body, preview, agentName, company]);

  const setFilter = (k: keyof BroadcastFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  const run = () => {
    setConfirmOpen(false);
    start(async () => {
      const res = await broadcast({ templateId: templateId || undefined, body, channel, filters });
      if (res.error) return void toast.error(res.error);
      if (channel === "LINK") {
        setOpened(new Set());
        setLinks(res.data?.links ?? []);
      } else {
        const d = res.data!;
        if (d.failed) toast.warning(`Sent to ${d.sent} leads, ${d.failed} failed. Check the message log.`);
        else toast.success(`Broadcast sent to ${d.sent} leads`);
      }
    });
  };

  const openLink = (l: { id: string; url: string }) => {
    window.open(l.url, "_blank", "noopener,noreferrer");
    setOpened((s) => new Set(s).add(l.id));
    logBroadcastLink(l.id, l.url).catch(() => undefined);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="1. Compose message" description="Pick a template or write your own. {{name}}, {{agent}} and {{company}} are personalised for each lead." />
          <div className="space-y-4 p-5">
            <Field label="Template">
              <Select
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  const t = templates.find((x) => x.id === e.target.value);
                  setBody(t?.body ?? "");
                }}
                options={templates.map((t) => ({ value: t.id, label: t.metaName ? `${t.name} (Approved)` : t.name }))}
                placeholder="Custom message"
              />
            </Field>
            {channel === "API" && !selectedApproved && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                <span className="font-semibold">Approved template required.</span> WhatsApp only allows Meta-approved templates for bulk or first messages
                sent through the API. Choose a template marked &quot;Approved&quot; (add its Meta name in the Templates tab), or switch to click-to-send.
              </div>
            )}
            {channel === "API" && selectedApproved && (
              <p className="text-xs text-slate-500">
                Sent as the approved template <span className="font-mono font-medium text-slate-700">{selectedApproved.metaName}</span>. Edits to the text below apply to click-to-send only.
              </p>
            )}
            <Field label="Message">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="input resize-y" placeholder="Hi {{name}}, ..." />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Choose recipients" description="Lost leads are excluded unless you pick that status." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Lead status">
              <Select value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)} options={statuses} placeholder="All active statuses" />
            </Field>
            <Field label="Priority">
              <Select value={filters.priority ?? ""} onChange={(e) => setFilter("priority", e.target.value)} options={priorities} placeholder="Any priority" />
            </Field>
            <Field label="Source">
              <Select value={filters.source ?? ""} onChange={(e) => setFilter("source", e.target.value)} options={sources} placeholder="Any source" />
            </Field>
            {manager && (
              <Field label="Assigned to">
                <Select value={filters.assignedToId ?? ""} onChange={(e) => setFilter("assignedToId", e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Anyone" />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Send" />
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChannelOption
                active={channel === "API"}
                disabled={!apiEnabled}
                onClick={() => apiEnabled && setChannel("API")}
                icon={Send}
                title="Send automatically"
                text={apiEnabled ? "Delivered via WhatsApp Business API." : "Requires WhatsApp API setup in Settings."}
              />
              <ChannelOption active={channel === "LINK"} onClick={() => setChannel("LINK")} icon={ExternalLink} title="Click-to-send" text="Open each chat with the message pre-filled." />
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {loadingPreview ? (
                  "Counting recipients..."
                ) : (
                  <>
                    <span className="font-semibold text-slate-900">{preview?.count ?? 0}</span> lead{preview?.count === 1 ? "" : "s"} will receive this message
                    {(preview?.count ?? 0) > 200 && <span className="text-amber-600"> (first 200 per batch)</span>}
                  </>
                )}
              </p>
              <Button variant="success" onClick={() => setConfirmOpen(true)} loading={pending} disabled={!body.trim() || !preview?.count || loadingPreview || (channel === "API" && !selectedApproved)}>
                <Megaphone /> {channel === "API" ? "Send broadcast" : "Prepare messages"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Preview" description="As seen by the first recipient" />
          <div className="p-5">
            <div className="rounded-xl bg-[#efeae2] p-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
              <div className="ml-auto max-w-[95%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-sm">
                {body ? <HighlightedBody body={sample} /> : <p className="text-slate-400">Your message preview</p>}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recipients"
            description={preview ? `Showing ${preview.sample.length} of ${preview.count}` : undefined}
            action={loadingPreview ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : <Users className="size-4 text-slate-400" />}
          />
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {preview?.sample.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No leads match these filters.</li>}
            {preview?.sample.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={l.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${l.id}`} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700">
                    {l.name}
                  </Link>
                  <p className="text-xs text-slate-500">{l.phone}</p>
                </div>
                <OptionBadge list={LEAD_STATUSES} value={l.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-amber-500" /> Confirm broadcast
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={run}>
              Continue
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {channel === "API"
            ? `This will send the message to ${Math.min(preview?.count ?? 0, 200)} leads through the WhatsApp Business API. Only message customers who have opted in to hear from you.`
            : `This prepares personalised WhatsApp links for ${Math.min(preview?.count ?? 0, 200)} leads. You will open each chat and press send.`}
        </p>
      </Modal>

      <Modal
        open={links !== null}
        onClose={() => setLinks(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <WhatsAppIcon className="size-5 text-emerald-600" /> Click-to-send queue
          </span>
        }
        description={`${opened.size} of ${links?.length ?? 0} opened. Each chat opens in WhatsApp with the message pre-filled.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinks(null)}>
              Close
            </Button>
            {links && links.some((l) => !opened.has(l.id)) && (
              <Button
                variant="success"
                onClick={() => {
                  const next = links.find((l) => !opened.has(l.id));
                  if (next) openLink(next);
                }}
              >
                <ExternalLink /> Open next
              </Button>
            )}
          </>
        }
      >
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${links?.length ? (opened.size / links.length) * 100 : 0}%` }} />
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {links?.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={l.name} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-slate-800">{l.name}</span>
              {opened.has(l.id) ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CircleCheck className="size-4" /> Opened
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => openLink(l)}>
                  <WhatsAppIcon className="text-emerald-600" /> Open
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function ChannelOption({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition",
        active ? "border-emerald-400 bg-emerald-50/60 ring-4 ring-emerald-500/10" : "border-slate-200 hover:border-slate-300",
        disabled && "cursor-not-allowed opacity-60 hover:border-slate-200",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}
