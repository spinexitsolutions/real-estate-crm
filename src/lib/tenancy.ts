import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db, rawDb, runAsTenant } from "./db";

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
export const TRIAL_PLAN_CODE = process.env.TRIAL_PLAN_CODE || "GROWTH";

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "company"
  );
}

/** A free, unique slug based on the company name (e.g. skyline-realty, skyline-realty-2). */
export async function uniqueSlug(name: string) {
  const base = slugify(name);
  const RESERVED = new Set(["admin", "api", "app", "www", "site", "portal", "login", "signup", "billing", "pricing", "help", "support"]);
  let slug = RESERVED.has(base) ? `${base}-realty` : base;
  for (let i = 2; await rawDb.organization.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
}

const DEFAULT_TEMPLATES = [
  { name: "Welcome / First Contact", category: "GREETING", body: "Hi {{name}}, thank you for your enquiry with {{company}}. I am {{agent}}, your property advisor. Could you share a convenient time to discuss your requirements?" },
  { name: "Share Property Details", category: "PROPERTY", body: "Hi {{name}}, here is a property that matches your requirement:\n\n{{property}}\nLocation: {{location}}\nPrice: {{price}}\n\nWould you like to schedule a site visit this week?" },
  { name: "Site Visit Confirmation", category: "SITE_VISIT", body: "Hi {{name}}, your site visit for {{property}} is confirmed on {{date}}. Location: {{location}}. I will be there to receive you. - {{agent}}, {{company}}" },
  { name: "Gentle Follow-up", category: "FOLLOW_UP", body: "Hi {{name}}, just checking in on your property search. We have a few new listings that fit your budget. Shall I share them?" },
  { name: "Payment Reminder", category: "PAYMENT", body: "Dear {{name}}, this is a gentle reminder regarding the upcoming payment for {{property}}. Please reach out if you need any assistance. - {{company}}" },
];

export type NewOrganizationInput = {
  companyName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string | null;
  city?: string | null;
  businessType?: string | null;
  teamSize?: string | null;
};

/** Creates a company on a free trial with its admin user, settings and starter templates. */
export async function createOrganization(input: NewOrganizationInput) {
  const email = input.email.trim().toLowerCase();
  if (await rawDb.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }
  const plan = await rawDb.plan.findUnique({ where: { code: TRIAL_PLAN_CODE } });
  const org = await rawDb.organization.create({
    data: {
      name: input.companyName.trim(),
      slug: await uniqueSlug(input.companyName),
      status: "TRIAL",
      planId: plan?.id ?? null,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
      ownerName: input.ownerName.trim(),
      ownerEmail: email,
      ownerPhone: input.phone || null,
      city: input.city || null,
      businessType: input.businessType || null,
      teamSize: input.teamSize || null,
    },
  });
  const user = await runAsTenant(org.id, async () => {
    await db.settings.create({
      data: {
        companyName: org.name,
        companyEmail: email,
        companyPhone: input.phone || null,
        leadWebhookKey: randomBytes(16).toString("hex"),
      },
    });
    await db.whatsAppTemplate.createMany({ data: DEFAULT_TEMPLATES });
    return db.user.create({
      data: { name: input.ownerName.trim(), email, password: await bcrypt.hash(input.password, 10), role: "ADMIN", phone: input.phone || null },
    });
  });
  return { org, user };
}

export type OrgAccess = {
  state: "ok" | "trial" | "trial_expired" | "past_due" | "cancelled" | "suspended";
  daysLeft: number | null;
  readOnly: boolean;
};

const GRACE_DAYS = 3;

/** What an organization may do right now, based on its subscription status. */
export function orgAccess(org: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null }, now = new Date()): OrgAccess {
  const days = (d: Date | null) => (d ? Math.ceil((d.getTime() - now.getTime()) / 86400000) : null);
  switch (org.status) {
    case "SUSPENDED":
      return { state: "suspended", daysLeft: null, readOnly: true };
    case "TRIAL": {
      const left = days(org.trialEndsAt);
      if (left !== null && left <= 0) return { state: "trial_expired", daysLeft: 0, readOnly: true };
      return { state: "trial", daysLeft: left, readOnly: false };
    }
    case "PAST_DUE": {
      const left = days(org.currentPeriodEnd);
      // short grace period to fix a failed payment before the account becomes read-only
      return { state: "past_due", daysLeft: left, readOnly: left !== null && left < -GRACE_DAYS };
    }
    case "CANCELLED": {
      const left = days(org.currentPeriodEnd);
      if (left !== null && left > 0) return { state: "ok", daysLeft: left, readOnly: false }; // paid until period end
      return { state: "cancelled", daysLeft: 0, readOnly: true };
    }
    default:
      return { state: "ok", daysLeft: days(org.currentPeriodEnd), readOnly: false };
  }
}
