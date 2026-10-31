"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Check, CheckCheck, CircleAlert, Clock, ExternalLink, Inbox, MessageSquareText, Search, Send } from "lucide-react";
import { markConversationRead, sendWhatsApp } from "@/actions/whatsapp";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/ui/icons";
import { isWindowOpen, windowRemainingLabel } from "@/lib/whatsapp-window";
import { cn, fillTemplate, waLink } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

export type Conversation = {
  leadId: string;
  name: string;
  phone: string;
  unread: number;
  lastAt: string;
  lastBody: string;
  lastDirection: string;
};

export type ThreadMessage = {
  id: string;
  body: string;
  direction: string;
  status: string;
  channel: string;
  error: string | null;
  createdAt: string;
  userName: string | null;
};

export type ThreadLead = { id: string; name: string; phone: string; lastInboundAt: string | null; unread: number; status: string };

type Template = { id: string; name: string; body: string; metaName: string | null };

function shortTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM");
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMMM yyyy");
}

export function InboxView({
  conversations,
  lead,
  messages,
  templates,
  apiEnabled,
  countryCode,
  company,
  agentName,
  q,
}: {
  conversations: Conversation[];
  lead: ThreadLead | null;
  messages: ThreadMessage[];
  templates: Template[];
  apiEnabled: boolean;
  countryCode: string;
  company: string;
  agentName: string;
  q: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  }, [search, conversations]);

  // Auto refresh every 10 seconds while the tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10000);
    return () => clearInterval(id);
  }, [router]);

  // Opening a thread clears its unread badge
  const leadId = lead?.id;
  const leadUnread = lead?.unread ?? 0;
  useEffect(() => {
    if (leadId && leadUnread > 0) {
      markConversationRead(leadId).then(() => router.refresh());
    }
  }, [leadId, leadUnread, router]);

  const href = (leadId: string) => `/whatsapp?tab=inbox&lead=${leadId}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="card flex h-[calc(100vh-15rem)] min-h-[520px] overflow-hidden">
      {/* Conversation list */}
      <aside className={cn("flex w-full flex-col border-r border-slate-100 md:w-80 lg:w-96", lead && "hidden md:flex")}>
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" className="input h-9 pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">{conversations.length ? "No matching conversations." : "No conversations yet."}</p>
          ) : (
            filtered.map((c) => (
              <Link
                key={c.leadId}
                href={href(c.leadId)}
                scroll={false}
                className={cn(
                  "flex items-center gap-3 border-b border-slate-50 px-4 py-3 transition",
                  lead?.id === c.leadId ? "bg-brand-50/70" : "hover:bg-slate-50",
                )}
              >
                <Avatar name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-sm", c.unread ? "font-semibold text-slate-900" : "font-medium text-slate-800")}>{c.name}</p>
                    <span className={cn("shrink-0 text-[11px]", c.unread ? "font-semibold text-emerald-600" : "text-slate-400")}>{shortTime(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={cn("truncate text-xs", c.unread ? "text-slate-700" : "text-slate-500")}>
                      {c.lastDirection === "OUT" && <span className="text-slate-400">You: </span>}
                      {c.lastBody}
                    </p>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("min-w-0 flex-1 flex-col", lead ? "flex" : "hidden md:flex")}>
        {!lead ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Inbox} title="Select a conversation" description="Replies from your leads on WhatsApp appear here in real time once the WhatsApp webhook is connected." />
          </div>
        ) : (
          <Thread
            key={lead.id}
            lead={lead}
            messages={messages}
            templates={templates}
            apiEnabled={apiEnabled}
            countryCode={countryCode}
            company={company}
            agentName={agentName}
          />
        )}
      </section>
    </div>
  );
}

function StatusTicks({ status }: { status: string }) {
  if (status === "FAILED") return <CircleAlert className="size-3.5 text-rose-500" />;
  if (status === "READ") return <CheckCheck className="size-3.5 text-sky-500" />;
  if (status === "DELIVERED") return <CheckCheck className="size-3.5 text-slate-400" />;
  return <Check className="size-3.5 text-slate-400" />;
}

function Thread({
  lead,
  messages,
  templates,
  apiEnabled,
  countryCode,
  company,
  agentName,
}: {
  lead: ThreadLead;
  messages: ThreadMessage[];
  templates: Template[];
  apiEnabled: boolean;
  countryCode: string;
  company: string;
  agentName: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const windowOpen = isWindowOpen(lead.lastInboundAt);
  const approved = templates.filter((t) => t.metaName);
  const firstName = lead.name.split(" ")[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const fill = (body: string) => fillTemplate(body, { name: firstName, agent: agentName, company });
  const selected = templates.find((t) => t.id === templateId);
  const apiMode = apiEnabled && (windowOpen || !!selected?.metaName);
  const outgoing = selected && !windowOpen && apiEnabled ? fill(selected.body) : text;

  const sendApi = () => {
    const body = outgoing.trim();
    if (!body) return;
    start(async () => {
      const res = await sendWhatsApp({ leadId: lead.id, phone: lead.phone, body, channel: "API", templateId: templateId || null });
      if (res.error) return void toast.error(res.error);
      setText("");
      setTemplateId("");
      router.refresh();
    });
  };

  const openLink = () => {
    const body = (text || (selected ? fill(selected.body) : "")).trim();
    window.open(waLink(lead.phone, body || undefined, countryCode), "_blank", "noopener,noreferrer");
    if (!body) return;
    start(async () => {
      const res = await sendWhatsApp({ leadId: lead.id, phone: lead.phone, body, channel: "LINK", templateId: templateId || null });
      if (res.error) return void toast.error(res.error);
      setText("");
      setTemplateId("");
      router.refresh();
    });
  };

  let lastDay = "";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Link href="/whatsapp?tab=inbox" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar name={lead.name} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700">
            {lead.name}
          </Link>
          <p className="text-xs text-slate-500">{lead.phone}</p>
        </div>
        {apiEnabled && (
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
              windowOpen ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}
            title="WhatsApp allows free text only within 24 hours of the customer's last message"
          >
            <Clock className="size-3.5" />
            {windowOpen ? `Reply window open - ${windowRemainingLabel(lead.lastInboundAt)}` : "24h window closed"}
          </span>
        )}
      </header>

      <div
        className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-4 py-4 sm:px-8"
        style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
      >
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet.</p>}
        {messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const out = m.direction === "OUT";
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm">{day}</span>
                </div>
              )}
              <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed text-slate-800 shadow-sm sm:max-w-[70%]",
                    out ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-slate-500">
                    {out && m.channel === "LINK" && <span title="Sent from the WhatsApp app via click-to-chat">via app -</span>}
                    {out && m.userName && <span>{m.userName.split(" ")[0]} -</span>}
                    {format(new Date(m.createdAt), "h:mm a")}
                    {out && m.channel === "API" && <StatusTicks status={m.status} />}
                  </p>
                  {m.status === "FAILED" && m.error && <p className="mt-1 text-[11px] text-rose-600">{m.error}</p>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-slate-100 bg-white p-3">
        {apiEnabled && !windowOpen && (
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <Clock className="size-3.5 shrink-0" /> Outside the 24h window: send an approved template via API, or open WhatsApp.
            </p>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="input h-8 py-0 text-[13px] sm:ml-auto sm:w-64"
              aria-label="Approved template"
            >
              <option value="">{approved.length ? "Choose approved template" : "No approved templates yet"}</option>
              {approved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {apiEnabled && !windowOpen && selected ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <p className="whitespace-pre-wrap">{fill(selected.body)}</p>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (apiEnabled && windowOpen) sendApi();
                else openLink();
              }
            }}
            rows={1}
            placeholder={apiEnabled && !windowOpen ? "Type to send via the WhatsApp app instead..." : "Type a message"}
            className="input max-h-32 min-h-10 flex-1 resize-none py-2.5"
          />
          {apiMode && (
            <Button onClick={sendApi} loading={pending} disabled={!outgoing.trim()} className="h-10" title="Send via WhatsApp API">
              <Send /> <span className="hidden sm:inline">Send</span>
            </Button>
          )}
          <Button variant={apiMode ? "secondary" : "success"} onClick={openLink} disabled={pending} className="h-10" title="Open this chat in WhatsApp">
            {apiMode ? <ExternalLink /> : <WhatsAppIcon />}
            <span className="hidden sm:inline">{apiMode ? "App" : "Open in WhatsApp"}</span>
          </Button>
        </div>
        {!apiEnabled && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <MessageSquareText className="size-3.5" /> Messages open in WhatsApp and are logged here. Connect the Cloud API in Settings to send and receive inside the CRM.
          </p>
        )}
      </footer>
    </>
  );
}
