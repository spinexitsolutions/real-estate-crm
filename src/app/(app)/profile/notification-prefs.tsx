"use client";

import { useState, useTransition } from "react";
import { BellRing, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { updateNotificationPrefs } from "@/actions/profile";
import { Card, CardHeader } from "@/components/ui/card";
import { PushToggle } from "@/components/notifications/push-toggle";
import { cn } from "@/lib/utils";

type Prefs = { notifyEmail: boolean; notifyPush: boolean; notifyWhatsApp: boolean };

export function NotificationPrefs({
  initial,
  channels,
}: {
  initial: Prefs;
  channels: { email: boolean; push: boolean; whatsapp: boolean; hasPhone: boolean };
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    start(async () => {
      const res = await updateNotificationPrefs(next);
      if (res.error) {
        setPrefs(prefs);
        toast.error(res.error);
      } else toast.success("Notification preferences saved");
    });
  };

  const rows: { key: keyof Prefs; icon: React.ComponentType<{ className?: string }>; title: string; text: string; available: boolean; unavailable: string }[] = [
    { key: "notifyPush", icon: BellRing, title: "Follow-up reminders (push)", text: "An alert about 15 minutes before each follow-up, and when a new lead is assigned to you.", available: channels.push, unavailable: "Push is not configured on the server yet." },
    { key: "notifyEmail", icon: Mail, title: "Daily email digest", text: "Every morning: today's follow-ups, overdue tasks and hot leads that need a call.", available: channels.email, unavailable: "Email (SMTP) is not configured by your administrator yet." },
    {
      key: "notifyWhatsApp",
      icon: MessageCircle,
      title: "Daily WhatsApp digest",
      text: "A short morning summary on your WhatsApp number.",
      available: channels.whatsapp && channels.hasPhone,
      unavailable: !channels.hasPhone ? "Add your phone number above to receive WhatsApp digests." : "WhatsApp digest template is not configured by your administrator yet.",
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader title="Notifications" description="Choose how you want to be reminded so no follow-up is missed" />
      <div className="space-y-4 p-6">
        <PushToggle />
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <r.icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <p className="text-[13px] text-slate-500">{r.text}</p>
                {!r.available && <p className="mt-1 text-xs font-medium text-amber-600">{r.unavailable}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[r.key]}
                aria-label={r.title}
                disabled={pending}
                onClick={() => toggle(r.key)}
                className={cn("relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60", prefs[r.key] ? "bg-brand-600" : "bg-slate-300")}
              >
                <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", prefs[r.key] ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
