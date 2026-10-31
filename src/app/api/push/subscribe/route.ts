import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth || !/^https:\/\//.test(body.endpoint)) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, userId: user.id, userAgent: req.headers.get("user-agent")?.slice(0, 250) },
    update: { p256dh: body.keys.p256dh, auth: body.keys.auth, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.endpoint) await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
