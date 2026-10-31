import "server-only";

export type NotifyPayload = { title: string; body: string; url?: string; tag?: string };

/**
 * Sends a notification to a user on every channel they have enabled (web push today).
 * Never throws. Implementation is filled in by the notifications module.
 */
export async function notifyUser(userId: string | null | undefined, payload: NotifyPayload): Promise<void> {
  if (!userId) return;
  void payload;
}
