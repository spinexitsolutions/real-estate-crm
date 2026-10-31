import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { applyAppTimezone } from "./timezone";
import { decrypt, SESSION_COOKIE } from "./session";

applyAppTimezone();

/**
 * MULTI-TENANCY
 * -------------
 * Every business table carries `organizationId`. `db` (exported below) is a Prisma client
 * that automatically scopes every query on those tables to the current organization:
 *   - reads / updates / deletes get `organizationId = <current org>` added to `where`
 *   - creates get `organizationId` set (including nested creates)
 * The current organization comes from `runAsTenant(orgId, fn)` (webhooks, cron, public pages)
 * or, inside a normal request, from the signed-in user's session cookie.
 * If neither is available the query THROWS instead of returning another company's data.
 *
 * `rawDb` is the unscoped client. Use it only for platform-level work: login lookup,
 * signup, super admin, and resolving which organization a webhook belongs to.
 */

export const TENANT_MODELS = new Set<string>([
  "User",
  "Lead",
  "Property",
  "LeadProperty",
  "FollowUp",
  "Deal",
  "Activity",
  "WhatsAppTemplate",
  "WhatsAppMessage",
  "Settings",
  "Booking",
  "PaymentInstallment",
  "Payment",
  "CallLog",
  "Attendance",
  "SiteVisitCheckIn",
  "Document",
  "PortalAccess",
  "IntegrationLog",
  "Invoice",
]);

const tenantStore = new AsyncLocalStorage<{ orgId: string }>();

/** Runs `fn` with all `db` queries scoped to `orgId` (for webhooks, cron jobs, public pages, scripts). */
export function runAsTenant<T>(orgId: string, fn: () => T | Promise<T>): Promise<Awaited<T>> {
  // Await inside the context: Prisma queries are lazy and only run when awaited.
  return tenantStore.run({ orgId }, async () => (await fn()) as Awaited<T>) as Promise<Awaited<T>>;
}

export class TenantContextError extends Error {
  constructor(model: string, operation: string) {
    super(`No organization context for ${model}.${operation}. Wrap the call in runAsTenant() or use rawDb for platform-level queries.`);
    this.name = "TenantContextError";
  }
}

const tokenCache = new Map<string, string | null>();

/** True when the current context comes from a signed-in user (not a webhook / cron / public page). */
export function isSystemContext() {
  return !!tenantStore.getStore();
}

/** Organization of the current request: explicit runAsTenant() first, then the session cookie. */
export async function currentOrgId(): Promise<string | null> {
  const store = tenantStore.getStore();
  if (store) return store.orgId;
  let token: string | undefined;
  try {
    const { cookies } = await import("next/headers");
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    return null; // outside a request (scripts) - caller must use runAsTenant
  }
  if (!token) return null;
  if (tokenCache.has(token)) return tokenCache.get(token) ?? null;
  const session = await decrypt(token);
  const orgId = session?.orgId ?? null;
  if (tokenCache.size > 5000) tokenCache.clear();
  tokenCache.set(token, orgId);
  return orgId;
}

// ---------------------------------------------------------------- data rewriting helpers

type Field = { name: string; kind: string; type: string; relationFromFields?: readonly string[] };
const MODELS = new Map<string, Field[]>(Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields as unknown as Field[]]));

function relationFields(model: string) {
  return (MODELS.get(model) ?? []).filter((f) => f.kind === "object");
}

/** True when `data` uses relation objects (`{ lead: { connect } }`) instead of raw foreign keys. */
function usesCheckedInput(model: string, data: Record<string, unknown>) {
  return relationFields(model).some((f) => {
    const v = data[f.name];
    return v && typeof v === "object" && f.name !== "organization" && ("connect" in v || "connectOrCreate" in v || ("create" in v && (f.relationFromFields?.length ?? 0) > 0));
  });
}

