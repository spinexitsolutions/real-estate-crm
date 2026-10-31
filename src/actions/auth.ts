"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
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
    db.loginAttempt.findMany({ where: { key: `email:${email}`, success: false, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.loginAttempt.findMany({ where: { key: `ip:${ip}`, success: false, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const list = byEmail.length >= MAX_PER_EMAIL ? byEmail.slice(-MAX_PER_EMAIL) : byIp.length >= MAX_PER_IP ? byIp.slice(-MAX_PER_IP) : null;
  if (!list) return 0;
  const unlockAt = list[0].createdAt.getTime() + WINDOW_MIN * 60000;
  return Math.max(1, Math.ceil((unlockAt - Date.now()) / 60000));
}

async function recordAttempt(email: string, ip: string, success: boolean) {
  await db.loginAttempt.createMany({
    data: [
      { key: `email:${email}`, success },
      { key: `ip:${ip}`, success },
    ],
  });
  if (success) await db.loginAttempt.deleteMany({ where: { key: `email:${email}`, success: false } });
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "Please enter your email and password." };

  const ip = await clientIp();
  const wait = await rateLimited(email, ip);
  if (wait) return { error: `Too many attempts. Try again in ${wait} minute${wait > 1 ? "s" : ""}.` };

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordAttempt(email, ip, false);
    return { error: "Invalid email or password." };
  }
  if (!user.active) return { error: "Your account has been deactivated. Contact your administrator." };

  await recordAttempt(email, ip, true);
  await createSession(user);
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const count = await db.user.count();
  if (count > 0) return { error: "Registration is closed. Ask your administrator to add you to the team." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const company = str(fd, "company");
  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const user = await db.user.create({
    data: { name, email, password: await bcrypt.hash(password, 10), role: "ADMIN" },
  });
  await db.settings.upsert({
    where: { id: 1 },
    create: { id: 1, companyName: company || "My Realty" },
    update: company ? { companyName: company } : {},
  });
  await createSession(user);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
