import "server-only";
import { rawDb } from "./db";

/**
 * Webhooks arrive without a login, so we work out which organization they belong to from
 * a secret in the URL (or the provider's account id) and then run everything inside
 * runAsTenant(orgId, ...). Suspended organizations stop receiving webhook data.
 */

function keyFrom(req: Request) {
  return (new URL(req.url).searchParams.get("key") ?? req.headers.get("x-api-key") ?? "").trim();
}

async function activeOrg(orgId: string | null | undefined) {
  if (!orgId) return null;
  const org = await rawDb.organization.findUnique({ where: { id: orgId }, select: { id: true, status: true } });
  return org && org.status !== "SUSPENDED" ? org.id : null;
}

/** Lead capture / portal / email-forwarding webhooks: ?key=<leadWebhookKey> */
export async function orgFromLeadKey(req: Request) {
  const key = keyFrom(req);
  if (key.length < 16) return null;
  const s = await rawDb.settings.findUnique({ where: { leadWebhookKey: key }, select: { organizationId: true } });
  return activeOrg(s?.organizationId);
}

/** Exotel / Knowlarity callbacks: ?key=<telephonyWebhookKey> */
export async function orgFromTelephonyKey(req: Request) {
  const key = keyFrom(req);
  if (key.length < 16) return null;
  const s = await rawDb.settings.findUnique({ where: { telephonyWebhookKey: key }, select: { organizationId: true } });
  return activeOrg(s?.organizationId);
}

/** Meta (WhatsApp / Facebook) webhooks: ?org=<organization id> (requests are then verified with that org's own secrets) */
export async function orgFromParam(req: Request) {
  const id = new URL(req.url).searchParams.get("org");
  return activeOrg(id);
}

/** WhatsApp fallback when ?org is missing: match the receiving business phone number id. */
export async function orgFromWaPhoneNumberId(phoneNumberId: string | null | undefined) {
  if (!phoneNumberId) return null;
  const s = await rawDb.settings.findFirst({ where: { waPhoneNumberId: phoneNumberId }, select: { organizationId: true } });
  return activeOrg(s?.organizationId);
}
