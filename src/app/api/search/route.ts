import { NextResponse } from "next/server";
import { getCurrentUser, leadScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCompact } from "@/lib/format";
import { labelOf, LEAD_STATUSES, DEAL_STAGES } from "@/lib/constants";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const [leads, properties, deals] = await Promise.all([
    db.lead.findMany({
      where: {
        ...leadScope(user),
        OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { preferredLocation: { contains: q } }],
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    db.property.findMany({
      where: { OR: [{ title: { contains: q } }, { code: { contains: q } }, { city: { contains: q } }, { locality: { contains: q } }] },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    db.deal.findMany({
      where: {
        title: { contains: q },
        ...(user.role === "AGENT" ? { agentId: user.id } : {}),
      },
      take: 4,
    }),
  ]);

  return NextResponse.json({
    results: [
      ...leads.map((l) => ({ id: l.id, type: "lead", title: l.name, subtitle: `${l.phone} - ${labelOf(LEAD_STATUSES, l.status)}`, href: `/leads/${l.id}` })),
      ...properties.map((p) => ({
        id: p.id,
        type: "property",
        title: p.title,
        subtitle: `${p.code} - ${[p.locality, p.city].filter(Boolean).join(", ")} - ${formatCompact(p.price)}`,
        href: `/properties/${p.id}`,
      })),
      ...deals.map((d) => ({ id: d.id, type: "deal", title: d.title, subtitle: `${labelOf(DEAL_STAGES, d.stage)} - ${formatCompact(d.value)}`, href: `/deals?open=${d.id}` })),
    ],
  });
}
