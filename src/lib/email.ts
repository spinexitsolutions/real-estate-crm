import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: Transporter | null = null;
function getTransport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "Email (SMTP) is not configured." };
  try {
    await getTransport().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    return { ok: true };
  } catch (e) {
    console.error("sendEmail failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Branded, table-based email layout that renders well in Gmail/Outlook. `body` is trusted HTML. */
export function emailLayout({ company, heading, body, cta }: { company: string; heading: string; body: string; cta?: { label: string; url: string } }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#4f46e5;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:600">${escapeHtml(company)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#0f172a">${escapeHtml(heading)}</h1>
<div style="font-size:14px;line-height:22px;color:#334155">${body}</div>
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:#4f46e5;border-radius:8px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:11px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">${escapeHtml(cta.label)}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">Sent by EstateDesk CRM. You can change notification preferences from your profile.</td></tr>
</table></td></tr></table></body></html>`;
}

export function appUrl(fallbackOrigin?: string) {
  return (process.env.APP_URL || fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
}
