import "server-only";
import webpush from "web-push";
import { db } from "./db";

export function isPushConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured || !isPushConfigured()) return isPushConfigured();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends a push to every device of a user. Returns number of successful deliveries. */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  if (!configure()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/dashboard", tag: msg.tag }),
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("Push failed", code, (e as Error).message);
      }
    }),
  );
  return sent;
}
