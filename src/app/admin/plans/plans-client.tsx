"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Power, Star, Trash2 } from "lucide-react";
import { deletePlan, savePlan, setPlanActive } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxLeads: number;
  maxProperties: number;
  storageGb: number;
  features: string[];
  razorpayPlanIdMonthly: string | null;
  razorpayPlanIdYearly: string | null;
  highlighted: boolean;
  active: boolean;
  sortOrder: number;
  companies: number;
};

const lim = (n: number) => (n ? n.toLocaleString("en-IN") : "Unlimited");

export function PlansManager({ plans, featureKeys }: { plans: PlanRow[]; featureKeys: { key: string; label: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<PlanRow | null>(null);
  const [pending, start] = useTransition();
  const label = (k: string) => featureKeys.find((f) => f.key === k)?.label ?? k;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> New plan
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={cn("card flex flex-col p-5", p.highlighted && "ring-2 ring-brand-500", !p.active && "opacity-70")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-900">{p.name}</h3>
                  {p.highlighted && (
                    <Badge className="bg-brand-50 text-brand-700 ring-brand-600/20">
                      <Star className="size-3" /> Popular
                    </Badge>
                  )}
                  {!p.active && <Badge className="bg-zinc-100 text-zinc-600 ring-zinc-500/20">Inactive</Badge>}
                </div>
                <p className="font-mono text-xs text-zinc-500">{p.code}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{p.companies} companies</span>
            </div>
            {p.description && <p className="mt-2 text-sm text-zinc-500">{p.description}</p>}
            <p className="mt-4 text-2xl font-semibold text-zinc-900">
              {formatCurrency(p.priceMonthly)}
              <span className="text-sm font-normal text-zinc-500"> / month</span>
            </p>
            <p className="text-xs text-zinc-500">{formatCurrency(p.priceYearly)} / year</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-500">Users</dt>
                <dd className="font-semibold text-zinc-900">{lim(p.maxUsers)}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-500">Leads</dt>
                <dd className="font-semibold text-zinc-900">{lim(p.maxLeads)}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-500">Properties</dt>
                <dd className="font-semibold text-zinc-900">{lim(p.maxProperties)}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <dt className="text-zinc-500">Storage</dt>
                <dd className="font-semibold text-zinc-900">{p.storageGb} GB</dd>
              </div>
            </dl>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-zinc-700">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" /> {label(f)}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
              <p>Razorpay monthly: <span className="font-mono">{p.razorpayPlanIdMonthly ?? "not created yet"}</span></p>
              <p>Razorpay yearly: <span className="font-mono">{p.razorpayPlanIdYearly ?? "not created yet"}</span></p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                <Pencil /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setPlanActive(p.id, !p.active);
                    if (r.error) return void toast.error(r.error);
                    toast.success(p.active ? "Plan deactivated - hidden from new customers" : "Plan activated");
                    router.refresh();
                  })
                }
              >
                <Power /> {p.active ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="ghost" className="ml-auto text-rose-600" onClick={() => setDeleting(p)}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing && <PlanForm plan={editing === "new" ? null : editing} featureKeys={featureKeys} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete the ${deleting?.name ?? ""} plan?`}
        description={deleting?.companies ? `${deleting.companies} companies use this plan, so it cannot be deleted. Deactivate it instead.` : "The plan will be removed from the pricing page."}
        action={async () => {
          const r = await deletePlan(deleting!.id);
          if (!r.error) router.refresh();
          return r;
        }}
        successMessage="Plan deleted"
      />
    </>
  );
}

function PlanForm({ plan, featureKeys, onClose }: { plan: PlanRow | null; featureKeys: { key: string; label: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      size="lg"
      title={plan ? `Edit ${plan.name}` : "New plan"}
      description="Limits use 0 for unlimited. Price changes apply to new subscriptions; existing Razorpay subscriptions keep their price."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => (document.getElementById("plan-form") as HTMLFormElement)?.requestSubmit()}>
            Save plan
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
        action={(fd) =>
          start(async () => {
            setError(null);
            const r = await savePlan(plan?.id ?? null, fd);
            if (r.error) return void setError(r.error);
            toast.success("Plan saved");
            onClose();
            router.refresh();
          })
        }
        className="grid gap-4 sm:grid-cols-4"
      >
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-4">{error}</p>}
        <Field label="Name" required className="sm:col-span-2">
          <Input name="name" defaultValue={plan?.name} required />
        </Field>
        <Field label="Code" required hint="e.g. GROWTH" className="sm:col-span-1">
          <Input name="code" defaultValue={plan?.code} required className="font-mono uppercase" />
        </Field>
        <Field label="Sort order">
          <Input name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} />
        </Field>
        <Field label="Description" className="sm:col-span-4">
          <Textarea name="description" defaultValue={plan?.description ?? ""} className="min-h-14" />
        </Field>
        <Field label="Monthly price (Rs.)" required className="sm:col-span-2">
          <Input name="priceMonthly" inputMode="numeric" defaultValue={plan?.priceMonthly} required />
        </Field>
        <Field label="Yearly price (Rs.)" required className="sm:col-span-2">
          <Input name="priceYearly" inputMode="numeric" defaultValue={plan?.priceYearly} required />
        </Field>
        <Field label="Max users">
          <Input name="maxUsers" type="number" min={0} defaultValue={plan?.maxUsers ?? 3} />
        </Field>
        <Field label="Max leads">
          <Input name="maxLeads" type="number" min={0} defaultValue={plan?.maxLeads ?? 0} />
        </Field>
        <Field label="Max properties">
          <Input name="maxProperties" type="number" min={0} defaultValue={plan?.maxProperties ?? 0} />
        </Field>
        <Field label="Storage (GB)">
          <Input name="storageGb" type="number" min={0} defaultValue={plan?.storageGb ?? 2} />
        </Field>
        <div className="sm:col-span-4">
          <p className="label">Features</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {featureKeys.map((f) => (
              <label key={f.key} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                <input type="checkbox" name="features" value={f.key} defaultChecked={plan ? plan.features.includes(f.key) : ["leads", "pipeline", "followups", "properties"].includes(f.key)} className="size-4 accent-brand-600" />
                {f.label}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
          <input type="checkbox" name="highlighted" defaultChecked={plan?.highlighted} className="size-4 accent-brand-600" /> Highlight as most popular
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={plan ? plan.active : true} className="size-4 accent-brand-600" /> Available for new customers
        </label>
      </form>
    </Modal>
  );
}
