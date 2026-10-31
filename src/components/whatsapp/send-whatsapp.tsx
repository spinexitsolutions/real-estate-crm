"use client";

import { useMemo, useState, useTransition } from "react";
import { BadgeCheck, CheckCheck, Clock, ExternalLink, LoaderCircle, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { TEMPLATE_CATEGORIES, labelOf } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import { cn, fillTemplate, waLink } from "@/lib/utils";
import { getWhatsAppContext, sendWhatsApp } from "@/actions/whatsapp";
import { isWindowOpen, windowRemainingLabel } from "@/lib/whatsapp-window";

type Ctx = Awaited<ReturnType<typeof getWhatsAppContext>>;

export function SendWhatsAppButton({
  lead,
  property,
  followUpDate,
  variant = "secondary",
  size = "md",
  label = "WhatsApp",
  iconOnly,
}: {
  lead: { id: string; name: string; phone: string };
  property?: { title: string; price: number; location: string };
  followUpDate?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "success";
  size?: "sm" | "md" | "icon";
  label?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const vars = useMemo(
    () => ({
      name: lead.name.split(" ")[0],
      agent: ctx?.agentName,
      company: ctx?.company,
      property: property?.title,
      price: property ? formatCompact(property.price) : undefined,
      location: property?.location,
      date: followUpDate,
    }),
    [lead.name, ctx, property, followUpDate],
  );

  const openModal = async () => {
    setOpen(true);
    if (ctx) return;
    setLoading(true);
    try {
      const c = await getWhatsAppContext(lead.id);
      setCtx(c);
      const first = property ? c.templates.find((t) => t.category === "PROPERTY") : c.templates.find((t) => t.category === "FOLLOW_UP" || t.category === "GREETING");
      if (first) {
        setTemplateId(first.id);
        setMessage(
          fillTemplate(first.body, {
            name: lead.name.split(" ")[0],
            agent: c.agentName,
            company: c.company,
            property: property?.title,
            price: property ? formatCompact(property.price) : undefined,
            location: property?.location,
            date: followUpDate,
          }),
        );
      } else setMessage(`Hi ${lead.name.split(" ")[0]}, `);
    } catch {
      toast.error("Could not load WhatsApp templates.");
    } finally {
      setLoading(false);
    }
  };

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const t = ctx?.templates.find((x) => x.id === id);
    if (t) setMessage(fillTemplate(t.body, vars));
  };

  const categories = ctx ? TEMPLATE_CATEGORIES.filter((c) => ctx.templates.some((t) => t.category === c.value)) : [];
  const visible = ctx ? ctx.templates.filter((t) => !category || t.category === category) : [];

  const openLink = () => {
    if (!message.trim()) return void toast.error("Message cannot be empty.");
    // Open synchronously to avoid popup blockers, then log.
    window.open(waLink(lead.phone, message, ctx?.countryCode ?? "91"), "_blank", "noopener,noreferrer");
    start(async () => {
      const res = await sendWhatsApp({ leadId: lead.id, phone: lead.phone, body: message, channel: "LINK", templateId: templateId || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Message logged to lead timeline");
        setOpen(false);
      }
    });
  };

  const sendApi = () => {
    if (!message.trim()) return void toast.error("Message cannot be empty.");
    start(async () => {
      const res = await sendWhatsApp({
        leadId: lead.id,
        phone: lead.phone,
        body: message,
        channel: "API",
        templateId: templateId || null,
        vars: { property: vars.property, price: vars.price, location: vars.location, date: vars.date },
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Message sent to ${lead.name}`);
        setOpen(false);
      }
    });
  };

  const windowOpen = isWindowOpen(ctx?.lastInboundAt);
  const selected = ctx?.templates.find((t) => t.id === templateId);
  const apiBlocked = !!ctx?.apiEnabled && !windowOpen && !selected?.metaName;

  const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      {iconOnly || size === "icon" ? (
        <button
          type="button"
          onClick={openModal}
          title={`WhatsApp ${lead.name}`}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition",
            variant === "ghost" ? "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600" : "border border-slate-200 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50",
          )}
        >
          <WhatsAppIcon className="size-4" />
        </button>
      ) : (
        <Button variant={variant} size={size} onClick={openModal}>
          <WhatsAppIcon className={variant === "secondary" || variant === "ghost" ? "text-emerald-600" : undefined} />
          {label}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        size="xl"
        title={
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <WhatsAppIcon className="size-4" />
            </span>
            Message {lead.name}
          </span>
        }
        description={
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" /> {lead.phone}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            {ctx?.apiEnabled && (
              <Button
                variant="outline"
                onClick={sendApi}
                loading={pending}
                disabled={loading || apiBlocked}
                title={apiBlocked ? "Outside the 24-hour window: choose an approved template to send via API" : undefined}
              >
                <Send /> Send via API
              </Button>
            )}
            <Button variant="success" onClick={openLink} disabled={loading || pending}>
              <ExternalLink /> Open in WhatsApp
            </Button>
          </>
        }
      >
        {loading || !ctx ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading templates...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="min-w-0 space-y-4">
              {ctx.apiEnabled && (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                    windowOpen ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {windowOpen ? <CheckCheck className="mt-0.5 size-4 shrink-0" /> : <Clock className="mt-0.5 size-4 shrink-0" />}
                  {windowOpen ? (
                    <span>
                      <span className="font-semibold">Customer replied within 24 hours</span> ({windowRemainingLabel(ctx.lastInboundAt)}). Free text can be sent via API.
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold">Outside the 24-hour window.</span> Only approved templates (marked with a check) can be sent via API.
                      &quot;Open in WhatsApp&quot; always works.
                    </span>
                  )}
                </div>
              )}
              <div>
                <p className="label">Template</p>
                {categories.length > 1 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Chip active={!category} onClick={() => setCategory("")}>
                      All
                    </Chip>
                    {categories.map((c) => (
                      <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                        {c.label}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1">
                  {visible.length === 0 && <p className="px-3 py-4 text-center text-xs text-slate-500">No templates yet. Create them on the WhatsApp page.</p>}
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => chooseTemplate(t.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                        templateId === t.id ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{t.name}</span>
                        {t.metaName && <BadgeCheck className="size-3.5 shrink-0 text-emerald-600" aria-label="Approved template" />}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{labelOf(TEMPLATE_CATEGORIES, t.category)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-700">Message</p>
                  <span className="text-xs text-slate-400">{message.length} characters</span>
                </div>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="input resize-y" placeholder="Type your message..." />
                {ctx.apiEnabled && !windowOpen && selected?.metaName && (
                  <p className="mt-2 text-xs text-slate-500">
                    Via API, WhatsApp delivers the approved template <span className="font-medium text-slate-700">{selected.metaName}</span> exactly as approved by Meta. Edits here apply only to &quot;Open in WhatsApp&quot;.
                  </p>
                )}
                {!ctx.apiEnabled && (
                  <p className="mt-2 text-xs text-slate-500">
                    Opens WhatsApp with this message pre-filled. Connect the WhatsApp Business API in Settings to send directly from the CRM.
                  </p>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="label">Preview</p>
              <div className="rounded-xl bg-[#efeae2] p-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
                <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13.5px] leading-relaxed text-slate-800 shadow-sm">
                  <p className="whitespace-pre-wrap break-words">{message || <span className="text-slate-400">Your message will appear here</span>}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-slate-500">
                    {now} <CheckCheck className="size-3.5 text-sky-500" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition",
        active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
