"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addDays, addHours, setHours, setMinutes } from "date-fns";
import { appNow } from "@/lib/timezone";
import { Ban, Building2, CalendarClock, Clock, Ellipsis, Pencil, Phone, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge, OptionBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/card";
import { FOLLOWUP_PRIORITIES, labelOf, FOLLOWUP_TYPES } from "@/lib/constants";
import { formatDateTime, formatDueLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cancelFollowUp, deleteFollowUp, rescheduleFollowUp } from "@/actions/followups";
import { SendWhatsAppButton } from "@/components/whatsapp/send-whatsapp";
import { CompleteFollowUpButton } from "./complete-followup";
import { FollowUpFormModal } from "./followup-form";
import { FollowUpTypeBadge } from "./followup-icon";

export type FollowUpItem = {
  id: string;
  title: string;
  type: string;
  dueAt: string;
  status: string;
  priority: string;
  notes: string | null;
  outcome: string | null;
  completedAt: string | null;
  leadId: string;
  lead: { id: string; name: string; phone: string };
  propertyId: string | null;
  property: { id: string; title: string; code: string } | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
};

type Common = {
  users: { id: string; name: string }[];
  properties: { id: string; title: string; code: string }[];
};

export function FollowUpList({ items, users, properties, showLead = true }: { items: FollowUpItem[]; showLead?: boolean } & Common) {
  if (items.length === 0) {
    return <EmptyState icon={CalendarClock} title="No follow-ups" description="Scheduled calls, meetings and site visits will show up here." />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((f) => (
        <li key={f.id}>
          <FollowUpRow item={f} users={users} properties={properties} showLead={showLead} />
        </li>
      ))}
    </ul>
  );
}

function rescheduleOptions() {
  const now = appNow();
  return [
    { label: "In 1 hour", value: addHours(now, 1) },
    { label: "Tomorrow, 10 AM", value: setMinutes(setHours(addDays(now, 1), 10), 0) },
    { label: "In 3 days", value: setMinutes(setHours(addDays(now, 3), 11), 0) },
    { label: "Next week", value: setMinutes(setHours(addDays(now, 7), 11), 0) },
  ];
}

export function FollowUpRow({ item: f, users, properties, showLead = true }: { item: FollowUpItem; showLead?: boolean } & Common) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();
  const pendingStatus = f.status === "PENDING";
  const overdue = pendingStatus && new Date(f.dueAt) < new Date();

  const reschedule = (d: Date) =>
    start(async () => {
      const res = await rescheduleFollowUp(f.id, d.toISOString());
      if (res.error) toast.error(res.error);
      else toast.success(`Rescheduled to ${formatDueLabel(d)}`);
    });

  return (
    <div className={cn("group flex items-start gap-3.5 px-5 py-4 transition hover:bg-slate-50/70", pending && "opacity-60")}>
      <FollowUpTypeBadge type={f.type} className={cn(!pendingStatus && "opacity-60")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-medium text-slate-900", f.status !== "PENDING" && "text-slate-500 line-through decoration-slate-300")}>{f.title}</p>
          {pendingStatus && f.priority === "HIGH" && <OptionBadge list={FOLLOWUP_PRIORITIES} value={f.priority} />}
          {f.status === "COMPLETED" && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Done</Badge>}
          {f.status === "CANCELLED" && <Badge className="bg-slate-100 text-slate-500 ring-slate-500/20">Cancelled</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className={cn("inline-flex items-center gap-1 font-medium", overdue ? "text-rose-600" : pendingStatus ? "text-slate-700" : "text-slate-500")}>
            <Clock className="size-3.5" />
            {overdue && "Overdue - "}
            {f.status === "COMPLETED" && f.completedAt ? `Done ${formatDateTime(f.completedAt)}` : formatDueLabel(f.dueAt)}
          </span>
          <span>{labelOf(FOLLOWUP_TYPES, f.type)}</span>
          {showLead && (
            <Link href={`/leads/${f.lead.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
              <UserRound className="size-3.5" />
              {f.lead.name}
            </Link>
          )}
          {f.property && (
            <Link href={`/properties/${f.property.id}`} className="inline-flex items-center gap-1 hover:text-slate-700">
              <Building2 className="size-3.5" />
              {f.property.code}
            </Link>
          )}
          {f.assignedTo && <span>Assigned to {f.assignedTo.name}</span>}
        </div>
        {(f.outcome || f.notes) && (
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
            {f.outcome && <span className="font-medium text-slate-700">{f.outcome}. </span>}
            {f.notes}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {pendingStatus && (
          <>
            <a
              href={`tel:${f.lead.phone}`}
              title={`Call ${f.lead.phone}`}
              className="hidden size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 sm:flex"
            >
              <Phone className="size-4" />
            </a>
            <span className="hidden sm:inline-flex">
              <SendWhatsAppButton lead={f.lead} property={undefined} followUpDate={formatDateTime(f.dueAt)} size="icon" iconOnly variant="secondary" />
            </span>
            <CompleteFollowUpButton id={f.id} leadName={f.lead.name} size="icon" />
          </>
        )}
            <Dropdown
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="More actions">
                  <Ellipsis className="size-4" />
                </button>
              )}
            >
              {(close) => (
                <>
                  {pendingStatus && (
                    <>
                      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Snooze to</p>
                      {rescheduleOptions().map((o) => (
                        <DropdownItem
                          key={o.label}
                          icon={CalendarClock}
                          onClick={() => {
                            close();
                            reschedule(o.value);
                          }}
                        >
                          {o.label}
                        </DropdownItem>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                    </>
                  )}
                  <DropdownItem
                    icon={Pencil}
                    onClick={() => {
                      close();
                      setEditing(true);
                    }}
                  >
                    Edit
                  </DropdownItem>
                  {pendingStatus && (
                    <DropdownItem
                      icon={Ban}
                      onClick={() => {
                        close();
                        start(async () => {
                          const res = await cancelFollowUp(f.id);
                          if (res.error) toast.error(res.error);
                          else toast.success("Follow-up cancelled");
                        });
                      }}
                    >
                      Cancel follow-up
                    </DropdownItem>
                  )}
                  <DropdownItem
                    icon={Trash2}
                    danger
                    onClick={() => {
                      close();
                      setDeleting(true);
                    }}
                  >
                    Delete
                  </DropdownItem>
                </>
              )}
            </Dropdown>
      </div>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete follow-up?"
        description={`"${f.title}" will be permanently removed.`}
        action={() => deleteFollowUp(f.id)}
        successMessage="Follow-up deleted"
      />
      {editing && (
        <FollowUpFormModal
          open={editing}
          onClose={() => setEditing(false)}
          leadId={f.leadId}
          users={users}
          properties={properties}
          followUp={{
            id: f.id,
            title: f.title,
            type: f.type,
            dueAt: f.dueAt,
            priority: f.priority,
            notes: f.notes,
            leadId: f.leadId,
            propertyId: f.propertyId,
            assignedToId: f.assignedToId,
          }}
        />
      )}
    </div>
  );
}
