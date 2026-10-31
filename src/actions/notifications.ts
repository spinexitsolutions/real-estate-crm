"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { getSettings } from "@/lib/settings";

/** Sends a test push and email to the current user, reporting which channels worked. */
export async function sendTestNotification(): Promise<ActionResult<{ push: number; email: boolean }>> {
  const user = await requireUser();
  if (!isPushConfigured() && !isEmailConfigured()) return { error: "Neither push nor email is configured yet." };
  let push = 0;
  if (isPushConfigured()) {
    push = await sendPushToUser(user.id, { title: "Test notification", body: "Push notifications are working on this device.", url: "/dashboard", tag: "test" });
  }
  let email = false;
  if (isEmailConfigured()) {
    const settings = await getSettings();
    const r = await sendEmail({
      to: user.email,
      subject: "EstateDesk test email",
      html: emailLayout({ company: settings.companyName, heading: "Email is working", body: "<p style=\"margin:0\">This is a test email from your CRM. Daily digests and password reset emails will be delivered like this.</p>" }),
    });
    if (!r.ok) return { error: `Email failed: ${r.error}` };
    email = true;
  }
  if (isPushConfigured() && push === 0 && !email) {
    const devices = await db.pushSubscription.count({ where: { userId: user.id } });
    if (!devices) return { error: "No device is subscribed. Enable desktop notifications from the bell icon first." };
  }
  return { ok: true, data: { push, email } };
}
