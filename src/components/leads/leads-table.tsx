"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, Eye, Phone, SquarePen, Trash2, UserPlus, Flag, ListChecks, X, Users } from "lucide-react";
import { bulkLeadAction, deleteLead } from "@/actions/leads";
import { Avatar } from "@/components/ui/avatar";
import { OptionBadge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmAction, ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/card";
import { SendWhatsAppButton } from "@/components/whatsapp/send-whatsapp";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatBudget, formatRelative } from "@/lib/format";
import { scoreTone } from "@/lib/lead-score";
import { cn } from "@/lib/utils";
import { LeadFormModal, type LeadFormValues } from "./lead-form";

export type LeadRow = LeadFormValues & {
  score: number;
  createdAt: string;
  lastContactedAt: string | null;
  assignedTo: { id: string; name: string } | null;
  nextFollowUp: string | null;
};

export function LeadsTable({
  leads,
  users,
  canManage,
  currentUserId,
  currency,
}: {
  leads: LeadRow[];
  users: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
  currency: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<LeadFormValues | null>(null);
  const [deleting, setDeleting] = useState<LeadRow | null>(null);
  const [pending, start] = useTransition();

  const allChecked = leads.length > 0 && selected.length === leads.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const runBulk = (action: Parameters<typeof bulkLeadAction>[1], label: string) =>
    start(async () => {
      const res = await bulkLeadAction(selected, action);
      if (res.error) return void toast.error(res.error);
      toast.success(`${label}: ${res.data?.count ?? 0} lead(s)`);
      setSelected([]);
      router.refresh();
    });

  if (!leads.length)
    return <EmptyState icon={Users} title="No leads found" description="Try adjusting filters, or add your first lead to get started." />;

  return (
    <>
      {selected.length > 0 && (
        <div className="animate-fade-in flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/70 px-4 py-2.5">
          <span className="mr-2 text-sm font-medium text-brand-800">{selected.length} selected</span>
          <BulkMenu label="Change status" icon={ListChecks} disabled={pending} items={LEAD_STATUSES.map((s) => ({ label: s.label, onClick: () => runBulk({ type: "status", value: s.value }, "Status updated") }))} />
          <BulkMenu label="Set priority" icon={Flag} disabled={pending} items={PRIORITIES.map((s) => ({ label: s.label, onClick: () => runBulk({ type: "priority", value: s.value }, "Priority updated") }))} />
          {canManage && (
            <BulkMenu
              label="Assign to"
              icon={UserPlus}
              disabled={pending}
              items={[...users.map((u) => ({ label: u.name, onClick: () => runBulk({ type: "assign", value: u.id }, "Assigned") })), { label: "Unassign", onClick: () => runBulk({ type: "assign", value: null }, "Unassigned") }]}
            />
          )}
          {canManage && (
            <ConfirmAction
              title={`Delete ${selected.length} lead(s)?`}
              description="All follow-ups, notes and deals linked to these leads will also be deleted."
              action={async () => {
                const res = await bulkLeadAction(selected, { type: "delete" });
                if (!res.error) {
                  toast.success(`Deleted ${res.data?.count ?? 0} lead(s)`);
                  setSelected([]);
                  router.refresh();
                }
                return res;
              }}
            >
              {(open) => (
                <button onClick={open} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50">
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </ConfirmAction>
          )}
          <button onClick={() => setSelected([])} className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-700">
            <X className="size-4" /> Clear selection
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : leads.map((l) => l.id))} className="size-4 rounded border-slate-300 accent-brand-600" aria-label="Select all" />
              </th>
              <th className="table-th">Lead</th>
              <th className="table-th">Status</th>
              <th className="table-th">Requirement</th>
              <th className="table-th">Budget</th>
              <th className="table-th hidden 2xl:table-cell">Source</th>
              <th className="table-th">Score</th>
              <th className="table-th">Assigned</th>
              <th className="table-th">Next follow-up</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {leads.map((l) => {
              const tone = scoreTone(l.score);
              const overdue = l.nextFollowUp && new Date(l.nextFollowUp) < new Date();
              return (
                <tr key={l.id} className={cn("group transition hover:bg-slate-50/70", selected.includes(l.id) && "bg-brand-50/40")}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} className="size-4 rounded border-slate-300 accent-brand-600" aria-label={`Select ${l.name}`} />
                  </td>
                  <td className="table-td">
                    <Link href={`/leads/${l.id}`} className="flex items-center gap-3">
                      <Avatar name={l.name} size="md" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 group-hover:text-brand-700">{l.name}</span>
                          <span className={cn("size-1.5 rounded-full", PRIORITIES.find((p) => p.value === l.priority)?.dot)} title={`${labelOf(PRIORITIES, l.priority)} priority`} />
                        </span>
                        <span className="block text-xs text-slate-500">{l.phone}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="table-td">
                    <OptionBadge list={LEAD_STATUSES} value={l.status} withDot />
                  </td>
                  <td className="table-td">
                    <p className="text-slate-800">
                      {[l.bedrooms ? `${l.bedrooms} BHK` : null, l.propertyType ? labelOf(PROPERTY_TYPES, l.propertyType) : null].filter(Boolean).join(" ") || "Any property"}
                    </p>
                    <p className="max-w-48 truncate text-xs text-slate-500">{l.preferredLocation || "Any location"}</p>
                  </td>
                  <td className="table-td font-medium text-slate-800">{formatBudget(l.budgetMin, l.budgetMax, currency)}</td>
                  <td className="table-td hidden text-slate-600 2xl:table-cell">{labelOf(LEAD_SOURCES, l.source)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${l.score}%` }} />
                      </div>
                      <span className={cn("text-xs font-semibold", tone.text)}>{l.score}</span>
                    </div>
                  </td>
                  <td className="table-td">
                    {l.assignedTo ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={l.assignedTo.name} size="xs" />
                        <span className="text-slate-700">{l.assignedTo.name.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="table-td">
                    {l.nextFollowUp ? (
                      <span className={cn("text-[13px]", overdue ? "font-medium text-rose-600" : "text-slate-600")}>{formatRelative(l.nextFollowUp)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">None scheduled</span>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`tel:${l.phone}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Call">
                        <Phone className="size-4" />
                      </a>
                      <SendWhatsAppButton lead={{ id: l.id, name: l.name, phone: l.phone }} iconOnly variant="ghost" size="icon" />
                      <Dropdown
                        trigger={({ toggle }) => (
                          <button onClick={toggle} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="More actions">
                            <Ellipsis className="size-4" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <DropdownItem icon={Eye} href={`/leads/${l.id}`}>
                              View details
                            </DropdownItem>
                            <DropdownItem
                              icon={SquarePen}
                              onClick={() => {
                                close();
                                setEditing(l);
                              }}
                            >
                              Edit lead
                            </DropdownItem>
                            {canManage && (
                              <DropdownItem
                                icon={Trash2}
                                danger
                                onClick={() => {
                                  close();
                                  setDeleting(l);
                                }}
                              >
                                Delete
                              </DropdownItem>
                            )}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this lead?"
        description={`${deleting?.name ?? "This lead"} and all related follow-ups, notes and deals will be permanently deleted.`}
        successMessage="Lead deleted"
        action={async () => {
          const r = await deleteLead(deleting!.id);
          router.refresh();
          return r;
        }}
      />
      {editing && <LeadFormModal open onClose={() => setEditing(null)} users={users} lead={editing} canAssign={canManage} currentUserId={currentUserId} />}
    </>
  );
}

function BulkMenu({ label, icon: Icon, items, disabled }: { label: string; icon: React.ComponentType<{ className?: string }>; items: { label: string; onClick: () => void }[]; disabled?: boolean }) {
  return (
    <Dropdown
      align="left"
      className="max-h-72 overflow-y-auto"
      trigger={({ toggle }) => (
        <button disabled={disabled} onClick={toggle} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Icon className="size-4 text-slate-500" /> {label}
        </button>
      )}
    >
      {(close) =>
        items.map((it) => (
          <DropdownItem
            key={it.label}
            onClick={() => {
              close();
              it.onClick();
            }}
          >
            {it.label}
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
}
