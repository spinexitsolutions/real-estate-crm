import { NextResponse } from "next/server";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can download backups." }, { status: 403 });

  const [users, settings, leads, properties, leadProperties, followUps, deals, activities, templates, messages] = await Promise.all([
    db.user.findMany({ omit: { password: true }, orderBy: { createdAt: "asc" } }),
    db.settings.findUnique({ where: { id: 1 }, omit: { waAccessToken: true, waAppSecret: true } }),
    db.lead.findMany({ orderBy: { createdAt: "asc" } }),
    db.property.findMany({ orderBy: { createdAt: "asc" } }),
    db.leadProperty.findMany(),
    db.followUp.findMany({ orderBy: { createdAt: "asc" } }),
    db.deal.findMany({ orderBy: { createdAt: "asc" } }),
    db.activity.findMany({ orderBy: { createdAt: "asc" } }),
    db.whatsAppTemplate.findMany({ orderBy: { createdAt: "asc" } }),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const data = { users, settings, leads, properties, leadProperties, followUps, deals, activities, templates, messages };
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0]));
  const now = new Date();
  const body = JSON.stringify(
    {
      meta: { app: "EstateDesk CRM", version: 1, exportedAt: now.toISOString(), exportedBy: user.email, counts, note: "Password hashes and API secrets are excluded." },
      data,
    },
    null,
    2,
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="estatedesk-backup-${format(now, "yyyy-MM-dd")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
