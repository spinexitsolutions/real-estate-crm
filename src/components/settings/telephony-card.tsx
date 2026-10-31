"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, PhoneForwarded, RefreshCw } from "lucide-react";
import { regenerateTelephonyKey, saveTelephony } from "@/actions/telephony";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type TelephonySettings = {
  telephonyProvider: string | null;
  exotelSid: string | null;
  exotelSubdomain: string | null;
  exotelCallerId: string | null;
  hasExotelKey: boolean;
  hasExotelToken: boolean;
  knowlaritySrNumber: string | null;
  knowlarityCallerId: string | null;
  hasKnowlarityKey: boolean;
  hasKnowlarityAuth: boolean;
  telephonyWebhookKey: string | null;
};

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
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

const PROVIDERS = [
  { value: "", label: "Not connected", hint: "Calls are dialled from the agent's phone and logged manually." },
  { value: "EXOTEL", label: "Exotel", hint: "Click-to-call, call recording and missed-call alerts." },
  { value: "KNOWLARITY", label: "Knowlarity", hint: "Click-to-call via SuperReceptionist with recordings." },
];

export function TelephonyCard({ origin, settings }: { origin: string; settings: TelephonySettings }) {
  const router = useRouter();
  const [provider, setProvider] = useState(settings.telephonyProvider ?? "");
  const [pending, start] = useTransition();
  const [regen, startRegen] = useTransition();
  const key = settings.telephonyWebhookKey;
  const callbackUrl = (p: string) => (key ? `${origin}/api/webhooks/telephony/${p}?key=${key}` : "Save settings once to generate the callback URL");

  const connected =
    (settings.telephonyProvider === "EXOTEL" && settings.exotelSid && settings.hasExotelKey && settings.hasExotelToken && settings.exotelCallerId) ||
    (settings.telephonyProvider === "KNOWLARITY" && settings.hasKnowlarityKey && settings.hasKnowlarityAuth && settings.knowlaritySrNumber);

  return (
    <section id="telephony" className="card grid scroll-mt-24 gap-6 p-5 lg:grid-cols-[280px_1fr] lg:p-6">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <PhoneForwarded className="size-[18px]" />
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900">Calling (IVR)</h2>
          {connected ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Connected</Badge> : <Badge>Manual</Badge>}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Connect Exotel or Knowlarity for one-click calling from the CRM. The agent&apos;s phone rings first, then the customer is connected. Calls are recorded and missed incoming calls create an instant call-back reminder.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">Each agent must add their mobile number in My Profile.</p>
      </div>

      <form
        className="min-w-0 space-y-5"
        action={(fd) =>
          start(async () => {
            fd.set("telephonyProvider", provider);
            const res = await saveTelephony(fd);
            if (res.error) return void toast.error(res.error);
            toast.success("Calling settings saved");
            router.refresh();
          })
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProvider(p.value)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                provider === p.value ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{p.hint}</span>
            </button>
          ))}
        </div>

        {provider === "EXOTEL" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account SID" required>
              <Input name="exotelSid" defaultValue={settings.exotelSid ?? ""} placeholder="yourcompany1" />
            </Field>
            <Field label="API subdomain" hint="api.exotel.com (Singapore) or api.in.exotel.com (Mumbai)">
              <Input name="exotelSubdomain" defaultValue={settings.exotelSubdomain ?? "api.exotel.com"} />
            </Field>
            <Field label="API key" hint={settings.hasExotelKey ? "Saved. Leave blank to keep." : undefined}>
              <Input name="exotelApiKey" type="password" autoComplete="off" placeholder={settings.hasExotelKey ? "••••••••" : ""} />
            </Field>
            <Field label="API token" hint={settings.hasExotelToken ? "Saved. Leave blank to keep." : undefined}>
              <Input name="exotelApiToken" type="password" autoComplete="off" placeholder={settings.hasExotelToken ? "••••••••" : ""} />
            </Field>
            <Field label="ExoPhone (caller ID)" required hint="The virtual number customers see, e.g. 08047xxxxxx" className="sm:col-span-2">
              <Input name="exotelCallerId" defaultValue={settings.exotelCallerId ?? ""} inputMode="tel" />
            </Field>
          </div>
        )}

        {provider === "KNOWLARITY" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SR number (k_number)" required hint="Your SuperReceptionist number, with country code">
              <Input name="knowlaritySrNumber" defaultValue={settings.knowlaritySrNumber ?? ""} inputMode="tel" placeholder="+918069xxxxxx" />
            </Field>
            <Field label="Caller ID" hint="Optional">
              <Input name="knowlarityCallerId" defaultValue={settings.knowlarityCallerId ?? ""} inputMode="tel" />
            </Field>
            <Field label="API key (x-api-key)" hint={settings.hasKnowlarityKey ? "Saved. Leave blank to keep." : undefined}>
              <Input name="knowlarityApiKey" type="password" autoComplete="off" placeholder={settings.hasKnowlarityKey ? "••••••••" : ""} />
            </Field>
            <Field label="Authorization token" hint={settings.hasKnowlarityAuth ? "Saved. Leave blank to keep." : undefined}>
              <Input name="knowlarityAuthToken" type="password" autoComplete="off" placeholder={settings.hasKnowlarityAuth ? "••••••••" : ""} />
            </Field>
          </div>
        )}

        {provider && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">Callback URL</p>
              {key && (
                <button
                  type="button"
                  disabled={regen}
                  onClick={() =>
                    startRegen(async () => {
                      const res = await regenerateTelephonyKey();
                      if (res.error) return void toast.error(res.error);
                      toast.success("New key generated. Update the URL in your provider dashboard.");
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", regen && "animate-spin")} /> Regenerate key
                </button>
              )}
            </div>
            <CopyField value={callbackUrl(provider.toLowerCase())} />
            <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-600">
              {provider === "EXOTEL" ? (
                <>
                  <li>In Exotel, open API Settings and copy the Account SID, API key and API token.</li>
                  <li>Click-to-call status updates and recordings are sent to this URL automatically.</li>
                  <li>
                    For incoming and missed calls: in App Bazaar, add a <span className="font-medium">Passthru</span> applet to your ExoPhone flow and paste this URL.
                  </li>
                  <li>Save, then use the Call button on any lead.</li>
                </>
              ) : (
                <>
                  <li>In Knowlarity, go to Settings and API to copy the API key and Authorization token.</li>
                  <li>Under Webhooks, add this URL for call events (incoming, outgoing and missed calls).</li>
                  <li>Save, then use the Call button on any lead.</li>
                </>
              )}
            </ol>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button type="submit" loading={pending}>
            Save calling settings
          </Button>
        </div>
      </form>
    </section>
  );
}
