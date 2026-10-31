"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, FlaskConical, KeyRound, RefreshCw } from "lucide-react";
import { ensureLeadWebhookKey, generateVerifyToken, saveFacebookSettings, sendTestPortalLead } from "@/actions/integrations";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700" title={value}>
          {value}
        </code>
        <Button
          variant="secondary"
          size="sm"
          className="h-8"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Could not copy. Select and copy manually.");
            }
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function TestLeadButton({ portal, disabled }: { portal: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; leadId?: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await sendTestPortalLead(portal);
            if (res.error) {
              setResult({ ok: false, text: res.error });
              return;
            }
            setResult({ ok: true, text: res.data?.viaHttp ? "Test lead received through the webhook URL." : "Test lead processed (direct).", leadId: res.data?.leadId });
            router.refresh();
          })
        }
      >
        <FlaskConical /> Send test lead
      </Button>
      {result && (
        <p className={result.ok ? "text-xs text-emerald-700" : "text-xs text-rose-600"}>
          {result.text}{" "}
          {result.leadId && (
            <Link href={`/leads/${result.leadId}`} className="font-medium underline">
              Open lead
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

export function GenerateKeyButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await ensureLeadWebhookKey();
          if (res.error) return void toast.error(res.error);
          toast.success("Webhook key generated");
          router.refresh();
        })
      }
    >
      <KeyRound /> Generate webhook key
    </Button>
  );
}

export function FacebookSettingsForm({ verifyToken, hasSecret, hasToken, canEdit }: { verifyToken: string; hasSecret: boolean; hasToken: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState(verifyToken);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          fd.set("fbVerifyToken", token);
          const res = await saveFacebookSettings(fd);
          if (res.error) return void toast.error(res.error);
          toast.success("Facebook settings saved");
          router.refresh();
        })
      }
      className="space-y-4"
    >
      <Field label="Verify token" hint="Paste the same value in Meta app > Webhooks when subscribing.">
        <div className="flex gap-2">
          <Input value={token} onChange={(e) => setToken(e.target.value)} disabled={!canEdit} placeholder="Generate or type a random string" />
          <Button
            type="button"
            variant="secondary"
            disabled={!canEdit}
            onClick={async () => {
              const r = await generateVerifyToken();
              if (r.data) setToken(r.data.token);
            }}
          >
            <RefreshCw /> Generate
          </Button>
        </div>
      </Field>
      <Field label="App secret" hint={hasSecret ? "Saved. Leave blank to keep the current secret." : "Used to verify that webhook calls really come from Meta."}>
        <Input name="fbAppSecret" type="password" autoComplete="off" disabled={!canEdit} placeholder={hasSecret ? "********" : "Meta app secret"} />
      </Field>
      <Field label="Page access token" hint={hasToken ? "Saved. Leave blank to keep the current token." : "Long-lived Page token with leads_retrieval and pages_manage_metadata permissions."}>
        <Input name="fbPageAccessToken" type="password" autoComplete="off" disabled={!canEdit} placeholder={hasToken ? "********" : "EAAG..."} />
      </Field>
      {canEdit ? (
        <Button type="submit" loading={pending}>
          Save Facebook settings
        </Button>
      ) : (
        <p className="text-xs text-slate-500">Only admins can change these settings.</p>
      )}
    </form>
  );
}
