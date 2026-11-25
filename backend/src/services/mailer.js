import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/**
 * Email delivery.
 *  - MAIL_TRANSPORT=smtp    → real SMTP (Gmail app password, SendGrid, Mailgun, SES SMTP…)
 *  - MAIL_TRANSPORT=console → messages are printed to the API console (development)
 *  - MAIL_TRANSPORT=none    → email disabled (default when SMTP_HOST is not set)
 */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { transport, host, port, secure, user, pass } = env.mail;
  if (transport === "smtp") {
    transporter = nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined });
  } else if (transport === "console") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export const mailEnabled = () => env.mail.transport === "smtp" || env.mail.transport === "console";

const escapeHtml = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Simple branded HTML wrapper. */
export function layout(title, bodyHtml, cta) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#2546ea;color:#fff;padding:18px 24px;font-size:18px;font-weight:600">Attendify</td></tr>
    <tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
      <div style="font-size:14px;line-height:1.6;color:#334155">${bodyHtml}</div>
      ${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="background:#2546ea;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>` : ""}
    </td></tr>
    <tr><td style="padding:14px 24px;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9">This is an automated message from your college ERP.</td></tr>
  </table></td></tr></table></body></html>`;
}

/** Send an email. Returns true if handed to the transport. Never throws. */
export async function sendMail({ to, bcc, subject, text, html }) {
  const t = getTransporter();
  if (!t || !to || (Array.isArray(to) && !to.length)) return false;
  try {
    await t.sendMail({ from: env.mail.from, to, bcc, subject, text, html });
    if (env.mail.transport === "console") {
      const recipients = [].concat(to, bcc || []).join(", ");
      console.log(`[mail] to: ${recipients} | subject: ${subject}\n${text || ""}\n`);
    }
    return true;
  } catch (err) {
    console.error("Email failed:", err.message);
    return false;
  }
}

export { escapeHtml };
