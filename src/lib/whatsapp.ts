import "server-only";

const GRAPH_VERSION = "v21.0";

/** Sends a plain text message through the WhatsApp Business Cloud API. */
export async function sendViaCloudApi({
  phoneNumberId,
  accessToken,
  to,
  body,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body },
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; error_user_msg?: string };
    };
    if (!res.ok) {
      return { ok: false, error: data.error?.error_user_msg || data.error?.message || `WhatsApp API error (${res.status})` };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach WhatsApp API" };
  }
}
