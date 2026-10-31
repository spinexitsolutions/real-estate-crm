import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Follow-ups of the current user that are due within the next 10 minutes or became due in the last 10. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });
  const now = Date.now();
  const items = await db.followUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { gte: new Date(now - 10 * 60000), lte: new Date(now + 10 * 60000) },
      OR: [{ assignedToId: user.id }, { assignedToId: null, lead: { assignedToId: user.id } }],
    },
    orderBy: { dueAt: "asc" },
    take: 10,
    select: { id: true, title: true, type: true, dueAt: true, leadId: true, lead: { select: { name: true } } },
  });
  return NextResponse.json({
    items: items.map((f) => ({ id: f.id, title: f.title, type: f.type, dueAt: f.dueAt.toISOString(), leadId: f.leadId, leadName: f.lead.name })),
  });
}