function withOrg(model: string, data: unknown, orgId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => withOrg(model, d, orgId));
  if (!data || typeof data !== "object") return data;
  const d = { ...(data as Record<string, unknown>) };
  if (TENANT_MODELS.has(model) && d.organizationId === undefined && d.organization === undefined) {
    if (usesCheckedInput(model, d)) d.organization = { connect: { id: orgId } };
    else d.organizationId = orgId;
  }
  // nested writes into related tenant models
  for (const f of relationFields(model)) {
    const v = d[f.name];
    if (!v || typeof v !== "object" || !TENANT_MODELS.has(f.type)) continue;
    const nested = { ...(v as Record<string, unknown>) };
    if (nested.create) nested.create = withOrg(f.type, nested.create, orgId);
    if (nested.createMany && typeof nested.createMany === "object") {
      const cm = { ...(nested.createMany as Record<string, unknown>) };
      cm.data = withOrg(f.type, cm.data, orgId);
      nested.createMany = cm;
    }
    if (nested.connectOrCreate) {
      const list = Array.isArray(nested.connectOrCreate) ? nested.connectOrCreate : [nested.connectOrCreate];
      const mapped = list.map((c: Record<string, unknown>) => ({ ...c, create: withOrg(f.type, c.create, orgId) }));
      nested.connectOrCreate = Array.isArray(nested.connectOrCreate) ? mapped : mapped[0];
    }
    if (nested.upsert) {
      const list = Array.isArray(nested.upsert) ? nested.upsert : [nested.upsert];
      const mapped = list.map((u: Record<string, unknown>) => ({ ...u, create: withOrg(f.type, u.create, orgId) }));
      nested.upsert = Array.isArray(nested.upsert) ? mapped : mapped[0];
    }
    d[f.name] = nested;
  }
  return d;
}

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

function scopeArgs(model: string, operation: string, args: Record<string, unknown>, orgId: string) {
  const a = { ...(args ?? {}) };
  if (WHERE_OPS.has(operation)) a.where = { ...((a.where as object) ?? {}), organizationId: orgId };
  if (operation === "create") a.data = withOrg(model, a.data, orgId);
  if (operation === "createMany" || operation === "createManyAndReturn") a.data = withOrg(model, a.data, orgId);
  if (operation === "upsert") {
    a.create = withOrg(model, a.create, orgId);
    a.update = withOrg(model, a.update, orgId);
    // never let an upsert move a row to another org
    if (a.update && typeof a.update === "object") delete (a.update as Record<string, unknown>).organizationId;
  }
  if ((operation === "update" || operation === "updateMany") && a.data && typeof a.data === "object") {
    const data = withOrg(model, a.data, orgId) as Record<string, unknown>;
    delete data.organizationId; // organizationId is immutable
    delete data.organization;
    a.data = data;
  }
  return a;
}

/** Foreign-key scalar fields of a model that point at another tenant model, e.g. Activity.leadId -> Lead. */
function tenantForeignKeys(model: string) {
  const out: { fk: string; target: string; relation: string }[] = [];
  for (const f of relationFields(model)) {
    if (!TENANT_MODELS.has(f.type) || f.type === "Organization") continue;
    for (const fk of f.relationFromFields ?? []) if (fk !== "organizationId") out.push({ fk, target: f.type, relation: f.name });
  }
  return out;
}

export class CrossTenantReferenceError extends Error {
  constructor(model: string, field: string) {
    super(`${model}.${field} points to a record that does not belong to this organization.`);
    this.name = "CrossTenantReferenceError";
  }
}

/**
 * Blocks writes that reference another organization's records (e.g. a note in company A
 * attached to a lead id from company B), for both raw foreign keys and `connect` inputs.
 */
async function assertReferencesInOrg(base: PrismaClient, model: string, data: unknown, orgId: string): Promise<void> {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (const d of data) await assertReferencesInOrg(base, model, d, orgId);
    return;
  }
  const d = data as Record<string, unknown>;
  for (const { fk, target, relation } of tenantForeignKeys(model)) {
    const ids = new Set<string>();
    const raw = d[fk];
    if (typeof raw === "string") ids.add(raw);
    else if (raw && typeof raw === "object" && typeof (raw as { set?: unknown }).set === "string") ids.add((raw as { set: string }).set);
    const rel = d[relation] as Record<string, unknown> | undefined;
    const connect = rel && typeof rel === "object" ? (rel.connect as Record<string, unknown> | Record<string, unknown>[] | undefined) : undefined;
    for (const c of Array.isArray(connect) ? connect : connect ? [connect] : []) if (typeof c.id === "string") ids.add(c.id);
    if (!ids.size) continue;
    const delegate = (base as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[target.charAt(0).toLowerCase() + target.slice(1)];
    const n = await delegate.count({ where: { id: { in: [...ids] }, organizationId: orgId } });
    if (n !== ids.size) throw new CrossTenantReferenceError(model, fk);
  }
  // to-many relations connected by id (e.g. { interests: { connect: [{ id }] } }) on tenant models
  for (const f of relationFields(model)) {
    if (!TENANT_MODELS.has(f.type) || (f.relationFromFields?.length ?? 0) > 0) continue;
    const rel = d[f.name] as Record<string, unknown> | undefined;
    if (!rel || typeof rel !== "object") continue;
    if (rel.create) await assertReferencesInOrg(base, f.type, rel.create, orgId);
    if (rel.createMany && typeof rel.createMany === "object") await assertReferencesInOrg(base, f.type, (rel.createMany as { data?: unknown }).data, orgId);
  }
}

