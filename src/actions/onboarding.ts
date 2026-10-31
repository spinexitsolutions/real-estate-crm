"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { addDays, addHours } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, rawDb, requireOrgId } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { optStr, str } from "@/lib/utils";

async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await requireUser();
  return user.role === "ADMIN" ? user : null;
}

/** Step 1: company details (Settings + the user's own Organization). */
export async function saveCompanyStep(fd: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Only the workspace admin can complete setup." };
  const companyName = str(fd, "companyName").slice(0, 120);
  if (companyName.length < 2) return { error: "Please enter your company name." };
  const companyEmail = optStr(fd, "companyEmail");
  if (companyEmail && !/^\S+@\S+\.\S+$/.test(companyEmail)) return { error: "Please enter a valid email." };
  const businessType = str(fd, "businessType");
  await db.settings.update({
    where: { organizationId: await requireOrgId() },
    data: { companyName, companyPhone: optStr(fd, "companyPhone"), companyEmail, companyAddress: optStr(fd, "companyAddress") },
  });
  // Organization is platform-level: update only the signed-in user's own organization.
  await rawDb.organization.update({
    where: { id: user.organizationId },
    data: {
      name: companyName,
      city: optStr(fd, "city"),
      ...(["BROKER", "BUILDER", "BOTH"].includes(businessType) ? { businessType } : {}),
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Step 2: logo and brand colour. */
export async function saveBrandStep(fd: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Only the workspace admin can complete setup." };
  const logoUrl = optStr(fd, "logoUrl");
  if (logoUrl && !/^(https:\/\/|\/uploads\/)/.test(logoUrl)) return { error: "Invalid logo image." };
  const brandColor = str(fd, "brandColor");
  if (!/^#[0-9a-f]{6}$/i.test(brandColor)) return { error: "Choose a valid brand colour." };
  await db.settings.update({ where: { organizationId: await requireOrgId() }, data: { logoUrl, brandColor } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export type InvitedMember = { name: string; email: string; role: string; password: string };

/** Step 3: create up to 5 team members with temporary passwords. */
export async function inviteTeamStep(members: { name: string; email: string; role: string }[]): Promise<ActionResult<{ created: InvitedMember[]; skipped: string[] }>> {
  const user = await requireAdmin();
  if (!user) return { error: "Only the workspace admin can add team members." };
  const list = members
    .map((m) => ({ name: m.name.trim().slice(0, 120), email: m.email.trim().toLowerCase(), role: ["ADMIN", "MANAGER", "AGENT"].includes(m.role) ? m.role : "AGENT" }))
    .filter((m) => m.name || m.email)
    .slice(0, 5);
  if (!list.length) return { error: "Add at least one team member, or skip this step." };
  for (const m of list) {
    if (m.name.length < 2) return { error: "Each team member needs a name." };
    if (!/^\S+@\S+\.\S+$/.test(m.email)) return { error: `"${m.email || m.name}" is not a valid email.` };
  }

  // Respect the plan's user limit (0 = unlimited)
  const org = await rawDb.organization.findUnique({ where: { id: user.organizationId }, select: { plan: { select: { maxUsers: true, name: true } } } });
  const current = await db.user.count({ where: { active: true } });
  const max = org?.plan?.maxUsers ?? 0;

  const created: InvitedMember[] = [];
  const skipped: string[] = [];
  for (const m of list) {
    if (max > 0 && current + created.length >= max) {
      skipped.push(`${m.email} (your ${org?.plan?.name ?? ""} plan allows ${max} users)`);
      continue;
    }
    // Emails are unique across the whole platform (one login per email)
    if (await rawDb.user.findUnique({ where: { email: m.email }, select: { id: true } })) {
      skipped.push(`${m.email} (already has an account)`);
      continue;
    }
    const password = `${randomBytes(4).toString("hex")}${Math.floor(10 + Math.random() * 89)}`;
    await db.user.create({ data: { name: m.name, email: m.email, role: m.role, password: await bcrypt.hash(password, 10) } });
    created.push({ ...m, password });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, skipped } };
}

const SAMPLE_TAG = "Sample";
const IMG = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
];

/** Step 4: optional demo data, clearly tagged "Sample", so new users can explore every screen. */
export async function loadSampleDataStep(): Promise<ActionResult<{ leads: number; properties: number }>> {
  const user = await requireAdmin();
  if (!user) return { error: "Only the workspace admin can load sample data." };
  if (await db.lead.count({ where: { tags: { contains: SAMPLE_TAG } } })) return { error: "Sample data is already loaded." };

  const codes = await db.property.findMany({ select: { code: true } });
  let next = Math.max(1000, ...codes.map((c) => Number(c.code.replace(/\D/g, "")) || 0)) + 1;
  const props = [
    { title: "Sample - 2 BHK near Metro", type: "APARTMENT", bedrooms: 2, bathrooms: 2, price: 9500000, area: 980, city: "Pune", locality: "Baner" },
    { title: "Sample - 3 BHK with Club House", type: "APARTMENT", bedrooms: 3, bathrooms: 3, price: 16500000, area: 1450, city: "Pune", locality: "Wakad" },
    { title: "Sample - Garden Villa", type: "VILLA", bedrooms: 4, bathrooms: 4, price: 32000000, area: 3100, city: "Pune", locality: "Kharadi" },
    { title: "Sample - Office Space 1200 sqft", type: "OFFICE", bedrooms: null, bathrooms: null, price: 18000000, area: 1200, city: "Pune", locality: "Hinjewadi" },
  ];
  const properties = [];
  for (let i = 0; i < props.length; i++) {
    properties.push(
      await db.property.create({
        data: {
          ...props[i],
          code: `PR-${next++}`,
          listingType: "SALE",
          status: "AVAILABLE",
          description: "Sample property created to help you explore the CRM. Delete it any time.",
          amenities: "Parking, Lift, Power Backup, Security",
          images: JSON.stringify([IMG[i]]),
          agentId: user.id,
        },
      }),
    );
  }

  const people: [string, string, string, string, number][] = [
    ["Rahul Verma", "NEW", "WEBSITE", "HOT", 10000000],
    ["Ananya Iyer", "CONTACTED", "PORTAL_99ACRES", "WARM", 17000000],
    ["Karan Mehta", "QUALIFIED", "FACEBOOK", "HOT", 33000000],
    ["Sneha Kapoor", "SITE_VISIT", "PORTAL_MAGICBRICKS", "HOT", 9800000],
    ["Vikram Rao", "NEGOTIATION", "REFERRAL", "HOT", 16000000],
    ["Pooja Shah", "NEW", "INSTAGRAM", "WARM", 8500000],
    ["Arjun Nair", "CONTACTED", "GOOGLE_ADS", "COLD", 12000000],
    ["Meera Joshi", "QUALIFIED", "PORTAL_HOUSING", "WARM", 19000000],
    ["Siddharth Patel", "WON", "WALK_IN", "HOT", 9500000],
    ["Divya Reddy", "LOST", "WEBSITE", "COLD", 7000000],
  ];
  const leads = [];
  for (let i = 0; i < people.length; i++) {
    const [name, status, source, priority, budget] = people[i];
    const lead = await db.lead.create({
      data: {
        name,
        phone: `90000${String(10000 + i * 137).slice(-5)}`,
        source,
        status,
        priority,
        purpose: "BUY",
        propertyType: i % 4 === 3 ? "OFFICE" : "APARTMENT",
        preferredLocation: `${props[i % 4].locality}, Pune`,
        bedrooms: i % 4 === 3 ? null : 2 + (i % 2),
        budgetMin: Math.round(budget * 0.85),
        budgetMax: budget,
        tags: SAMPLE_TAG,
        notes: "Sample lead - safe to delete.",
        lostReason: status === "LOST" ? "Budget mismatch" : null,
        assignedToId: user.id,
        createdById: user.id,
        lastContactedAt: status === "NEW" ? null : addDays(new Date(), -(i % 5)),
      },
    });
    leads.push(lead);
    await logActivity({ type: "CREATED", content: "Sample lead created during setup", leadId: lead.id, userId: user.id });
    if (i < 6) await db.leadProperty.create({ data: { leadId: lead.id, propertyId: properties[i % properties.length].id } });
  }

  const fu = [
    { i: 0, title: "Call new enquiry", type: "CALL", due: addHours(new Date(), 1) },
    { i: 2, title: "Share brochure on WhatsApp", type: "WHATSAPP", due: addHours(new Date(), 3) },
    { i: 3, title: "Site visit with family", type: "SITE_VISIT", due: addDays(new Date(), 1) },
    { i: 4, title: "Price discussion meeting", type: "MEETING", due: addDays(new Date(), 2) },
    { i: 1, title: "Follow-up call on shortlisted options", type: "CALL", due: addHours(new Date(), -2) },
  ];
  for (const f of fu) {
    await db.followUp.create({
      data: {
        title: f.title,
        type: f.type,
        dueAt: f.due,
        priority: "HIGH",
        leadId: leads[f.i].id,
        propertyId: f.type === "SITE_VISIT" ? properties[1].id : null,
        assignedToId: user.id,
        notes: "Sample follow-up",
      },
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { leads: leads.length, properties: properties.length } };
}

/** Removes everything created by loadSampleDataStep. */
export async function removeSampleDataStep(): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Only the workspace admin can remove sample data." };
  await db.lead.deleteMany({ where: { tags: { contains: SAMPLE_TAG }, notes: "Sample lead - safe to delete." } });
  await db.property.deleteMany({ where: { title: { startsWith: "Sample - " } } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Step 5: finish setup. */
export async function finishOnboarding() {
  const user = await requireUser();
  if (user.role === "ADMIN") {
    await rawDb.organization.update({ where: { id: user.organizationId }, data: { onboardedAt: new Date() } });
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
