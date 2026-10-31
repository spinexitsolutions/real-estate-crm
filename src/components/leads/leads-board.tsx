"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, GripVertical, MapPin } from "lucide-react";
import { updateLeadStatus } from "@/actions/leads";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import { formatBudget, formatCompact, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BoardLead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  priority: string;
  preferredLocation: string | null;
  bedrooms: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  assignedTo: { name: string } | null;
  nextFollowUp: string | null;
  score: number;
};

const LOST_REASONS = ["Budget mismatch", "Bought elsewhere", "Not responding", "Location not suitable", "Postponed plan", "Loan rejected"];

export function LeadsBoard({ leads: initial, currency }: { leads: BoardLead[]; currency: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [, start] = useTransition();

  useEffect(() => setLeads(initial), [initial]);

  const move = (id: string, status: string, lostReason?: string) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    start(async () => {
      const res = await updateLeadStatus(id, status, lostReason);
      if (res.error) {
        setLeads(prev);
        toast.error(res.error);
      } else {
        toast.success(`Moved to ${LEAD_STATUSES.find((s) => s.value === status)?.label}`);
        router.refresh();
      }
    });
  };

  const onDrop = (status: string) => {
    setOver(null);
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.status === status) return;
    if (status === "LOST") {
      setLostFor(lead.id);
      setReason("");
      return;
    }
    move(lead.id, status);
  };

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-4">
          {LEAD_STATUSES.map((col) => {
            const items = leads.filter((l) => l.status === col.value);
            const total = items.reduce((s, l) => s + (l.budgetMax ?? 0), 0);
            return (
              <div
                key={col.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.value);
                }}
                onDragLeave={() => setOver((o) => (o === col.value ? null : o))}
                onDrop={() => onDrop(col.value)}
                className={cn("flex w-[290px] shrink-0 flex-col rounded-xl border bg-slate-100/60 transition", over === col.value ? "border-brand-300 bg-brand-50/60" : "border-transparent")}
              >
                <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", col.dot)} />
                    <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-xs">{items.length}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{total ? formatCompact(total, currency) : ""}</span>
                </div>
                <div className="flex max-h-[calc(100vh-280px)] min-h-32 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
                  {items.map((l) => {
                    const pr = PRIORITIES.find((p) => p.value === l.priority);
                    const overdue = l.nextFollowUp && new Date(l.nextFollowUp) < new Date();
                    return (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(l.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragId(null)}
                        className={cn("group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-card transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing", dragId === l.id && "opacity-50")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/leads/${l.id}`} className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">{l.name}</p>
                            <p className="text-xs text-slate-500">{l.phone}</p>
                          </Link>
                          <GripVertical className="size-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
                        </div>
                        <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">
                            {formatBudget(l.budgetMin, l.budgetMax, currency)}
                            {l.bedrooms ? <span className="font-normal text-slate-500"> - {l.bedrooms} BHK</span> : null}
                          </p>
                          {l.preferredLocation && (
                            <p className="flex items-center gap-1 truncate">
                              <MapPin className="size-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">{l.preferredLocation}</span>
                            </p>
                          )}
                          {l.nextFollowUp && (
                            <p className={cn("flex items-center gap-1", overdue ? "font-medium text-rose-600" : "")}>
                              <CalendarClock className="size-3.5 shrink-0" />
                              {formatRelative(l.nextFollowUp)}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", pr?.color)}>
                            <span className={cn("size-1.5 rounded-full", pr?.dot)} />
                            {pr?.label}
                          </span>
                          {l.assignedTo ? <Avatar name={l.assignedTo.name} size="xs" /> : <span className="text-[11px] text-slate-400">Unassigned</span>}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400">Drop leads here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!lostFor}
        onClose={() => setLostFor(null)}
        size="sm"
        title="Mark lead as lost"
        description="Capturing the reason helps improve your conversion."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostFor(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (lostFor) move(lostFor, "LOST", reason || "Not specified");
                setLostFor(null);
              }}
            >
              Mark as lost
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn("rounded-full border px-3 py-1.5 text-[13px] font-medium transition", reason === r ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Or type a reason" className="mt-4">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        </Field>
      </Modal>
    </>
  );
}

export { LOST_REASONS };
