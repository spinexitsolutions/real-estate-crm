import "server-only";
import { cookies } from "next/headers";
import { rawDb, runAsTenant } from "./db";
import { isPortalUnlocked } from "./portal-session";

/** Organization that issued a customer portal link (null when unknown or revoked). */
export async function portalOrg(token: string) {
  if (!token || token.length < 16) return null;
  const a = await rawDb.portalAccess.findUnique({ where: { token }, select: { organizationId: true, revokedAt: true, organization: { select: { status: true } } } });
  if (!a || a.revokedAt || a.organization.status === "SUSPENDED") return null;
  return a.organizationId;
}

/** Runs `fn` scoped to the organization behind a portal token; returns `fallback()` when the link is invalid. */
export async function withPortal<T>(token: string, fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  const orgId = await portalOrg(token);
  if (!orgId) return fallback();
  return runAsTenant(orgId, fn) as Promise<T>;
}

/** Loads a portal access by token; `unlocked` is false when a PIN is set and the visitor has not entered it. */
export async function getPortalAccess(token: string) {
  if (!token || token.length < 16) return null;
  const access = await rawDb.portalAccess.findUnique({ where: { token } });
  if (!access || access.revokedAt) return null;
  const unlocked = !access.pin || isPortalUnlocked(token, await cookies());
  return { access, unlocked };
}
