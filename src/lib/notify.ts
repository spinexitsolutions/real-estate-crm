import "server-only";
import { db } from "./db";
import { isPushConfigured, sendPushToUser } from "./push";

export type NotifyPayload = { title: string; body: string; url?: string; tag?: string };

/**
 * Sends a notification to a user on every channel they have enabled (web push).
 * Never throws.
 */
export async function notifyUser(userId: string | null | undefined, payload: NotifyPayload): Promise<void> {
  if (!userId) return;
  try {
    if (!isPushConfigured()) return;
    const [user, settings] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { active: true, notifyPush: true } }),
      db.settings.findFirst({ select: { pushEnabled: true } }),
    ]);
    if (!user?.active || !user.notifyPush || settings?.pushEnabled === false) return;
    await sendPushToUser(userId, payload);
  } catch (e) {
    console.error("notifyUser failed", e);
  }
}