const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"]);
const ALL_WRITE_OPS = new Set([...WRITE_OPS, "delete", "deleteMany"]);

export class OrganizationReadOnlyError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "OrganizationReadOnlyError";
  }
}

/**
 * When a company's trial has ended (or it is suspended / unpaid past the grace period) its users
 * can still sign in, view and export data, but cannot change anything until they subscribe.
 * System contexts (webhooks, cron) are not blocked so incoming leads are never lost.
 * Status is cached for 30 seconds per organization.
 */
const statusCache = new Map<string, { at: number; readOnly: string | null }>();
async function readOnlyReason(base: PrismaClient, orgId: string): Promise<string | null> {
  const hit = statusCache.get(orgId);
  if (hit && Date.now() - hit.at < 30000) return hit.readOnly;
  const org = await base.organization.findUnique({ where: { id: orgId }, select: { status: true, trialEndsAt: true, currentPeriodEnd: true } });
  let reason: string | null = null;
  const now = Date.now();
  if (!org) reason = "Organization not found.";
  else if (org.status === "SUSPENDED") reason = "This account is suspended. Please contact support.";
  else if (org.status === "TRIAL" && org.trialEndsAt && org.trialEndsAt.getTime() <= now) reason = "Your free trial has ended. Choose a plan to continue making changes.";
  else if (org.status === "CANCELLED" && (!org.currentPeriodEnd || org.currentPeriodEnd.getTime() <= now)) reason = "Your subscription has ended. Choose a plan to continue making changes.";
  else if (org.status === "PAST_DUE" && org.currentPeriodEnd && org.currentPeriodEnd.getTime() < now - 3 * 86400000)
    reason = "Your last payment failed. Update your payment to continue making changes.";
  statusCache.set(orgId, { at: Date.now(), readOnly: reason });
  return reason;
}

/** Call after changing an organization's status/plan so the new state applies immediately. */
export function invalidateOrgStatus(orgId: string) {
  statusCache.delete(orgId);
}

function createClients() {
  const base = new PrismaClient();
  const scoped = base.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const orgId = await currentOrgId();
          if (!orgId) throw new TenantContextError(model, operation);
          if (ALL_WRITE_OPS.has(operation) && !isSystemContext()) {
            const reason = await readOnlyReason(base, orgId);
            if (reason) throw new OrganizationReadOnlyError(reason);
          }
          if (WRITE_OPS.has(operation)) {
            const a = args as Record<string, unknown>;
            if (operation === "upsert") {
              await assertReferencesInOrg(base, model, a.create, orgId);
              await assertReferencesInOrg(base, model, a.update, orgId);
            } else await assertReferencesInOrg(base, model, a.data, orgId);
          }
          return query(scopeArgs(model, operation, args as Record<string, unknown>, orgId) as typeof args);
        },
      },
    },
  });
  return { base, scoped };
}

type Clients = ReturnType<typeof createClients>;
const globalForPrisma = globalThis as unknown as { prismaClients?: Clients };
const clients = globalForPrisma.prismaClients ?? createClients();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaClients = clients;

/** Tenant-scoped client - use this everywhere in the app. */
export const db = clients.scoped;
/** Unscoped client - platform-level code only (auth lookup, signup, super admin, webhook routing). */
export const rawDb = clients.base;

export type ScopedDb = typeof db;

/** Current organization id or throw (use for unique `where` on Settings etc.). */
export async function requireOrgId(): Promise<string> {
  const id = await currentOrgId();
  if (!id) throw new TenantContextError("Organization", "requireOrgId");
  return id;
}
