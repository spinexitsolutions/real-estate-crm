"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Ellipsis, Handshake, Pencil, Plus, Trash2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { deleteDeal, updateDealStage } from "@/actions/deals";
import { Avatar } from "@/components/ui/avatar";
import { OptionBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DEAL_STAGES } from "@/lib/constants";
import { formatCompact, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DealFormModal } from "./deal-form";

export type DealRow = {
  id: string;
  title: string;
  value: number;
  commissionPct: number;
  stage: string;
  expectedCloseDate: string | null;
  closedAt: string | null;
  notes: string | null;
  leadId: string;
  leadName: string;
  leadPhone: string;
  propertyId: string | null;
  propertyTitle: string | null;
  propertyCode: string | null;
  agentId: string | null;
  agentName: string | null;
  createdAt: string;
};

type Lists = {
  leads: { id: string; name: string; phone: string }[];
  properties: { id: string; title: string; code: string; price: number }[];
  users: { id: string; name: string }[];
};

export function DealsView({
  deals,
  view,
  currency,
  defaultCommission,
  lists,
}: {
  deals: DealRow[];
  view: "board" | "list";
  currency: string;
  defaultCommission: number;
  lists: Lists;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [optimistic, setStage] = useOptimistic(deals, (state, u: { id: string; stage: string }) =>
    state.map((d) => (d.id === u.id ? { ...d, stage: u.stage } : d)),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DealRow | null>(null);
  const [deleting, setDeleting] = useState<DealRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  // Handle ?new=1 and ?open=<id>
  useEffect(() => {
    const open = params.get("open");
    if (params.get("new") === "1") {
      setEditing(null);
      setFormOpen(true);
    } else if (open) {
      const d = deals.find((x) => x.id === open);
      if (d) {
        setEditing(d);
        setFormOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (params.get("new") || params.get("open") || params.get("leadId") || params.get("propertyId")) {
      const next = new URLSearchParams(params.toString());
      ["new", "open", "leadId", "propertyId"].forEach((k) => next.delete(k));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const moveTo = (id: string, stage: string) => {
    const d = optimistic.find((x) => x.id === id);
    if (!d || d.stage === stage) return;
    start(async () => {
      setStage({ id, stage });
      const res = await updateDealStage(id, stage);
      if (res.error) toast.error(res.error);
      else {
        const label = DEAL_STAGES.find((s) => s.value === stage)?.label;
        toast.success(stage === "WON" ? "Deal closed. Congratulations!" : `Moved to ${label}`);
      }
      router.refresh();
    });
  };

  const openEdit = (d: DealRow) => {
    setEditing(d);
    setFormOpen(true);
  };

  const byStage = useMemo(() => {
    const m: Record<string, DealRow[]> = {};
    for (const s of DEAL_STAGES) m[s.value] = [];
    for (const d of optimistic) (m[d.stage] ??= []).push(d);
    return m;
  }, [optimistic]);

  const menu = (d: DealRow) => (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Deal actions"
        >
          <Ellipsis className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <DropdownItem
            icon={Pencil}
            onClick={() => {
              close();
              openEdit(d);
            }}
          >
            Edit deal
          </DropdownItem>
          {d.stage !== "LOST" && (
            <DropdownItem icon={ReceiptText} href={`/bookings/new?dealId=${d.id}`} onClick={close}>
              {d.stage === "WON" ? "Create booking & payment plan" : "Book this deal"}
            </DropdownItem>
          )}
          <div className="my-1 border-t border-slate-100" />
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Move to</p>
          {DEAL_STAGES.filter((s) => s.value !== d.stage).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                close();
                moveTo(d.id, s.value);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <span className={cn("size-2 rounded-full", s.dot)} />
              {s.label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <DropdownItem
            icon={Trash2}
            danger
            onClick={() => {
              close();
              setDeleting(d);
            }}
          >
            Delete deal
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );

  return (
    <>
      {optimistic.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Handshake}
            title="No deals yet"
            description="Create a deal when a lead starts negotiating on a property."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> New deal
              </Button>
            }
          />
        </div>
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="grid min-w-[1100px] grid-cols-5 gap-4">
            {DEAL_STAGES.map((stage) => {
              const items = byStage[stage.value] ?? [];
              const total = items.reduce((a, d) => a + d.value, 0);
              return (
                <div
                  key={stage.value}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overStage !== stage.value) setOverStage(stage.value);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragId;
                    setOverStage(null);
                    setDragId(null);
                    if (id) moveTo(id, stage.value);
                  }}
                  className={cn(
                    "flex min-h-[420px] flex-col rounded-xl border bg-slate-100/60 transition",
                    overStage === stage.value ? "border-brand-300 bg-brand-50/60 ring-4 ring-brand-500/10" : "border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between px-3 pb-2 pt-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", stage.dot)} />
                      <span className="text-[13px] font-semibold text-slate-800">{stage.label}</span>
                      <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{formatCompact(total, currency)}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-2">
                    {items.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", d.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(d.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        onClick={() => openEdit(d)}
                        className={cn(
                          "group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-card transition hover:border-slate-300 hover:shadow-pop active:cursor-grabbing",
                          dragId === d.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{d.title}</p>
                          <div onClick={(e) => e.stopPropagation()}>{menu(d)}</div>
                        </div>
                        <p className="mt-2 text-base font-semibold tracking-tight text-slate-900">{formatCompact(d.value, currency)}</p>
                        <p className="text-xs text-emerald-700">
                          {formatCompact(Math.round((d.value * d.commissionPct) / 100), currency)} commission
                        </p>
                        {d.propertyTitle && (
                          <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500">
                            <Building2 className="size-3.5 shrink-0" />
                            <span className="truncate">{d.propertyCode}</span>
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                          <Link
                            href={`/leads/${d.leadId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-brand-700"
                          >
                            <Avatar name={d.leadName} size="xs" />
                            <span className="truncate">{d.leadName}</span>
                          </Link>
                          {(d.stage === "WON" || d.stage === "LOST") && d.closedAt ? (
                            <span className="shrink-0 text-[11px] text-slate-400">{formatDate(d.closedAt)}</span>
                          ) : d.expectedCloseDate ? (
                            <span
                              className={cn(
                                "flex shrink-0 items-center gap-1 text-[11px]",
                                new Date(d.expectedCloseDate) < new Date() ? "font-medium text-rose-600" : "text-slate-400",
                              )}
                            >
                              <CalendarDays className="size-3" />
                              {formatDate(d.expectedCloseDate)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 py-8 text-xs text-slate-400">
                        Drop deals here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="table-th">Deal</th>
                  <th className="table-th">Lead</th>
                  <th className="table-th">Property</th>
                  <th className="table-th text-right">Value</th>
                  <th className="table-th text-right">Commission</th>
                  <th className="table-th">Stage</th>
                  <th className="table-th">Closing</th>
                  <th className="table-th">Owner</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {optimistic.map((d) => (
                  <tr key={d.id} className="transition hover:bg-slate-50/70">
                    <td className="table-td">
                      <button type="button" onClick={() => openEdit(d)} className="max-w-[260px] truncate text-left font-medium text-slate-900 hover:text-brand-700">
                        {d.title}
                      </button>
                    </td>
                    <td className="table-td">
                      <Link href={`/leads/${d.leadId}`} className="hover:text-brand-700">
                        {d.leadName}
                      </Link>
                    </td>
                    <td className="table-td">
                      {d.propertyId ? (
                        <Link href={`/properties/${d.propertyId}`} className="hover:text-brand-700">
                          {d.propertyCode}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="table-td text-right font-medium text-slate-900">{formatCompact(d.value, currency)}</td>
                    <td className="table-td text-right text-emerald-700">{formatCompact(Math.round((d.value * d.commissionPct) / 100), currency)}</td>
                    <td className="table-td">
                      <OptionBadge list={DEAL_STAGES} value={d.stage} withDot />
                    </td>
                    <td className="table-td">{formatDate(d.closedAt ?? d.expectedCloseDate)}</td>
                    <td className="table-td">
                      {d.agentName ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={d.agentName} size="xs" /> {d.agentName}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-td text-right">{menu(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DealFormModal
        open={formOpen}
        onClose={closeForm}
        leads={lists.leads}
        properties={lists.properties}
        users={lists.users}
        defaultCommission={defaultCommission}
        currency={currency}
        defaultLeadId={params.get("leadId") ?? undefined}
        defaultPropertyId={params.get("propertyId") ?? undefined}
        deal={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                value: editing.value,
                commissionPct: editing.commissionPct,
                stage: editing.stage,
                expectedCloseDate: editing.expectedCloseDate,
                notes: editing.notes,
                leadId: editing.leadId,
                propertyId: editing.propertyId,
                agentId: editing.agentId,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete deal?"
        description={deleting ? `"${deleting.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        action={() => deleteDeal(deleting!.id)}
        successMessage="Deal deleted"
      />
    </>
  );
}

export function NewDealButton() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Button
      onClick={() => {
        const next = new URLSearchParams(params.toString());
        next.delete("open");
        next.set("new", "1");
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <Plus /> New deal
    </Button>
  );
}
