import Link from "next/link";
import { MapPinCheck } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { formatDistance, mapsLink } from "@/lib/geo";
import { cn } from "@/lib/utils";

/** Server component: site visit check-ins recorded for a lead. */
export async function LeadCheckInsCard({ leadId }: { leadId: string }) {
  const items = await db.siteVisitCheckIn.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } }, property: { select: { id: true, title: true, code: true } } },
  });
  return (
    <Card>
      <CardHeader title="Site visits" description={items.length ? `${items.length} location check-ins` : "No check-ins yet"} />
      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">Agents can check in from a site visit follow-up to record their location.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <CheckInRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CheckInRow({
  c,
  showLead,
}: {
  c: {
    id: string;
    latitude: number;
    longitude: number;
    distanceM: number | null;
    notes: string | null;
    createdAt: Date;
    user: { name: string } | null;
    property: { id: string; title: string; code: string } | null;
    lead?: { id: string; name: string } | null;
  };
  showLead?: boolean;
}) {
  const far = c.distanceM !== null && c.distanceM > 500;
  return (
    <li className="flex gap-3 px-5 py-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", far ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
        <MapPinCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-slate-800">
          {showLead && c.lead ? (
            <>
              <Link href={`/leads/${c.lead.id}`} className="font-medium hover:text-brand-700">
                {c.lead.name}
              </Link>
              {" - "}
            </>
          ) : null}
          {c.property ? (
            <Link href={`/properties/${c.property.id}`} className="font-medium hover:text-brand-700">
              {c.property.title}
            </Link>
          ) : (
            <span className="font-medium">Site visit</span>
          )}
          {c.distanceM !== null && (
            <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium", far ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
              {formatDistance(c.distanceM)} from site
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {c.user?.name ?? "Unknown"} - {formatDateTime(c.createdAt)} -{" "}
          <a href={mapsLink(c.latitude, c.longitude)} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
            Map
          </a>
        </p>
        {c.notes && <p className="mt-1 whitespace-pre-line text-[13px] text-slate-600">{c.notes}</p>}
      </div>
    </li>
  );
}
