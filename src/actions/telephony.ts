"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/action";
import { str } from "@/lib/utils";

export async function saveTelephony(fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can change telephony settings." };
  const provider = str(fd, "telephonyProvider");
  if (provider && provider !== "EXOTEL" && provider !== "KNOWLARITY") return { error: "Unknown provider." };
  const s = await db.settings.findUnique({ where: { id: 1 } });

  const keep = (key: string, current: string | null | undefined) => {
    const v = str(fd, key);
    return v ? v : (current ?? null);
  };
  const callerId = str(fd, "exotelCallerId").replace(/[^\d+]/g, "");

  // Only the selected provider's fields are posted, so update just those (switching keeps the other provider's config).
  const data: Record<string, unknown> = {
    telephonyProvider: provider || null,
    telephonyWebhookKey: s?.telephonyWebhookKey || randomBytes(16).toString("hex"),
  };
  if (provider === "EXOTEL") {
    if (!str(fd, "exotelSid")) return { error: "Exotel Account SID is required." };
    if (!callerId) return { error: "Exotel caller ID (ExoPhone) is required." };
    Object.assign(data, {
      exotelSid: str(fd, "exotelSid"),
      exotelSubdomain: (str(fd, "exotelSubdomain") || "api.exotel.com").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      exotelCallerId: callerId,
      exotelApiKey: keep("exotelApiKey", s?.exotelApiKey),
      exotelApiToken: keep("exotelApiToken", s?.exotelApiToken),
    });
  }
  if (provider === "KNOWLARITY") {
    const sr = str(fd, "knowlaritySrNumber").replace(/[^\d+]/g, "");
    if (!sr) return { error: "Knowlarity SR number is required." };
    Object.assign(data, {
      knowlaritySrNumber: sr,
      knowlarityCallerId: str(fd, "knowlarityCallerId").replace(/[^\d+]/g, "") || null,
      knowlarityApiKey: keep("knowlarityApiKey", s?.knowlarityApiKey),
      knowlarityAuthToken: keep("knowlarityAuthToken", s?.knowlarityAuthToken),
    });
  }
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function regenerateTelephonyKey(): Promise<ActionResult<{ key: string }>> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Only admins can do this." };
  const key = randomBytes(16).toString("hex");
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, telephonyWebhookKey: key }, update: { telephonyWebhookKey: key } });
  revalidatePath("/settings");
  return { ok: true, data: { key } };
}
