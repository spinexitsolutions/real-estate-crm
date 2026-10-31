"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db, requireOrgId } from "@/lib/db";
import { optNum, optStr, str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

const CURRENCIES = ["INR", "USD", "AED", "GBP", "EUR"];

async function guard() {
  const u = await getCurrentUser();
  return u && u.role === "ADMIN" ? u : null;
}

async function upsert(data: Record<string, unknown>) {
  await db.settings.upsert({ where: { organizationId: await requireOrgId() }, create: { ...data }, update: data });
  revalidatePath("/", "layout");
}

export async function saveCompany(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change settings." };
  const companyName = str(fd, "companyName");
  if (!companyName) return { error: "Company name is required." };
  const companyEmail = optStr(fd, "companyEmail");
  if (companyEmail && !/^\S+@\S+\.\S+$/.test(companyEmail)) return { error: "Please enter a valid email." };
  await upsert({ companyName, companyPhone: optStr(fd, "companyPhone"), companyEmail, companyAddress: optStr(fd, "companyAddress") });
  return { ok: true };
}

export async function savePreferences(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change settings." };
  const currency = str(fd, "currency");
  if (!CURRENCIES.includes(currency)) return { error: "Unsupported currency." };
  const defaultCountryCode = str(fd, "defaultCountryCode").replace(/\D/g, "");
  if (!defaultCountryCode || defaultCountryCode.length > 4) return { error: "Enter a valid country code, e.g. 91." };
  const defaultCommission = optNum(fd, "defaultCommission") ?? 0;
  if (defaultCommission < 0 || defaultCommission > 100) return { error: "Commission must be between 0 and 100." };
  await upsert({ currency, defaultCountryCode, defaultCommission });
  return { ok: true };
}

export async function saveWhatsApp(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change settings." };
  const waApiEnabled = fd.get("waApiEnabled") === "on";
  const waPhoneNumberId = optStr(fd, "waPhoneNumberId");
  const tokenInput = str(fd, "waAccessToken");
  const current = await db.settings.findFirst();
  const waAccessToken = tokenInput || current?.waAccessToken || null;
  if (waApiEnabled && (!waPhoneNumberId || !waAccessToken)) {
    return { error: "Phone number ID and access token are required to enable the API." };
  }
  const waVerifyToken = optStr(fd, "waVerifyToken");
  if (waVerifyToken && waVerifyToken.length < 8) return { error: "Verify token should be at least 8 characters." };
  const secretInput = str(fd, "waAppSecret");
  const waAppSecret = secretInput || current?.waAppSecret || null;
  const waDigestTemplate = optStr(fd, "waDigestTemplate")?.toLowerCase().replace(/[^a-z0-9_]/g, "_") ?? null;
  await upsert({ waApiEnabled, waPhoneNumberId, waAccessToken, waVerifyToken, waAppSecret, waDigestTemplate });
  return { ok: true };
}

export async function regenerateWebhookKey(): Promise<ActionResult<string>> {
  if (!(await guard())) return { error: "Only administrators can change settings." };
  const key = randomBytes(16).toString("hex");
  await upsert({ leadWebhookKey: key });
  return { ok: true, data: key };
}

export async function savePaymentSettings(fd: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "Only administrators can change settings." };
  const receiptPrefix = str(fd, "receiptPrefix").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  if (!receiptPrefix) return { error: "Receipt prefix is required." };
  const next = optNum(fd, "nextReceiptNo");
  if (next !== null && (!Number.isInteger(next) || next < 1)) return { error: "Next receipt number must be a positive whole number." };
  const current = await db.settings.findFirst({ select: { nextReceiptNo: true } });
  if (next !== null && current && next < current.nextReceiptNo) {
    // Never allow reusing receipt numbers that may already be issued
    const clash = await db.payment.findFirst({ where: { receiptNo: `${receiptPrefix}-${next}` } });
    if (clash) return { error: `Receipt ${receiptPrefix}-${next} already exists. Choose a higher number.` };
  }
  await upsert({ receiptPrefix, waPaymentTemplate: optStr(fd, "waPaymentTemplate"), ...(next !== null ? { nextReceiptNo: next } : {}) });
  return { ok: true };
}
