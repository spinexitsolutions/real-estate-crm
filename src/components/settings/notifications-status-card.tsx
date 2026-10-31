import { BellRing, CircleCheck, CircleDashed, Clock, Mail } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { isEmailConfigured } from "@/lib/email";
import { isPushConfigured } from "@/lib/push";
import { cn } from "@/lib/utils";
import { TestNotificationButton } from "./test-notification-button";

/** Admin view of which reminder channels are configured on the server. */
export function NotificationsStatusCard() {
  const items = [
    {
      icon: BellRing,
      title: "Push notifications",
      ok: isPushConfigured(),
      text: "Reminders on desktop and mobile before every follow-up.",
      env: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
      hint: "Generate keys with: npm run vapid",
    },
    {
      icon: Mail,
      title: "Email (SMTP)",
      ok: isEmailConfigured(),
      text: "Daily digest emails and password reset links.",
      env: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"],
      hint: "Works with Gmail (app password), Zoho, Brevo, Resend SMTP and others.",
    },
    {
      icon: Clock,
      title: "Scheduled reminders (cron)",
      ok: !!process.env.CRON_SECRET,
      text: "Runs every 5 minutes to send follow-up reminders and the 8 AM digest.",
      env: ["CRON_SECRET"],
      hint: "Then schedule it with Supabase pg_cron using docs/SUPABASE_CRON.sql.",
    },
  ];
  return (
    <Card>
      <CardHeader title="Reminders and notifications" description="Server channels used to remind your team about follow-ups" action={<TestNotificationButton disabled={!items[0].ok && !items[1].ok} />} />
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.title} className="flex gap-4 px-5 py-4">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", it.ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
              <it.icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{it.title}</p>
                {it.ok ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <CircleCheck className="size-3.5" /> Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    <CircleDashed className="size-3.5" /> Not configured
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">{it.text}</p>
              {!it.ok && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p>
                    Set environment variables:{" "}
                    {it.env.map((e, i) => (
                      <span key={e}>
                        <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200">{e}</code>
                        {i < it.env.length - 1 ? " " : ""}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-slate-500">{it.hint}</p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Even without these, reminders pop up inside the CRM while it is open in a browser tab.
      </p>
    </Card>
  );
}
