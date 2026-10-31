"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Building,
  Check,
  Copy,
  Database,
  Download,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { regenerateWebhookKey, saveCompany, savePreferences, saveWhatsApp } from "@/actions/settings";
import type { ActionResult } from "@/lib/action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { WhatsAppIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type S = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  currency: string;
  defaultCountryCode: string;
  defaultCommission: number;
  waApiEnabled: boolean;
  waPhoneNumberId: string;
  hasToken: boolean;
  leadWebhookKey: string;
  waVerifyToken: string;
  hasAppSecret: boolean;
  waDigestTemplate: string;
  orgId: string;
};

const CURRENCIES = [
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "EUR", label: "EUR - Euro" },
];

function Section({
  icon: Icon,
  title,
  description,
  children,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section className="card grid gap-6 p-5 lg:grid-cols-[280px_1fr] lg:p-6">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="size-[18px]" />
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {badge}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function SectionForm({ action, children, submitLabel = "Save changes" }: { action: (fd: FormData) => Promise<ActionResult>; children: React.ReactNode; submitLabel?: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await action(fd);
          if (res.error) toast.error(res.error);
          else toast.success("Settings saved");
        })
      }
      className="space-y-4"
    >
      {children}
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
      <Button
        variant="secondary"
        size="icon"
        aria-label="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Could not copy. Select and copy manually.");
          }
        }}
      >
        {copied ? <Check className="text-emerald-600" /> : <Copy />}
      </Button>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-auto rounded-lg bg-[#0b1020] p-4 pr-12 text-xs leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Could not copy");
          }
        }}
        className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="Copy code"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function SettingsForms({ settings: s, origin, waApiLocked }: { settings: S; origin: string; waApiLocked?: string | null }) {
  const [waEnabled, setWaEnabled] = useState(s.waApiEnabled);
  const [verifyToken, setVerifyToken] = useState(s.waVerifyToken);
  const [key, setKey] = useState(s.leadWebhookKey);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [snippet, setSnippet] = useState<"curl" | "html" | "js">("curl");

  const webhookUrl = key ? `${origin}/api/webhooks/lead?key=${key}` : "";
  const samples = {
    curl: `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Rahul Verma",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "source": "WEBSITE",
    "message": "Looking for a 3 BHK in Powai",
    "budget": 25000000,
    "location": "Powai, Mumbai",
    "propertyType": "APARTMENT"
  }'`,
    html: `<form id="enquiry-form">
  <input name="name" placeholder="Your name" required />
  <input name="phone" placeholder="Phone" required />
  <input name="email" type="email" placeholder="Email" />
  <textarea name="message" placeholder="Requirement"></textarea>
  <button type="submit">Send enquiry</button>
</form>
<script>
  document.getElementById("enquiry-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetch("${webhookUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, source: "WEBSITE" }),
    });
    e.target.reset();
    alert("Thank you! Our team will contact you shortly.");
  });
</script>`,
    js: `await fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name, phone, email,
    source: "FACEBOOK",       // WEBSITE, FACEBOOK, INSTAGRAM, GOOGLE_ADS, ...
    message, budget, location, propertyType,
  }),
});`,
  };

  return (
    <div className="space-y-6">
      <Section icon={Building} title="Company profile" description="Shown in the sidebar and used in WhatsApp templates as {{company}}.">
        <SectionForm action={saveCompany}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required className="sm:col-span-2">
              <Input name="companyName" required defaultValue={s.companyName} />
            </Field>
            <Field label="Phone">
              <Input name="companyPhone" defaultValue={s.companyPhone} placeholder="+91 98200 12345" />
            </Field>
            <Field label="Email">
              <Input name="companyEmail" type="email" defaultValue={s.companyEmail} placeholder="sales@company.com" />
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <Textarea name="companyAddress" defaultValue={s.companyAddress} rows={2} className="min-h-0" />
            </Field>
          </div>
        </SectionForm>
      </Section>

      <Section icon={SlidersHorizontal} title="Preferences" description="Currency for prices and reports, default phone country code for WhatsApp, and default commission on new deals.">
        <SectionForm action={savePreferences}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency">
              <Select name="currency" options={CURRENCIES} defaultValue={s.currency} />
            </Field>
            <Field label="Default country code" hint="Added to 10-digit numbers">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">+</span>
                <Input name="defaultCountryCode" defaultValue={s.defaultCountryCode} className="pl-6" inputMode="numeric" />
              </div>
            </Field>
            <Field label="Default commission (%)">
              <Input name="defaultCommission" type="number" step="0.01" min={0} max={100} defaultValue={s.defaultCommission} />
            </Field>
          </div>
        </SectionForm>
      </Section>

      <Section
        icon={WhatsAppIcon}
        title="WhatsApp Cloud API"
        description="Without the API, messages open in WhatsApp Web / app via click-to-chat links. Enable the official Cloud API to send directly from the CRM."
        badge={
          s.waApiEnabled ? (
            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" dot="bg-emerald-500">
              Connected
            </Badge>
          ) : (
            <Badge>Link mode</Badge>
          )
        }
      >
        {waApiLocked ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-slate-600">
              Sending through the WhatsApp Cloud API, the two-way inbox and broadcasts are available on {waApiLocked}. Click-to-chat links keep working on every plan.
            </p>
            <Link href="/billing" className="inline-flex h-8 shrink-0 items-center rounded-lg border border-brand-200 px-3 text-[13px] font-medium text-brand-700 hover:bg-brand-50">
              Upgrade
            </Link>
          </div>
        ) : (
        <SectionForm action={saveWhatsApp}>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
            <span>
              <span className="block text-sm font-medium text-slate-900">Send messages via Cloud API</span>
              <span className="block text-xs text-slate-500">Free-form text works within 24 hours of the customer&apos;s last message; outside it Meta requires approved templates.</span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input type="checkbox" name="waApiEnabled" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="peer sr-only" />
              <span className={cn("h-6 w-11 rounded-full transition", waEnabled ? "bg-brand-600" : "bg-slate-300")} />
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", waEnabled ? "left-[22px]" : "left-0.5")} />
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number ID">
              <Input name="waPhoneNumberId" defaultValue={s.waPhoneNumberId} placeholder="e.g. 109876543210987" />
            </Field>
            <Field label="Permanent access token" hint={s.hasToken ? "A token is saved. Leave blank to keep it." : undefined}>
              <Input name="waAccessToken" type="password" autoComplete="off" placeholder={s.hasToken ? "Saved token hidden" : "EAAG..."} />
            </Field>
          </div>
          <div className="border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-900">Incoming messages (two-way inbox)</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Connect the webhook so customer replies and delivery/read receipts appear in the WhatsApp inbox, and unknown numbers become new leads automatically.
            </p>
            <div className="mt-4 space-y-4">
              <Field label="Callback URL">
                <CopyField value={`${origin}/api/webhooks/whatsapp?org=${s.orgId}`} label="WhatsApp callback URL" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Verify token" hint="Paste the same value in Meta when adding the callback URL.">
                  <div className="flex gap-2">
                    <Input name="waVerifyToken" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="Any secret text" className="font-mono text-xs" />
                    <Button variant="secondary" size="icon" aria-label="Generate verify token" title="Generate" onClick={() => setVerifyToken(randomToken())}>
                      <Wand2 />
                    </Button>
                  </div>
                </Field>
                <Field label="App secret" hint={s.hasAppSecret ? "Saved. Leave blank to keep it." : "Recommended: used to verify that webhooks come from Meta."}>
                  <Input name="waAppSecret" type="password" autoComplete="off" placeholder={s.hasAppSecret ? "Saved secret hidden" : "From App settings, Basic"} />
                </Field>
              </div>
              <Field label="Agent daily digest template (optional)" hint="Approved Meta template used to send each agent their morning follow-up summary on WhatsApp. Parameters: {{1}} agent name, {{2}} follow-ups due today, {{3}} overdue.">
                <Input name="waDigestTemplate" defaultValue={s.waDigestTemplate} placeholder="e.g. daily_followup_digest" className="font-mono text-[13px]" />
              </Field>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-[13px] text-slate-600">
            <p className="mb-2 font-medium text-slate-800">How to connect</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Create a Meta Business app (developers.facebook.com) and add the WhatsApp product.</li>
              <li>Register and verify your business phone number, then copy the Phone number ID from WhatsApp, API Setup.</li>
              <li>Create a System User in Business Settings and generate a permanent token with whatsapp_business_messaging permission.</li>
              <li>In WhatsApp, Configuration, click Edit next to Webhook: paste the Callback URL and Verify token above, then Verify and save.</li>
              <li>Under Webhook fields, subscribe to <span className="font-mono text-xs">messages</span>.</li>
              <li>Copy the App secret from App settings, Basic, paste it above and save.</li>
              <li>Create message templates in WhatsApp Manager; once approved, add their exact names on the WhatsApp, Templates page.</li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700"
            >
              Meta Cloud API documentation <ExternalLink className="size-3.5" />
            </a>
          </div>
        </SectionForm>
        )}
      </Section>

      <Section icon={Webhook} title="Lead capture webhook" description="Send enquiries from your website, landing pages, Facebook lead ads (via Zapier / Make) or portals straight into the CRM as new leads.">
        <div className="space-y-4">
          <Field label="Webhook URL (POST, JSON)">
            {key ? (
              <CopyField value={webhookUrl} label="Webhook URL" />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">No key generated yet. Generate one to enable the webhook.</p>
            )}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Accepted fields: <span className="font-mono text-slate-700">name, phone, email, source, message, budget, location, propertyType</span>
            </p>
            <Button variant="secondary" size="sm" onClick={() => (key ? setConfirmRegen(true) : regen())}>
              <RefreshCw /> {key ? "Regenerate key" : "Generate key"}
            </Button>
          </div>
          {key && (
            <div>
              <div className="mb-2 inline-flex gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ["curl", "cURL"],
                    ["html", "HTML form"],
                    ["js", "JavaScript"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSnippet(k)}
                    className={cn("rounded-md px-3 py-1 text-xs font-medium transition", snippet === k ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <CodeBlock code={samples[snippet]} />
            </div>
          )}
        </div>
      </Section>

      <Section icon={Database} title="Data" description="Download a copy of your data at any time. Exports open in Excel and Google Sheets.">
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/leads" className={buttonClass("secondary")}>
            <Download /> Export all leads (CSV)
          </a>
          <a href="/api/reports/export?type=deals&range=all" className={buttonClass("secondary")}>
            <Download /> Export closed deals (CSV)
          </a>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate webhook key?"
        description="The current URL will stop working immediately. Update it on your website and integrations after regenerating."
        confirmLabel="Regenerate"
        variant="primary"
        successMessage="New webhook key generated"
        action={async () => {
          const res = await regenerateWebhookKey();
          if (res.data) setKey(res.data);
          return res;
        }}
      />
    </div>
  );

  async function regen() {
    const res = await regenerateWebhookKey();
    if (res.error) toast.error(res.error);
    else if (res.data) {
      setKey(res.data);
      toast.success("Webhook key generated");
    }
  }
}
