import "server-only";

/** Sends an approved WhatsApp (Meta) template message with plain body text parameters. */
export async function sendWhatsAppTemplate({
  phoneNumberId,
  accessToken,
  to,
  template,
  language = "en",
  params,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  template: string;
  language?: string;
  params: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : undefined,
        },
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
