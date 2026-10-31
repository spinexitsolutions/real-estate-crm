import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordingAuthHeaders } from "@/lib/telephony";

/** Streams a call recording to signed-in users who can see the call (provider recordings need auth). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const call = await db.callLog.findUnique({ where: { id }, include: { lead: { select: { assignedToId: true } } } });
  if (!call?.recordingUrl) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  if (user.role === "AGENT" && call.userId !== user.id && call.lead?.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let url: URL;
  try {
    url = new URL(call.recordingUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Invalid recording URL" }, { status: 400 });
  }

  // Recordings that are not hosted by a telephony provider are public links: just redirect.
  if (call.provider === "MANUAL") return NextResponse.redirect(url.toString(), 302);

  const settings = await db.settings.findFirst();
  const range = req.headers.get("range");
  const upstream = await fetch(url, {
    headers: { ...recordingAuthHeaders(settings, url.toString()), ...(range ? { Range: range } : {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (!upstream || (!upstream.ok && upstream.status !== 206) || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch the recording from the provider" }, { status: 502 });
  }
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  headers.set("cache-control", "private, max-age=3600");
  return new Response(upstream.body, { status: upstream.status, headers });
}
