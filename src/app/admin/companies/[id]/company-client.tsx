"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CalendarPlus, CircleCheck, CirclePause, LogIn, Plus, Trash2, XCircle } from "lucide-react";
import {
  activateManually,
  deleteOrganization,
  extendTrial,
  impersonate,
  recordInvoice,
  setOrgStatus,
  updateOrgProfile,
  updateSubscription,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import type { Option } from "@/lib/constants";

type Result = { ok?: boolean; error?: string } | undefined;

function isRedirect(e: unknown) {
  return !!e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT");
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, success: string, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) return void toast.error(r.error);
        toast.success(success);
        after?.();
        router.refresh();
      } catch (e) {
        if (isRedirect(e)) throw e;
        toast.error("Something went wrong. Please try again.");
      }
    });
  return { run, pending };
}

// ---------------------------------------------------------------- profile

export function ProfileForm({
  org,
  businessTypes,
}: {
  org: { id: string; name: string; slug: string; ownerName: string | null; ownerEmail: string | null; ownerPhone: string | null; city: string | null; businessType: string | null; teamSize: string | null; notes: string | null };
  businessTypes: Option[];
}) {
  const { run, pending } = useRun();
  return (
    <form action={(fd) => run(() => updateOrgProfile(org.id, fd), "Company profile saved")} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Company name" required>
        <Input name="name" defaultValue={org.name} required />
      </Field>
      <Field label="Website URL (slug)" hint="Changing it breaks old public website links.">
        <div className="flex items-center rounded-lg border border-zinc-300 bg-zinc-50 pl-3 text-sm text-zinc-500 focus-within:border-brand-500">
          /site/
          <input name="slug" defaultValue={org.slug} className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2 text-zinc-900 outline-none" />
        </div>
      </Field>
      <Field label="Owner name">
        <Input name="ownerName" defaultValue={org.ownerName ?? ""} />
      </Field>
      <Field label="Owner email">
        <Input name="ownerEmail" type="email" defaultValue={org.ownerEmail ?? ""} />
      </Field>
      <Field label="Owner phone">
        <Input name="ownerPhone" defaultValue={org.ownerPhone ?? ""} />
      </Field>
      <Field label="City">
        <Input name="city" defaultValue={org.city ?? ""} />
      </Field>
      <Field label="Business type">
        <Select name="businessType" options={businessTypes} placeholder="Not set" defaultValue={org.businessType ?? ""} />
      </Field>
      <Field label="Team size">
        <Input name="teamSize" defaultValue={org.teamSize ?? ""} />
      </Field>
      <Field label="Internal notes" hint="Only visible to platform admins." className="sm:col-span-2">
        <Textarea name="notes" defaultValue={org.notes ?? ""} placeholder="Sales notes, special pricing, support history..." />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- subscription

type Sub = {
  id: string;
  status: string;
  planId: string | null;
  billingCycle: string;
  trialEndsAt: string;
  currentPeriodEnd: string;
  suspendedReason: string | null;
};

export function SubscriptionPanel({ org, plans, statuses }: { org: Sub; plans: (Option & { priceMonthly: number; priceYearly: number })[]; statuses: Option[] }) {
  const { run, pending } = useRun();
  const [modal, setModal] = useState<"activate" | "suspend" | "cancel" | "pastdue" | null>(null);
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [recordInv, setRecordInv] = useState(true);
  const [actPlan, setActPlan] = useState(org.planId ?? plans[0]?.value ?? "");
  const [actCycle, setActCycle] = useState(org.billingCycle);
  const plan = plans.find((p) => p.value === actPlan);
  const suggested = plan ? Math.round((actCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly) * 1.18) : 0;

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-1">
          <input
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-7 w-12 rounded-md border border-zinc-200 px-2 text-center text-sm outline-none"
            aria-label="Days"
          />
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => extendTrial(org.id, Number(days)), `Trial extended by ${days} days`)}>
            <CalendarPlus /> Extend trial
          </Button>
        </div>
        <Button size="sm" variant="success" onClick={() => setModal("activate")}>
          <CircleCheck /> Activate (paid offline)
        </Button>
        {org.status !== "PAST_DUE" && org.status !== "SUSPENDED" && (
          <Button size="sm" variant="secondary" onClick={() => setModal("pastdue")}>
            <CirclePause /> Mark past due
          </Button>
        )}
        {org.status !== "CANCELLED" && org.status !== "SUSPENDED" && (
          <Button size="sm" variant="secondary" onClick={() => setModal("cancel")}>
            <XCircle /> Cancel subscription
          </Button>
        )}
        {org.status === "SUSPENDED" ? (
          <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => setOrgStatus(org.id, "ACTIVE"), "Company unsuspended")}>
            <CircleCheck /> Unsuspend
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => (setReason(""), setModal("suspend"))}>
            <Ban /> Suspend
          </Button>
        )}
      </div>

      <form action={(fd) => run(() => updateSubscription(org.id, fd), "Subscription updated")} className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:col-span-2">Edit directly</p>
        <Field label="Status">
          <Select name="status" options={statuses} defaultValue={org.status} />
        </Field>
        <Field label="Plan">
          <Select name="planId" options={plans} placeholder="No plan" defaultValue={org.planId ?? ""} />
        </Field>
        <Field label="Billing cycle">
          <Select
            name="billingCycle"
            options={[
              { value: "MONTHLY", label: "Monthly" },
              { value: "YEARLY", label: "Yearly" },
            ]}
            defaultValue={org.billingCycle}
          />
        </Field>
        <Field label="Trial ends">
          <Input name="trialEndsAt" type="date" defaultValue={org.trialEndsAt} />
        </Field>
        <Field label="Paid until (period end)">
          <Input name="currentPeriodEnd" type="date" defaultValue={org.currentPeriodEnd} />
        </Field>
        <Field label="Suspension reason" hint="Used when status is Suspended">
          <Input name="suspendedReason" defaultValue={org.suspendedReason ?? ""} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="secondary" loading={pending}>
            Save subscription
          </Button>
        </div>
      </form>

      <Modal
        open={modal === "activate"}
        onClose={() => setModal(null)}
        title="Activate subscription"
        description="Use this when the customer paid by bank transfer, cheque or another offline method."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="success" loading={pending} onClick={() => (document.getElementById("activate-form") as HTMLFormElement)?.requestSubmit()}>
              Activate
            </Button>
          </>
        }
      >
        <form id="activate-form" action={(fd) => run(() => activateManually(org.id, fd), "Company activated", () => setModal(null))} className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" required>
            <Select name="planId" options={plans} value={actPlan} onChange={(e) => setActPlan(e.target.value)} />
          </Field>
          <Field label="Billing cycle">
            <Select
              name="billingCycle"
              value={actCycle}
              onChange={(e) => setActCycle(e.target.value)}
              options={[
                { value: "MONTHLY", label: "Monthly" },
                { value: "YEARLY", label: "Yearly" },
              ]}
            />
          </Field>
          <Field label="Paid until" hint="Leave empty for 30 days / 1 year from today" className="sm:col-span-2">
            <Input name="periodEnd" type="date" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
            <input type="checkbox" name="recordInvoice" checked={recordInv} onChange={(e) => setRecordInv(e.target.checked)} className="size-4 accent-brand-600" />
            Record an invoice for this payment
          </label>
          {recordInv && (
            <>
              <Field label="Amount received (incl. GST)" required>
                <Input key={suggested} name="amount" inputMode="numeric" defaultValue={suggested || ""} />
              </Field>
              <Field label="Description">
                <Input name="description" placeholder="e.g. Growth plan - yearly (NEFT UTR 1234)" />
              </Field>
            </>
          )}
        </form>
      </Modal>

      <Modal
        open={modal === "suspend"}
        onClose={() => setModal(null)}
        size="sm"
        title="Suspend this company?"
        description="Users can still sign in but will see a suspended notice and cannot make changes. Webhooks and public pages stop working."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} disabled={reason.trim().length < 3} onClick={() => run(() => setOrgStatus(org.id, "SUSPENDED", reason), "Company suspended", () => setModal(null))}>
              Suspend
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="Shown to the company's users.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment overdue for 30 days / terms violation" className="min-h-16" />
        </Field>
      </Modal>

      <ConfirmDialog
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel subscription?"
        description="The company keeps access until its paid-until date, then becomes read-only."
        confirmLabel="Cancel subscription"
        action={() => setOrgStatus(org.id, "CANCELLED")}
        successMessage="Subscription cancelled"
      />
      <ConfirmDialog
        open={modal === "pastdue"}
        onClose={() => setModal(null)}
        variant="primary"
        title="Mark as past due?"
        description="Use when a renewal payment failed. The company gets a 3-day grace period after its paid-until date, then becomes read-only."
        confirmLabel="Mark past due"
        action={() => setOrgStatus(org.id, "PAST_DUE")}
        successMessage="Marked as past due"
      />
    </div>
  );
}

