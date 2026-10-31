import { CalendarCheck, Car, Ellipsis, Mail, Phone, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  MEETING: Users,
  SITE_VISIT: Car,
  WHATSAPP: WhatsAppIcon,
  EMAIL: Mail,
  OTHER: Ellipsis,
};

export const TYPE_TONES: Record<string, string> = {
  CALL: "bg-sky-50 text-sky-600",
  MEETING: "bg-violet-50 text-violet-600",
  SITE_VISIT: "bg-amber-50 text-amber-600",
  WHATSAPP: "bg-emerald-50 text-emerald-600",
  EMAIL: "bg-indigo-50 text-indigo-600",
  OTHER: "bg-slate-100 text-slate-600",
};

export function FollowUpTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? CalendarCheck;
  return <Icon className={className} />;
}

export function FollowUpTypeBadge({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TYPE_TONES[type] ?? TYPE_TONES.OTHER, className)}>
      <FollowUpTypeIcon type={type} className="size-4" />
    </span>
  );
}
