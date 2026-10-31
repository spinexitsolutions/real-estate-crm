import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Customer portal PIN unlock cookie, shared by the portal pages and the portal document route.
 * Cookie: name `portal_<first 8 chars of token>`, value HMAC-SHA256(AUTH_SECRET, token) base64url,
 * httpOnly, path "/", 12h maxAge (PORTAL_COOKIE_MAX_AGE).
 */
export const PORTAL_COOKIE_MAX_AGE = 12 * 60 * 60;

export function portalCookieName(token: string) {
  return `portal_${token.slice(0, 8)}`;
}

export function portalCookieValue(token: string) {
  const secret = process.env.AUTH_SECRET || "estatedesk-dev-secret-change-me";
  return createHmac("sha256", secret).update(token).digest("base64url");
}

type CookieReader = { get(name: string): { value: string } | undefined };

/** True when the visitor holds a valid unlock cookie for this portal token. Callers skip this check when the portal has no PIN. */
export function isPortalUnlocked(token: string, cookieStore: CookieReader) {
  const v = cookieStore.get(portalCookieName(token))?.value;
  if (!v) return false;
  const expected = Buffer.from(portalCookieValue(token));
  const got = Buffer.from(v);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
