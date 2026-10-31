import { NextResponse } from "next/server";
import { eachDayOfInterval, endOfMonth, format, parse, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser, isManager } from "@/lib/auth";
import { inAppTz } from "@/lib/timezone";
import { toCsv } from "@/lib/utils";

/** Attendance CSV for a month (managers: whole team, agents: themselves). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const monthParam = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : format(inAppTz(new Date()), "yyyy-MM");
  const m = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) }).map((d) => format(d, "yyyy-MM-dd"));

  const records = await db.attendance.findMany({
    where: { date: { in: days }, ...(isManager(user) ? {} : { userId: user.id }) },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ date: "asc" }, { checkInAt: "asc" }],
  });
  const t = (d: Date | null) => (d ? format(inAppTz(d), "HH:mm") : "");
  const rows = records.map((r) => {
    const mins = r.checkOutAt ? Math.round((r.checkOutAt.getTime() - r.checkInAt.getTime()) / 60000) : null;
    const inMin = inAppTz(r.checkInAt).getHours() * 60 + inAppTz(r.checkInAt).getMinutes();
    return [
      r.date,
      r.user.name,
      r.user.email,
      t(r.checkInAt),
      t(r.checkOutAt),
      mins === null ? "" : (mins / 60).toFixed(2),
      inMin > 600 ? "Late" : "On time",
      r.checkInDistanceM === null ? "" : Math.round(r.checkInDistanceM),
      r.checkInLat ?? "",
      r.checkInLng ?? "",
      r.notes ?? "",
    ];
  });
  const csv = toCsv(["Date", "Member", "Email", "Check in", "Check out", "Hours", "Punctuality", "Distance from office (m)", "Latitude", "Longitude", "Notes"], rows);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.csv"`,
    },
  });
}
