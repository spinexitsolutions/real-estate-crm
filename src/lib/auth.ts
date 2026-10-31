import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { decrypt, encrypt, SESSION_COOKIE, SESSION_MAX_AGE } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
};

export async function createSession(user: { id: string; role: string; name: string }) {
  const token = await encrypt({ userId: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session?.userId) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true },
  });
  if (!user || !user.active) return null;
  const { active: _active, ...rest } = user;
  return rest;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: string[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Agents only see their own leads; admins/managers see everything. */
export function leadScope(user: CurrentUser) {
  return user.role === "AGENT" ? { assignedToId: user.id } : {};
}

export function isManager(user: CurrentUser) {
  return user.role === "ADMIN" || user.role === "MANAGER";
}
