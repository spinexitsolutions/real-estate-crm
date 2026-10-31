"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ChevronDown, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneOutgoing, Smartphone, Phone } from "lucide-react";
import { clickToCall, logCall } from "@/actions/calls";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CALL_OUTCOMES, CALL_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Lead = { id: string; name: string; phone: string };
type Variant = "primary" | "secondary" | "ghost" | "outline" | "success";

const LOGGABLE_STATUSES = CALL_STATUSES.filter((s) => ["ANSWERED", "NO_ANSWER", "BUSY", "MISSED", "FAILED"].includes(s.value));

export function CallButton({
  lead,
  clickToCallEnabled,
  variant = "secondary",
  size = "md",
  iconOnly,
}: {
  lead: Lead;
  clickToCallEnabled: boolean;
  variant?: Variant;
  size?: "sm" | "md" | "icon";
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const [pending, start] = useTransition();
  const awaitingReturn = useRef(false);

  // After dialing from the phone (tel:), prompt to log the call when the user comes back to the tab.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && awaitingReturn.current) {
        awaitingReturn.current = false;
        setLogOpen(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const dialFromPhone = () => {
    awaitingReturn.current = true;
    window.location.href = `tel:${lead.phone}`;
    // Desktop browsers may not leave the tab; still offer logging shortly after.
    setTimeout(() => {
      if (awaitingReturn.current && document.visibilityState === "visible") {
        awaitingReturn.current = false;
        setLogOpen(true);
      }
    }, 4000);
  };

  const viaProvider = () =>
    start(async () => {
      const res = await clickToCall(lead.id);
      if (res.error) return void toast.error(res.error);
      toast.success(`Calling via ${res.data?.provider}. Your phone will ring first, then ${lead.name} is connected.`);
      router.refresh();
    });

  const icon = iconOnly || size === "icon";
  const trigger = (onClick: () => void, withChevron: boolean) =>
    icon ? (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title={`Call ${lead.name}`}
        aria-label={`Call ${lead.name}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        <Phone className="size-4" />
      </button>
    ) : (
      <button type="button" onClick={onClick} disabled={pending} className={buttonClass(variant, size === "sm" ? "sm" : "md")}>
        <Phone /> Call
        {withChevron && <ChevronDown className="-mr-1 opacity-60" />}
      </button>
    );

  return (
    <>
      {clickToCallEnabled ? (
        <Dropdown trigger={({ toggle }) => trigger(toggle, true)} className="w-72">
          {(close) => (
            <>
              <DropdownItem
                icon={PhoneForwarded}
                onClick={() => {
                  close();
                  viaProvider();
                }}
              >
                <span className="flex flex-col">
                  <span className="font-medium">Call via cloud telephony</span>
                  <span className="text-xs text-slate-500">Rings your phone first, recorded automatically</span>
                </span>
              </DropdownItem>
              <DropdownItem
                icon={Smartphone}
                onClick={() => {
                  close();
                  dialFromPhone();
                }}
              >
                <span className="flex flex-col">
                  <span className="font-medium">Call from my phone</span>
                  <span className="text-xs text-slate-500">Dial directly, then log the outcome</span>
                </span>
              </DropdownItem>
              <DropdownItem
                icon={PhoneCall}
                onClick={() => {
                  close();
                  setLogOpen(true);
                }}
              >
                Log a call manually
              </DropdownItem>
            </>
          )}
        </Dropdown>
      ) : (
        trigger(dialFromPhone, false)
      )}
      <LogCallModal open={logOpen} onClose={() => setLogOpen(false)} lead={lead} />
    </>
  );
}

export function LogCallModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [direction, setDirection] = useState<"OUT" | "IN">("OUT");
  const [status, setStatus] = useState("ANSWERED");
  const [outcome, setOutcome] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDirection("OUT");
      setStatus("ANSWERED");
      setOutcome("");
      setMinutes("");
      setSeconds("");
      setNotes("");
    }
  }, [open]);

  const save = () =>
    start(async () => {
      const durationSec = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
      const res = await logCall(lead.id, { direction, status, durationSec, outcome: outcome || null, notes: notes || null });
      if (res.error) return void toast.error(res.error);
      toast.success("Call logged");
      onClose();
      router.refresh();
    });

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={`Log call with ${lead.name}`}
      description={lead.phone}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} loading={pending}>
            Save call
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: "OUT", label: "Outgoing", icon: PhoneOutgoing },
            { v: "IN", label: "Incoming", icon: PhoneIncoming },
          ] as const).map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => setDirection(d.v)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                direction === d.v ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10" : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              <d.icon className="size-4" /> {d.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Call status" className="sm:col-span-1">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={LOGGABLE_STATUSES} />
          </Field>
          <Field label="Duration (min)">
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="0" disabled={status !== "ANSWERED"} />
          </Field>
          <Field label="Seconds">
            <Input inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="0" disabled={status !== "ANSWERED"} />
          </Field>
        </div>

        <div>
          <p className="label">Outcome</p>
          <div className="flex flex-wrap gap-2">
            {CALL_OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(outcome === o ? "" : o)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                  outcome === o ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed? Next steps?" />
        </Field>

        <Link href={`/leads/${lead.id}`} onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline">
          <CalendarPlus className="size-4" /> Schedule the next follow-up from the lead page
        </Link>
      </div>
    </Modal>
  );
}
