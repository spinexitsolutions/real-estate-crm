import { DatabaseBackup, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button-styles";

/** Admin-only card: data export and backup guidance. */
export function BackupCard() {
  return (
    <Card>
      <CardHeader title="Data and backup" description="Download a copy of your CRM data at any time." action={<DatabaseBackup className="size-4 text-slate-400" />} />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" className={buttonClass("primary")}>
            <Download /> Download full backup (JSON)
          </a>
          <a href="/api/export/leads" className={buttonClass("secondary")}>
            <FileSpreadsheet /> Export leads CSV
          </a>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          The JSON backup contains team members, leads, properties, follow-ups, deals, activity, WhatsApp templates and messages. Password hashes and API secrets are never included.
        </p>
        <div className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="text-[13px] leading-relaxed text-slate-700">
            <p className="font-medium text-slate-900">Automatic database backups</p>
            <p className="mt-1">
              Supabase backs up your database automatically every day on the Pro plan and above (kept for 7 days on Pro). For restore to any second in time, enable
              Point-in-Time Recovery in the Supabase dashboard under <span className="font-medium">Project Settings, then Add-ons</span>. On the free plan, download a backup here regularly
              (for example weekly) and keep it somewhere safe.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
