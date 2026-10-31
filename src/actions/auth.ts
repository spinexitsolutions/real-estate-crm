"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { str } from "@/lib/utils";

export type FormState = { error?: string } | undefined;

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "Please enter your email and password." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Invalid email or password." };
  }
  if (!user.active) return { error: "Your account has been deactivated. Contact your administrator." };

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
