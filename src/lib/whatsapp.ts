import "server-only";

const GRAPH_VERSION = "v21.0";

type GraphResponse = { messages?: { id: string }[]; error?: { message?: string; error_user_msg?: string; code?: number } };

async function postMessage(phoneNumberId: string, accessToken: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as GraphResponse;
    if (!res.ok) {
      const code = data.error?.code;
      const hint = code === 131047 ? " (24-hour window closed: send an approved template instead)" : "";
      return { ok: false, error: (data.error?.error_user_msg || data.error?.message || `WhatsApp API error (${res.status})`) + hint };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach WhatsApp API" };
  }
}

/** Sends an approved (Meta) template message. Works outside the 24-hour customer service window. */
export async function sendTemplateViaCloudApi({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  language,
  params,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  language: string;
  params: string[];
}) {
  return postMessage(phoneNumberId, accessToken, {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "en" },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p || "-" })) }] }
        : {}),
    },
  });
}

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
  return postMessage(phoneNumberId, accessToken, { to, type: "text", text: { preview_url: true, body } });
}
