import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, parse, startOfMonth, subMonths } from "date-fns";
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Download, MapPin, MapPinCheck, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { isManager, requireUser } from "@/lib/auth";
import { fromDateTimeLocal, inAppTz } from "@/lib/timezone";
import { formatDistance, mapsLink } from "@/lib/geo";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button-styles";
import { CheckInRow } from "@/components/site-visits/lead-checkins-card";
import { cn } from "@/lib/utils";
import { CheckInOutButton, OfficeLocationForm } from "./attendance-client";

export const metadata = { title: "Attendance" };

const LATE_AFTER_MIN = 10 * 60; // 10:00 AM
const WEEKLY_OFF = 0; // Sunday

type Rec = { checkInAt: Date; checkOutAt: Date | null; checkInDistanceM: number | null; checkInLat: number | null; checkInLng: number | null };

function minutesOfDay(d: Date) {
  const z = inAppTz(d);
  return z.getHours() * 60 + z.getMinutes();
}
function isLate(r: Rec) {
  return minutesOfDay(r.checkInAt) > LATE_AFTER_MIN;
}
function workedMin(r: Rec, now = new Date()) {
  const end = r.checkOutAt ?? now;
  return Math.max(0, Math.round((end.getTime() - r.checkInAt.getTime()) / 60000));
}
function hm(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
const t = (d: Date) => format(inAppTz(d), "h:mm a");

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; month?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const now = new Date();
  const todayKey = format(inAppTz(now), "yyyy-MM-dd");
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKey;
  const monthKey = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayKey.slice(0, 7);
  const monthDate = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }).map((d) => format(d, "yyyy-MM-dd"));

  const settings = await db.settings.findFirst({ select: { officeLatitude: true, officeLongitude: true, officeRadiusM: true } });
  const radius = settings?.officeRadiusM ?? 300;
  const hasOffice = settings?.officeLatitude != null && settings?.officeLongitude != null;

  const [mine, myMonth, team, dayRecords, monthRecords, dayCheckIns] = await Promise.all([
    db.attendance.findUnique({ where: { userId_date: { userId: user.id, date: todayKey } } }),
    db.attendance.findMany({ where: { userId: user.id, date: { in: days } } }),
    manager ? db.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    manager ? db.attendance.findMany({ where: { date } }) : Promise.resolve([]),
    manager ? db.attendance.findMany({ where: { date: { in: days } } }) : Promise.resolve([]),
    manager
      ? db.siteVisitCheckIn.findMany({
          where: { createdAt: { gte: new Date(fromDateTimeLocal(`${date}T00:00`)), lt: new Date(new Date(fromDateTimeLocal(`${date}T00:00`)).getTime() + 86400000) } },
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } }, property: { select: { id: true, title: true, code: true } }, lead: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const mode = !mine ? "in" : mine.checkOutAt ? "done" : "out";
  const myByDate = new Map(myMonth.map((r) => [r.date, r]));
  const presentDays = myMonth.length;
  const lateDays = myMonth.filter(isLate).length;
  const avgMin = myMonth.length ? Math.round(myMonth.filter((r) => r.checkOutAt).reduce((s, r) => s + workedMin(r), 0) / Math.max(1, myMonth.filter((r) => r.checkOutAt).length)) : 0;

  const monthNav = (delta: number) => {
    const p = new URLSearchParams();
    if (sp.date) p.set("date", sp.date);
    p.set("month", format(delta > 0 ? addMonths(monthDate, 1) : subMonths(monthDate, 1), "yyyy-MM"));
    return `/attendance?${p.toString()}`;
  };

  const dayRecMap = new Map(dayRecords.map((r) => [r.userId, r]));
  const summary = team.map((u) => {
    const recs = monthRecords.filter((r) => r.userId === u.id);
    const closed = recs.filter((r) => r.checkOutAt);
    return {
      ...u,
      present: recs.length,
      late: recs.filter(isLate).length,
      avg: closed.length ? Math.round(closed.reduce((s, r) => s + workedMin(r), 0) / closed.length) : 0,
    };
  });
  const presentToday = dayRecords.length;

  return (
    <>
      <PageHeader icon={UserCheck} title="Attendance" description="Daily check-in with location, and site visit check-ins for your team." />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{format(inAppTz(now), "EEEE, d MMMM yyyy")}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {mode === "in" ? "You have not checked in yet" : mode === "out" ? "You are checked in" : "Day complete"}
              </h2>
              {mine && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4 text-slate-400" /> In at <span className="font-semibold text-slate-900">{t(mine.checkInAt)}</span>
                    {isLate(mine) && <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">Late</Badge>}
                  </span>
                  {mine.checkOutAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 text-slate-400" /> Out at <span className="font-semibold text-slate-900">{t(mine.checkOutAt)}</span>
                    </span>
                  )}
                  <span>
                    Worked <span className="font-semibold text-slate-900">{hm(workedMin(mine))}</span>
                    {!mine.checkOutAt && " so far"}
                  </span>
                  {mine.checkInDistanceM !== null && (
                    <DistanceBadge m={mine.checkInDistanceM} radius={radius} />
                  )}
                </div>
              )}
              {!hasOffice && user.role === "ADMIN" && <p className="mt-3 text-xs text-amber-700">Set the office location below to track distance from office.</p>}
            </div>
            <CheckInOutButton mode={mode} />
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-4 xl:grid-cols-1">
          <StatCard label="Present this month" value={presentDays} icon={CalendarDays} tone="emerald" />
          <StatCard label="Late check-ins" value={lateDays} icon={Clock} tone={lateDays ? "amber" : "sky"} sub={<span>after 10:00 AM</span>} />
          <StatCard label="Average day" value={avgMin ? hm(avgMin) : "-"} icon={UserCheck} tone="violet" />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="My attendance"
          description={format(monthDate, "MMMM yyyy")}
          action={
            <div className="flex items-center gap-1">
              <Link href={monthNav(-1)} scroll={false} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={monthNav(1)} scroll={false} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Next month">
                <ChevronRight className="size-4" />
              </Link>
            </div>
          }
        />
        <div className="p-5">
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: (getDay(startOfMonth(monthDate)) + 6) % 7 }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const r = myByDate.get(d);
              const day = parse(d, "yyyy-MM-dd", new Date());
              const future = d > todayKey;
              const off = getDay(day) === WEEKLY_OFF;
              const state = r ? (isLate(r) ? "late" : "present") : future ? "future" : off ? "off" : d === todayKey ? "today" : "absent";
              return (
                <div
                  key={d}
                  title={r ? `In ${t(r.checkInAt)}${r.checkOutAt ? `, out ${t(r.checkOutAt)}` : ""}` : undefined}
                  className={cn(
                    "flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-sm sm:aspect-auto sm:h-16",
                    state === "present" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    state === "late" && "border-amber-200 bg-amber-50 text-amber-800",
                    state === "absent" && "border-rose-100 bg-rose-50/60 text-rose-700",
                    state === "off" && "border-slate-100 bg-slate-50 text-slate-400",
                    (state === "future" || state === "today") && "border-slate-100 text-slate-400",
                    d === todayKey && "ring-2 ring-brand-500/40",
                  )}
                >
                  <span className="font-semibold">{format(day, "d")}</span>
                  <span className="hidden text-[10px] sm:block">
                    {r ? t(r.checkInAt) : state === "absent" ? "Absent" : state === "off" ? "Off" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <Legend className="bg-emerald-100" label="Present" />
            <Legend className="bg-amber-100" label="Late (after 10:00 AM)" />
            <Legend className="bg-rose-100" label="Absent" />
            <Legend className="bg-slate-100" label="Weekly off (Sunday)" />
          </div>
        </div>
      </Card>

      {manager && (
        <>
          <Card className="mt-6 overflow-hidden">
            <CardHeader
              title="Team attendance"
              description={`${presentToday} of ${team.length} checked in on ${format(parse(date, "yyyy-MM-dd", new Date()), "d MMM yyyy")}`}
              action={
                <form className="flex items-center gap-2">
                  {sp.month && <input type="hidden" name="month" value={sp.month} />}
                  <input type="date" name="date" defaultValue={date} max={todayKey} className="input h-9 w-auto" />
                  <button type="submit" className={buttonClass("secondary", "sm", "h-9")}>
                    Show
                  </button>
                </form>
              }
            />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="table-th">Member</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Check in</th>
                    <th className="table-th">Location</th>
                    <th className="table-th">Check out</th>
                    <th className="table-th">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {team.map((u) => {
                    const r = dayRecMap.get(u.id);
                    const off = getDay(parse(date, "yyyy-MM-dd", new Date())) === WEEKLY_OFF;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="table-td">
                          <span className="flex items-center gap-2.5">
                            <Avatar name={u.name} size="sm" />
                            <span className="font-medium text-slate-800">{u.name}</span>
                          </span>
                        </td>
                        <td className="table-td">
                          {r ? (
                            isLate(r) ? (
                              <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20" dot="bg-amber-500">
                                Late
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" dot="bg-emerald-500">
                                Present
                              </Badge>
                            )
                          ) : date === todayKey ? (
                            <Badge>Not checked in</Badge>
                          ) : off ? (
                            <Badge>Weekly off</Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 ring-rose-600/20" dot="bg-rose-500">
                              Absent
                            </Badge>
                          )}
                        </td>
                        <td className="table-td">{r ? t(r.checkInAt) : "-"}</td>
                        <td className="table-td">
                          {r?.checkInLat != null && r.checkInLng != null ? (
                            <span className="flex items-center gap-2">
                              {r.checkInDistanceM !== null && <DistanceBadge m={r.checkInDistanceM} radius={radius} />}
                              <a href={mapsLink(r.checkInLat, r.checkInLng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">
                                <MapPin className="size-3.5" /> Map
                              </a>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="table-td">{r?.checkOutAt ? t(r.checkOutAt) : r ? <span className="text-xs text-slate-400">Still in</span> : "-"}</td>
                        <td className="table-td font-medium text-slate-800">{r ? hm(workedMin(r)) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2">
              <CardHeader
                title="Monthly summary"
                description={format(monthDate, "MMMM yyyy")}
                action={
                  <a href={`/api/attendance/export?month=${monthKey}`} className={buttonClass("secondary", "sm")}>
                    <Download /> Export CSV
                  </a>
                }
              />
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className="table-th">Member</th>
                      <th className="table-th text-right">Present days</th>
                      <th className="table-th text-right">Late days</th>
                      <th className="table-th text-right">Avg hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {summary.map((s) => (
                      <tr key={s.id}>
                        <td className="table-td font-medium text-slate-800">{s.name}</td>
                        <td className="table-td text-right">{s.present}</td>
                        <td className={cn("table-td text-right", s.late ? "font-medium text-amber-700" : "")}>{s.late}</td>
                        <td className="table-td text-right">{s.avg ? hm(s.avg) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader title="Site visits" description={`Check-ins on ${format(parse(date, "yyyy-MM-dd", new Date()), "d MMM")}`} action={<MapPinCheck className="size-4 text-slate-400" />} />
              {dayCheckIns.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">No site visit check-ins on this day.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dayCheckIns.map((c) => (
                    <CheckInRow key={c.id} c={c} showLead />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {user.role === "ADMIN" && (
        <Card className="mt-6">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-slate-400" /> Office location
              </span>
            }
            description={hasOffice ? `Check-ins within ${radius} m count as at office.` : "Set your office location to see how far check-ins are from the office."}
          />
          <div className="p-5">
            <OfficeLocationForm lat={settings?.officeLatitude ?? null} lng={settings?.officeLongitude ?? null} radius={radius} />
          </div>
        </Card>
      )}
    </>
  );
}

function DistanceBadge({ m, radius }: { m: number; radius: number }) {
  const inside = m <= radius;
  return (
    <Badge className={inside ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"}>
      {inside ? "At office" : `${formatDistance(m)} from office`}
    </Badge>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded", className)} />
      {label}
    </span>
  );
}

export const dynamic = "force-dynamic";