// ---------------------------------------------------------------- users / invoices / danger

export function LoginAsButton({ userId, name, disabled }: { userId: string; name: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
        <LogIn /> Login as
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        variant="primary"
        title={`Login as ${name}?`}
        description="You will see the CRM exactly as this user does, to help with support. Everything you do is done as this user and the session is recorded in the audit log. Use 'Return to admin' in the banner to come back."
        confirmLabel="Login as user"
        action={() => impersonate(userId)}
      />
    </>
  );
}

export function RecordInvoiceButton({ orgId }: { orgId: string }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus /> Record invoice
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record an invoice"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={() => (document.getElementById("invoice-form") as HTMLFormElement)?.requestSubmit()}>
              Save invoice
            </Button>
          </>
        }
      >
        <form id="invoice-form" action={(fd) => run(() => recordInvoice(orgId, fd), "Invoice recorded", () => setOpen(false))} className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (incl. GST)" required>
            <Input name="amount" inputMode="numeric" required />
          </Field>
          <Field label="Status">
            <Select
              name="status"
              defaultValue="PAID"
              options={[
                { value: "PAID", label: "Paid" },
                { value: "FAILED", label: "Failed" },
                { value: "REFUNDED", label: "Refunded" },
              ]}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input name="description" placeholder="Growth plan - monthly" />
          </Field>
          <Field label="Period start">
            <Input name="periodStart" type="date" />
          </Field>
          <Field label="Period end">
            <Input name="periodEnd" type="date" />
          </Field>
        </form>
      </Modal>
    </>
  );
}

export function DeleteCompanyCard({ orgId, slug, name, disabled }: { orgId: string; slug: string; name: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-900">Delete this company permanently</p>
        <p className="text-sm text-zinc-500">All users, leads, properties, bookings, documents and settings are deleted. This cannot be undone.</p>
      </div>
      <Button variant="danger" disabled={disabled} onClick={() => (setTyped(""), setOpen(true))}>
        <Trash2 /> Delete company
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        size="sm"
        title={`Delete ${name}?`}
        description="This permanently removes the company and all of its data."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={typed !== slug}
              onClick={() =>
                start(async () => {
                  try {
                    const r = await deleteOrganization(orgId, typed);
                    if (r?.error) toast.error(r.error);
                  } catch (e) {
                    if (isRedirect(e)) {
                      toast.success("Company deleted");
                      throw e;
                    }
                    toast.error("Could not delete the company.");
                  }
                })
              }
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <Field label={`Type ${slug} to confirm`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </Modal>
    </div>
  );
}
