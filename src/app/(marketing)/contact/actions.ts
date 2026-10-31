"use server";

import { headers } from "next/headers";
import { rawDb } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email";
import { str } from "@/lib/utils";

export type ContactState = { ok?: boolean; error?: string } | undefined;

const MAX_PER_HOUR = 3;

/** Public contact form: emails the support inbox. Rate limited per IP, with a honeypot for bots. */
export async function sendContactMessage(_: ContactState, fd: FormData): Promise<ContactState> {
  if (str(fd, "website")) return { ok: true }; // honeypot
  const name = str(fd, "name").slice(0, 120);
  const email = str(fd, "email").slice(0, 160);
  const phone = str(fd, "phone").slice(0, 20);
  const company = str(fd, "company").slice(0, 120);
  const topic = str(fd, "topic").slice(0, 60) || "General";
  const message = str(fd, "message").slice(0, 3000);

  if (name.length < 2) return { error: "Please enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };
  if (message.length < 10) return { error: "Please write a short message (at least 10 characters)." };
  if (!isEmailConfigured()) return { error: `Our contact form is not available right now. Please email ${BRAND.supportEmail} directly.` };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const key = `contact:${ip}`;
  const recent = await rawDb.loginAttempt.count({ where: { key, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= MAX_PER_HOUR) return { error: "You have sent several messages recently. Please try again in an hour or email us directly." };
  await rawDb.loginAttempt.create({ data: { key, success: true } });

  const rows = [
    ["Name", name],
    ["Email", email],
    ["Phone", phone || "-"],
    ["Company", company || "-"],
    ["Topic", topic],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0;color:#0f172a">${escapeHtml(v)}</td></tr>`)
    .join("");
  const res = await sendEmail({
    to: BRAND.supportEmail,
    subject: `[${BRAND.name}] ${topic} - ${name}${company ? ` (${company})` : ""}`,
    html: emailLayout({
      company: BRAND.name,
      heading: "New contact form message",
      body: `<table style="font-size:14px;margin-bottom:16px">${rows}</table><p style="white-space:pre-wrap;margin:0;color:#0f172a">${escapeHtml(message)}</p>`,
    }),
    text: `${name} <${email}> ${phone}\n${company}\n${topic}\n\n${message}`,
  });
  if (!res.ok) return { error: `We could not send your message. Please email ${BRAND.supportEmail} directly.` };
  return { ok: true };
}
