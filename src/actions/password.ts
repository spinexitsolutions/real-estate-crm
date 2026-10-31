"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { appUrl, emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { str } from "@/lib/utils";

export type PasswordFormState = { error?: string; message?: string } | undefined;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const GENERIC = "If an account exists for that email, a password reset link has been sent. The link is valid for 1 hour.";

export async function requestPasswordReset(_: PasswordFormState, fd: FormData): Promise<PasswordFormState> {
  const email = str(fd, "email").toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (!isEmailConfigured()) {
    return { error: "Email is not set up for this workspace. Ask your administrator to reset your password from the Team page." };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user && user.active) {
    // Throttle: at most 3 reset emails per hour per user
    const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (recent < 3) {
      const token = randomBytes(32).toString("hex");
      await db.passwordResetToken.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
      const h = await headers();
      const origin = h.get("origin") || (h.get("host") ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}` : undefined);
      const link = `${appUrl(origin)}/reset-password?token=${token}`;
      const settings = await getSettings();
      await sendEmail({
        to: user.email,
        subject: "Reset your EstateDesk password",
        html: emailLayout({
          company: settings.companyName,
          heading: "Reset your password",
          body: `<p style="margin:0 0 12px">Hi ${escapeHtml(user.name.split(" ")[0])},</p><p style="margin:0 0 12px">We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in 1 hour.</p><p style="margin:0;color:#64748b">If you did not request this, you can safely ignore this email.</p>`,
          cta: { label: "Reset password", url: link },
        }),
      });
    }
  }
  return { message: GENERIC };
}

export async function resetPassword(_: PasswordFormState, fd: FormData): Promise<PasswordFormState> {
  const token = str(fd, "token");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  if (!token) return { error: "This reset link is invalid." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.active) {
    return { error: "This reset link has expired or was already used. Please request a new one." };
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { password: await bcrypt.hash(password, 10) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
    db.loginAttempt.deleteMany({ where: { key: `email:${record.user.email}` } }),
  ]);
  redirect("/login?reset=1");
}

export async function isResetTokenValid(token: string) {
  if (!token) return false;
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hash(token) }, select: { usedAt: true, expiresAt: true } });
  return !!record && !record.usedAt && record.expiresAt > new Date();
}
