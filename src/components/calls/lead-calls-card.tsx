import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/card";
import { OptionBadge } from "@/components/ui/badge";
import { CALL_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { CallDirectionIcon, PROVIDER_LABEL, RecordingPlayer, formatCallDuration } from "./call-meta";

/** Server component: a lead's call history with recordings. */
export async function LeadCallsCard({ leadId }: { leadId: string }) {
  const [calls, agg] = await Promise.all([
    db.callLog.findMany({ where: { leadId }, orderBy: { startedAt: "desc" }, take: 20, include: { user: { select: { name: true } } } }),
    db.callLog.aggregate({ where: { leadId }, _count: true, _sum: { durationSec: true } }),
  ]);

  return (
    <Card>
      <CardHeader
        title="Calls"
        description={agg._count ? `${agg._count} calls - ${formatCallDuration(agg._sum.durationSec ?? 0)} talk time` : "No calls yet"}
        action={
          agg._count > 20 ? (
            <Link href={`/calls?lead=${leadId}`} className="text-[13px] font-medium text-brand-600 hover:underline">
              View all
            </Link>
          ) : undefined
        }
      />
      {calls.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <PhoneCall className="size-5" />
          </span>
          <p className="text-sm text-slate-500">Calls made or logged for this lead appear here, with recordings.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {calls.map((c) => (
            <li key={c.id} className="flex gap-3 px-5 py-3">
              <CallDirectionIcon direction={c.direction} status={c.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <OptionBadge list={CALL_STATUSES} value={c.status} />
                  <span className="text-sm font-medium text-slate-800">{formatCallDuration(c.durationSec)}</span>
                  {c.outcome && <span className="text-sm text-slate-600">- {c.outcome}</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.user?.name ?? "Unassigned"} - {PROVIDER_LABEL[c.provider] ?? c.provider} - {formatDateTime(c.startedAt)}
                </p>
                {c.notes && <p className="mt-1 whitespace-pre-line text-[13px] text-slate-700">{c.notes}</p>}
                {c.recordingUrl && (
                  <div className="mt-2">
                    <RecordingPlayer callId={c.id} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
