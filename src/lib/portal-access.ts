import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { isPortalUnlocked } from "./portal-session";

/** Loads a portal access by token; `unlocked` is false when a PIN is set and the visitor has not entered it. */
export async function getPortalAccess(token: string) {
  if (!token || token.length < 16) return null;
  const access = await db.portalAccess.findUnique({ where: { token } });
  if (!access || access.revokedAt) return null;
  const unlocked = !access.pin || isPortalUnlocked(token, await cookies());
  return { access, unlocked };
}
