"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rawDb } from "@/lib/db";
import { createOrganization } from "@/lib/tenancy";
import { createSession, destroySession } from "@/lib/auth";
import { str } from "@/lib/utils";

export type FormState = { error?: string } | undefined;

const WINDOW_MIN = 15;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;
// bcrypt hash of a random string, used so unknown emails take as long as wrong passwords
const DUMMY_HASH = "$2b$10$NBZlU/QuzF7f8LcgsLBWRezEMblO3Nyrjv8nFXN57/ioYzRu.Hsuy";

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

async function rateLimited(email: string, ip: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60000);
  const [byEmail, byIp] = await Promise.all([
    rawDb.loginAttempt.findMany({ where: { key: `email:${email}`, success: false, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    rawDb.loginAttempt.findMany({ where: { key: `ip:${ip}`, success: false, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const list = byEmail.length >= MAX_PER_EMAIL ? byEmail.slice(-MAX_PER_EMAIL) : byIp.length >= MAX_PER_IP ? byIp.slice(-MAX_PER_IP) : null;
  if (!list) return 0;
  const unlockAt = list[0].createdAt.getTime() + WINDOW_MIN * 60000;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60000));
}

async function recordAttempt(email: string, ip: string, success: boolean) {
  await rawDb.loginAttempt.createMany({
    data: [
      { key: `email:${email}`, success },
      { key: `ip:${ip}`, success },
    ],
  });
  if (success) await rawDb.loginAttempt.deleteMany({ where: { key: `email:${email}`, success: false } });
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "Please enter your email and password." };

  const ip = await clientIp();
  const wait = await rateLimited(email, ip);
  if (wait) return { error: `Too many attempts. Try again in ${wait} minute${wait > 1 ? "s" : ""}.` };

  // Login happens before we know the company, so look the user up across all organizations.
  const user = await rawDb.user.findUnique({ where: { email }, include: { organization: { select: { status: true } } } });
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordAttempt(email, ip, false);
    return { error: "Invalid email or password." };
  }
  if (!user.active) return { error: "Your account has been deactivated. Contact your administrator." };
  // Suspended companies can still sign in: the app shows them a "contact support" screen.

  await recordAttempt(email, ip, true);
  await createSession(user);
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const companyName = str(fd, "company");
  const ownerName = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const phone = str(fd, "phone");
  if (!companyName || !ownerName || !email || !password) return { error: "Please fill in all required fields." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (phone && phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid mobile number." };

  // Basic abuse protection: max 5 signups per IP per hour
  const ip = await clientIp();
  const recent = await rawDb.loginAttempt.count({ where: { key: `signup:${ip}`, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= 5) return { error: "Too many sign-ups from this network. Please try again later." };
  await rawDb.loginAttempt.create({ data: { key: `signup:${ip}`, success: true } });

  let created;
  try {
    created = await createOrganization({
      companyName,
      ownerName,
      email,
      password,
      phone: phone || null,
      city: str(fd, "city") || null,
      businessType: str(fd, "businessType") || null,
      teamSize: str(fd, "teamSize") || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create your account. Please try again." };
  }
  // Plan chosen on the pricing page (/signup?plan=CODE): trial runs on that plan
  const planCode = str(fd, "plan").toUpperCase();
  if (planCode) {
    const plan = await rawDb.plan.findFirst({ where: { code: planCode, active: true }, select: { id: true } });
    if (plan) await rawDb.organization.update({ where: { id: created.org.id }, data: { planId: plan.id } });
  }
  await createSession(created.user);
  redirect("/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
