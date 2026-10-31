import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ed_session";
const SESSION_DAYS = 7;

export type SessionPayload = {
  userId: string;
  orgId: string;
  role: string;
  name: string;
  /** Set when a platform super admin is viewing an organization as one of its users */
  impersonatorId?: string;
};

function key() {
  const secret = process.env.AUTH_SECRET || "estatedesk-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
