"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OPEN_LEAD_STATUSES, ROLES } from "@/lib/constants";
import { optNum, optStr, str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function saveMember(id: string | null, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Only administrators can manage team members." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const phone = optStr(fd, "phone");
  const role = str(fd, "role") || "AGENT";
  const monthlyTarget = optNum(fd, "monthlyTarget") ?? 0;
  const password = str(fd, "password");

  if (!name) return { error: "Name is required." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (!ROLES.some((r) => r.value === role)) return { error: "Invalid role." };
  if (monthlyTarget < 0) return { error: "Target cannot be negative." };

  const clash = await db.user.findUnique({ where: { email } });
  if (clash && clash.id !== id) return { error: "Another member already uses this email." };

  if (id) {
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return { error: "Member not found." };
    if (existing.role === "ADMIN" && role !== "ADMIN") {
      const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) return { error: "At least one active administrator is required." };
    }
    if (password && password.length < 8) return { error: "Password must be at least 8 characters." };
    await db.user.update({
      where: { id },
      data: { name, email, phone, role, monthlyTarget, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) },
    });
  } else {
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    await db.user.create({ data: { name, email, phone, role, monthlyTarget, password: await bcrypt.hash(password, 10) } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMemberActive(id: string, active: boolean, reassignToId?: string | null): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Only administrators can manage team members." };
  if (id === admin.id && !active) return { error: "You cannot deactivate your own account." };

  const member = await db.user.findUnique({ where: { id } });
  if (!member) return { error: "Member not found." };

  if (!active && member.role === "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) return { error: "At least one active administrator is required." };
  }

  if (!active && reassignToId) {
    if (reassignToId === id) return { error: "Choose a different member to reassign to." };
    const target = await db.user.findFirst({ where: { id: reassignToId, active: true } });
    if (!target) return { error: "Reassignment target not found." };
    await db.$transaction([
      db.lead.updateMany({ where: { assignedToId: id, status: { in: OPEN_LEAD_STATUSES } }, data: { assignedToId: reassignToId } }),
      db.followUp.updateMany({ where: { assignedToId: id, status: "PENDING" }, data: { assignedToId: reassignToId } }),
    ]);
  }

  await db.user.update({ where: { id }, data: { active } });
  revalidatePath("/", "layout");
  return { ok: true };
}
