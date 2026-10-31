"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  Handshake,
  Mail,
  MessageSquareText,
  Phone,
  PhoneCall,
  SquarePen,
  StickyNote,
  Trash2,
  Users,
  Ellipsis,
  Heart,
  HeartOff,
} from "lucide-react";
import { addLeadNote, assignLead, deleteActivity, deleteLead, updateLeadStatus } from "@/actions/leads";
import { toggleShortlist } from "@/actions/properties";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FollowUpFormModal } from "@/components/followups/followup-form";
import { DealFormModal } from "@/components/deals/deal-form";
import { LEAD_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LeadFormModal, type LeadFormValues } from "./lead-form";
import { CallButton } from "@/components/calls/call-button";
import { LOST_REASONS } from "./leads-board";

type Opt = { id: string; name: string };
type PropOpt = { id: string; title: string; code: string; price: number };

export function LeadHeaderActions({
  lead,
  users,
  properties,
  leadsForDeal,
  canManage,
  currentUserId,
  defaultCommission,
  currency,
  clickToCallEnabled,
}: {
  lead: LeadFormValues;
  users: Opt[];
  properties: PropOpt[];
  leadsForDeal: { id: string; name: string; phone: string }[];
  canManage: boolean;
  currentUserId: string;
  defaultCommission: number;
  currency: string;
  clickToCallEnabled: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"edit" | "followup" | "deal" | "delete" | null>(null);
  return (
    <>
      <CallButton lead={{ id: lead.id, name: lead.name, phone: lead.phone }} clickToCallEnabled={clickToCallEnabled} />
      {lead.email && (
        <a href={`mailto:${lead.email}`} title="Send email" className={buttonClass("secondary", "icon")}>
          <Mail />
        </a>
      )}
      <Button variant="secondary" onClick={() => setModal("followup")}>
        <CalendarPlus /> Follow-up
      </Button>
      <Button onClick={() => setModal("deal")}>
        <Handshake /> Create deal
      </Button>
      <Dropdown
        trigger={({ toggle }) => (
          <Button variant="secondary" size="icon" onClick={toggle} aria-label="More">
            <Ellipsis />
          </Button>
        )}
      >
        {(close) => (
          <>
            <DropdownItem
              icon={SquarePen}
              onClick={() => {
                close();
                setModal("edit");
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
                  setModal("delete");
                }}
              >
                Delete lead
              </DropdownItem>
            )}
          </>
        )}
      </Dropdown>

      {modal === "edit" && <LeadFormModal open onClose={() => setModal(null)} users={users} lead={lead} canAssign={canManage} currentUserId={currentUserId} />}
      {modal === "followup" && (
        <FollowUpFormModal open onClose={() => setModal(null)} leadId={lead.id} users={users} properties={properties.map((p) => ({ id: p.id, title: p.title, code: p.code }))} />
      )}
      {modal === "deal" && (
        <DealFormModal open onClose={() => setModal(null)} leads={leadsForDeal} properties={properties} users={users} defaultLeadId={lead.id} defaultCommission={defaultCommission} currency={currency} />
      )}
      <ConfirmDialog
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Delete this lead?"
        description={`${lead.name} and all related follow-ups, notes and deals will be permanently deleted.`}
        action={async () => {
          const r = await deleteLead(lead.id, "/leads");
          router.refresh();
          return r;
        }}
      />
    </>
  );
}

