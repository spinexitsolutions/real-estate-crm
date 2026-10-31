import "server-only";
import { db } from "./db";
import { normalizePhone } from "./utils";

export type TelephonyProvider = "EXOTEL" | "KNOWLARITY";
type Settings = NonNullable<Awaited<ReturnType<typeof db.settings.findUnique>>>;

export type ClickToCallResult = { ok: true; provider: TelephonyProvider; providerCallId: string | null } | { ok: false; error: string };

export function telephonyStatus(s: Settings | null) {
  if (!s?.telephonyProvider) return { enabled: false as const, provider: null, reason: "No telephony provider selected in Settings." };
  if (s.telephonyProvider === "EXOTEL") {
    const missing = [!s.exotelSid && "Account SID", !s.exotelApiKey && "API key", !s.exotelApiToken && "API token", !s.exotelCallerId && "ExoPhone (caller ID)"].filter(Boolean);
    return missing.length
      ? { enabled: false as const, provider: "EXOTEL" as const, reason: `Exotel is missing: ${missing.join(", ")}.` }
      : { enabled: true as const, provider: "EXOTEL" as const, reason: null };
  }
  if (s.telephonyProvider === "KNOWLARITY") {
    const missing = [!s.knowlarityApiKey && "API key", !s.knowlarityAuthToken && "Authorization token", !s.knowlaritySrNumber && "SR number (k_number)"].filter(Boolean);
    return missing.length
      ? { enabled: false as const, provider: "KNOWLARITY" as const, reason: `Knowlarity is missing: ${missing.join(", ")}.` }
      : { enabled: true as const, provider: "KNOWLARITY" as const, reason: null };
  }
  return { enabled: false as const, provider: null, reason: "Unknown telephony provider." };
}

/** E.164 with + for Knowlarity, 0-prefixed 10-digit is also accepted by Exotel; we send +91XXXXXXXXXX to both. */
function e164(phone: string, cc: string) {
  return `+${normalizePhone(phone, cc)}`;
}

export async function startClickToCall({ agentPhone, customerPhone, callbackUrl }: { agentPhone: string; customerPhone: string; callbackUrl: string }): Promise<ClickToCallResult> {
  const s = await db.settings.findFirst();
  const status = telephonyStatus(s);
  if (!s || !status.enabled) return { ok: false, error: status.reason ?? "Click-to-call is not configured." };
  const cc = s.defaultCountryCode || "91";
  const agent = e164(agentPhone, cc);
  const customer = e164(customerPhone, cc);

  try {
    if (status.provider === "EXOTEL") {
      const host = (s.exotelSubdomain || "api.exotel.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const url = `https://${host}/v1/Accounts/${encodeURIComponent(s.exotelSid!)}/Calls/connect.json`;
      const body = new URLSearchParams({
        From: agent,
        To: customer,
        CallerId: s.exotelCallerId!,
        Record: "true",
        StatusCallback: callbackUrl,
        "StatusCallbackEvents[0]": "terminal",
        StatusCallbackContentType: "application/json",
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${s.exotelApiKey}:${s.exotelApiToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      let data: { Call?: { Sid?: string }; RestException?: { Message?: string } } = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* non-JSON error page */
      }
      if (!res.ok) return { ok: false, error: `Exotel error (${res.status}): ${data.RestException?.Message ?? text.slice(0, 200)}` };
      return { ok: true, provider: "EXOTEL", providerCallId: data.Call?.Sid ?? null };
    }

    // KNOWLARITY
    const res = await fetch("https://kpi.knowlarity.com/Basic/v1/account/call/makecall", {
      method: "POST",
      headers: {
        "x-api-key": s.knowlarityApiKey!,
        Authorization: s.knowlarityAuthToken!,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        k_number: s.knowlaritySrNumber,
        agent_number: agent,
        customer_number: customer,
        ...(s.knowlarityCallerId ? { caller_id: s.knowlarityCallerId } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data: { success?: { call_id?: string; message?: string }; error?: { message?: string }; call_id?: string; uuid?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok || data.error) return { ok: false, error: `Knowlarity error (${res.status}): ${data.error?.message ?? text.slice(0, 200)}` };
    return { ok: true, provider: "KNOWLARITY", providerCallId: data.success?.call_id ?? data.call_id ?? data.uuid ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not reach ${status.provider === "EXOTEL" ? "Exotel" : "Knowlarity"}: ${msg}` };
  }
}

/** Headers needed to download a provider-hosted recording (Exotel recordings require basic auth). */
export function recordingAuthHeaders(s: Settings | null, url: string): Record<string, string> {
  if (!s) return {};
  try {
    const host = new URL(url).hostname;
    if (/exotel/i.test(host) && s.exotelApiKey && s.exotelApiToken) {
      return { Authorization: `Basic ${Buffer.from(`${s.exotelApiKey}:${s.exotelApiToken}`).toString("base64")}` };
    }
  } catch {
    /* invalid url */
  }
  return {};
}
