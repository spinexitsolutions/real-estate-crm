import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatCallDuration(sec: number) {
  if (!sec) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function CallDirectionIcon({ direction, status, className }: { direction: string; status: string; className?: string }) {
  const missed = ["MISSED", "NO_ANSWER", "BUSY", "FAILED"].includes(status);
  const Icon = direction === "IN" ? (missed ? PhoneMissed : PhoneIncoming) : PhoneOutgoing;
  return (
    <span
      title={`${direction === "IN" ? "Incoming" : "Outgoing"} call`}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        missed ? "bg-rose-50 text-rose-600" : direction === "IN" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function RecordingPlayer({ callId, compact }: { callId: string; compact?: boolean }) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio controls preload="none" src={`/api/calls/${callId}/recording`} className={cn("h-8", compact ? "w-52" : "w-full max-w-xs")}>
      Your browser does not support audio playback.
    </audio>
  );
}

export const PROVIDER_LABEL: Record<string, string> = { MANUAL: "Logged", EXOTEL: "Exotel", KNOWLARITY: "Knowlarity" };
