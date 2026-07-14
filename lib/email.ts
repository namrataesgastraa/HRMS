import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (transporter) return transporter;
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT ?? 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    ...(process.env.EMAIL_ALLOW_SELF_SIGNED === "true"
      ? { tls: { rejectUnauthorized: false } }
      : {}),
  });
  return transporter;
}

/**
 * MAINTENANCE KILL-SWITCH.
 * Emails are OFF unless `EMAILS_ENABLED=true` is set in the environment (Vercel).
 * To re-enable notification emails later: add the env var EMAILS_ENABLED=true
 * in Vercel → Settings → Environment Variables, then redeploy. No code change.
 */
const emailsEnabled = process.env.EMAILS_ENABLED === "true";

/** Send a branded notification email. Fails soft (never throws to the caller). */
export async function sendMail(
  to: string[],
  subject: string,
  html: string,
): Promise<void> {
  if (!emailsEnabled) {
    console.log("sendMail SKIPPED (emails disabled for maintenance):", subject);
    return;
  }
  const recipients = [...new Set(to.filter(Boolean))];
  if (recipients.length === 0) return;
  const t = getTransport();
  if (!t) return;
  // Plain-text fallback (multipart mail is treated as more legitimate).
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  try {
    await t.sendMail({
      from: `ESG Astraa HRMS <${process.env.EMAIL_USER}>`,
      to: recipients.join(", "),
      replyTo: process.env.EMAIL_ADMIN || process.env.EMAIL_USER,
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
      },
    });
    console.log("sendMail OK →", recipients.join(", "));
  } catch (err) {
    console.error("sendMail failed:", err);
  }
}

/** Simple branded HTML wrapper. */
export function emailTemplate(opts: {
  heading: string;
  actor: string;
  body: string;
  link?: string;
}): string {
  const { heading, actor, body, link } = opts;
  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f3f4f6;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
      <div style="background:linear-gradient(135deg,#7516EA,#2E94F3);padding:18px 24px;color:#fff;font-weight:800;font-size:16px">
        ESG Astraa · HRMS
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 8px;color:#232234;font-size:18px">${heading}</h2>
        <p style="margin:0 0 4px;color:#6b7280;font-size:13px">By ${actor}</p>
        <p style="margin:12px 0;color:#232234;font-size:14px;line-height:1.5">${body}</p>
        ${
          link
            ? `<a href="${link}" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#7516EA,#2E94F3);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px">Open in HRMS</a>`
            : ""
        }
      </div>
      <div style="padding:14px 24px;color:#9ca3af;font-size:11px;border-top:1px solid #f3f4f6">
        Automated notification from ESG Astraa HRMS.
      </div>
    </div>
  </div>`;
}
