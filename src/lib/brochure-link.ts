import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return process.env.AUTH_SECRET || "estatedesk-dev-secret-change-me";
}

/** Short, unguessable signature so an unpublished property's brochure can be shared with one lead. */
export function brochureSig(propertyId: string) {
  return createHmac("sha256", secret()).update(`brochure:${propertyId}`).digest("base64url").slice(0, 22);
}

export function verifyBrochureSig(propertyId: string, sig: string | null | undefined) {
  if (!sig) return false;
  const expected = Buffer.from(brochureSig(propertyId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Public, shareable brochure link (works without login). */
export function brochureUrl(propertyId: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/brochure/${propertyId}?sig=${brochureSig(propertyId)}`;
}

/** Best-effort public origin of the app for building absolute links. */
export function originFrom(headers: Headers) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
