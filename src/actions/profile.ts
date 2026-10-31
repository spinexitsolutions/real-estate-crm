"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { optStr, str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const name = str(fd, "name");
  if (!name) return { error: "Name is required." };
  const updated = await db.user.update({ where: { id: user.id }, data: { name, phone: optStr(fd, "phone") } });
  await createSession(updated);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const current = str(fd, "currentPassword");
  const next = str(fd, "newPassword");
  const confirm = str(fd, "confirmPassword");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record || !(await bcrypt.compare(current, record.password))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10) } });
  return { ok: true };
}