export function StatusStepper({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(status);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");
  const steps = LEAD_STATUSES.filter((s) => s.value !== "LOST");
  const idx = steps.findIndex((s) => s.value === current);
  const lost = current === "LOST";

  const change = (value: string, lostReason?: string) => {
    const prev = current;
    setCurrent(value);
    start(async () => {
      const res = await updateLeadStatus(leadId, value, lostReason);
      if (res.error) {
        setCurrent(prev);
        toast.error(res.error);
      } else {
        toast.success(`Status updated to ${LEAD_STATUSES.find((s) => s.value === value)?.label}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
      <div className="flex flex-1 overflow-x-auto">
        {steps.map((s, i) => {
          const done = !lost && i < idx;
          const active = !lost && i === idx;
          return (
            <button
              key={s.value}
              disabled={pending}
              onClick={() => change(s.value)}
              className={cn(
                "relative flex min-w-28 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium transition first:rounded-l-lg last:rounded-r-lg",
                active ? (s.value === "WON" ? "bg-emerald-600 text-white" : "bg-brand-600 text-white") : done ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                i > 0 && "ml-0.5",
              )}
            >
              {done && <Check className="size-3.5" />}
              {s.label}
            </button>
          );
        })}
      </div>
      <Button
        variant={lost ? "danger" : "secondary"}
        size="sm"
        className={cn("h-9", !lost && "text-rose-600")}
        disabled={pending}
        onClick={() => (lost ? change("CONTACTED") : (setReason(""), setLostOpen(true)))}
      >
        {lost ? "Lost - Reopen lead" : "Mark as lost"}
      </Button>
      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        size="sm"
        title="Mark lead as lost"
        description="Capturing the reason helps improve your conversion."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                change("LOST", reason || "Not specified");
                setLostOpen(false);
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
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

const NOTE_TYPES = [
  { value: "NOTE", label: "Note", icon: StickyNote },
  { value: "CALL", label: "Log call", icon: PhoneCall },
  { value: "MEETING", label: "Log meeting", icon: Users },
  { value: "EMAIL", label: "Log email", icon: Mail },
];

export function NoteComposer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [type, setType] = useState("NOTE");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-slate-200 bg-white focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2">
        {NOTE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-[13px] font-medium transition",
              type === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === "NOTE" ? "Add a note about this lead..." : type === "CALL" ? "What was discussed on the call?" : type === "MEETING" ? "Meeting summary..." : "Email summary..."}
        className="min-h-20 border-0 shadow-none focus:ring-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) document.getElementById("note-save")?.click();
        }}
      />
      <div className="flex items-center justify-between px-3 pb-3">
        <span className="text-xs text-slate-400">Ctrl + Enter to save</span>
        <Button
          id="note-save"
          size="sm"
          loading={pending}
          disabled={!content.trim()}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("content", content);
              fd.set("type", type);
              const res = await addLeadNote(leadId, fd);
              if (res.error) return void toast.error(res.error);
              setContent("");
              toast.success(type === "NOTE" ? "Note added" : "Activity logged");
              router.refresh();
            })
          }
        >
          <MessageSquareText /> Save
        </Button>
      </div>
    </div>
  );
}

export function DeleteActivityButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete">
        <Trash2 className="size-3.5" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this entry?"
        successMessage="Deleted"
        action={async () => {
          const r = await deleteActivity(id);
          router.refresh();
          return r;
        }}
      />
    </>
  );
}

export function AssignSelect({ leadId, value, users }: { leadId: string; value: string | null; users: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      disabled={pending}
      value={value ?? ""}
      options={users.map((u) => ({ value: u.id, label: u.name }))}
      placeholder="Unassigned"
      className="h-9"
      onChange={(e) =>
        start(async () => {
          const res = await assignLead(leadId, e.target.value || null);
          if (res.error) return void toast.error(res.error);
          toast.success("Lead reassigned");
          router.refresh();
        })
      }
    />
  );
}

export function ShortlistButton({ leadId, propertyId, shortlisted }: { leadId: string; propertyId: string; shortlisted: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleShortlist(leadId, propertyId);
          if (res.error) return void toast.error(res.error);
          toast.success(shortlisted ? "Removed from shortlist" : "Added to shortlist");
          router.refresh();
        })
      }
      title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={cn(
        "rounded-lg p-1.5 transition disabled:opacity-50",
        shortlisted ? "text-rose-500 hover:bg-rose-50" : "text-slate-400 hover:bg-slate-100 hover:text-brand-600",
      )}
    >
      {shortlisted ? <HeartOff className="size-4" /> : <Heart className="size-4" />}
    </button>
  );
}
