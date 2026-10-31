"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, KeyRound, LockKeyhole, RotateCcw, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { createOrRotatePortalAccess, revokePortalAccess } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/field";
import { WhatsAppIcon } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import { waLink } from "@/lib/utils";

export function PortalAccessCard({
  leadId,
  leadName,
  leadPhone,
  access,
  origin,
  companyName,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string;
  access: { token: string; hasPin: boolean; lastViewedAt: string | null; revokedAt: string | null } | null;
  origin: string;
  companyName?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setupOpen, setSetupOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(false);
  const active = access && !access.revokedAt;
  const url = active ? `${origin.replace(/\/$/, "")}/portal/${access.token}` : null;
  const first = leadName.split(" ")[0];
  const shareText = (link: string, withPin?: string) =>
    `Dear ${first}, you can now view your booking, payment schedule, receipts and documents anytime on your private customer portal${companyName ? ` from ${companyName}` : ""}:\n${link}${withPin ? `\n\nYour PIN: ${withPin}` : ""}\n\nPlease do not share this link with anyone.`;

  const generate = () =>
    start(async () => {
      const r = await createOrRotatePortalAccess(leadId, usePin ? pin : undefined);
      if (r.error) return void toast.error(r.error);
      const link = `${origin.replace(/\/$/, "")}/portal/${r.data!.token}`;
      const sharePin = usePin ? pin : undefined;
      setSetupOpen(false);
      setPin("");
      toast.success(access ? "New portal link created. The old link no longer works." : "Portal link created", {
        description: sharePin ? "The PIN is included in the WhatsApp message." : undefined,
        duration: 15000,
        action: { label: "Send on WhatsApp", onClick: () => window.open(waLink(leadPhone, shareText(link, sharePin)), "_blank", "noopener") },
      });
      router.refresh();
    });

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <UserRound className="size-4 text-slate-400" /> Customer portal
          </h3>
          <p className="mt-0.5 text-[13px] text-slate-500">Private link where the customer sees payments, receipts and documents.</p>
        </div>
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <ShieldCheck className="size-3.5" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <ShieldOff className="size-3.5" /> {access?.revokedAt ? "Revoked" : "Not shared"}
          </span>
        )}
      </div>
      <div className="space-y-3 p-5">
        {url && access ? (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">{url}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied");
                }}
                className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Copy link"
              >
                <Copy className="size-4" />
              </button>
              <a href={url} target="_blank" rel="noreferrer" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Open portal">
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {access.hasPin ? <LockKeyhole className="size-3.5" /> : <KeyRound className="size-3.5" />}
              {access.hasPin ? "Protected with a PIN" : "No PIN"} - {access.lastViewedAt ? `last opened ${formatRelative(access.lastViewedAt)}` : "not opened yet"}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={waLink(leadPhone, shareText(url))} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-medium text-white hover:bg-emerald-700">
                <WhatsAppIcon className="size-4" /> Share on WhatsApp
              </a>
              <Button size="sm" variant="secondary" onClick={() => setSetupOpen(true)} disabled={pending}>
                <RotateCcw /> New link
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setRevokeOpen(true)} disabled={pending}>
                <ShieldOff /> Revoke
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={() => setSetupOpen(true)} loading={pending}>
            <KeyRound /> {access?.revokedAt ? "Create a new portal link" : "Create portal link"}
          </Button>
        )}
      </div>

      <Modal
        open={setupOpen}
        onClose={() => !pending && setSetupOpen(false)}
        size="sm"
        title={access ? "Create a new portal link" : "Create portal link"}
        description={access ? "The current link will stop working immediately." : `A private link for ${leadName}. You can send it on WhatsApp right after.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSetupOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button loading={pending} onClick={generate} disabled={usePin && !/^\d{4,6}$/.test(pin)}>
              <KeyRound /> Create link
            </Button>
          </>
        }
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input type="checkbox" checked={usePin} onChange={(e) => setUsePin(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            <span className="block text-sm font-medium text-slate-800">Protect with a PIN</span>
            <span className="block text-xs text-slate-500">The customer must enter this 4-6 digit PIN to open the portal.</span>
          </span>
        </label>
        {usePin && (
          <Field label="PIN" className="mt-4">
            <Input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 4821" autoFocus />
          </Field>
        )}
      </Modal>
      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="Revoke portal access?"
        description="The customer's link will stop working. You can create a new link later."
        confirmLabel="Revoke access"
        successMessage="Portal access revoked"
        action={async () => {
          const r = await revokePortalAccess(leadId);
          router.refresh();
          return r;
        }}
      />
    </div>
  );
}
