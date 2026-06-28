import { Resend } from "resend";

// Sender address. Resend requires the domain in this address to be verified at
// https://resend.com/domains before it will deliver mail. Override via EMAIL_FROM
// (e.g. "Izichanj <onboarding@resend.dev>") if the custom domain isn't verified yet.
const FROM = process.env.EMAIL_FROM || "Izichanj <no-reply@izichanj.com>";

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOtpHtml(opts: { title: string; intro: string; code: string; footer: string; recipientName?: string | null }): string {
  const greeting = opts.recipientName ? `Hi ${escapeHtml(opts.recipientName)},` : "Hi,";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#111111;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ffffff">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:32px 10px">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#1a1a1a;border:1px solid #D4AF37;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.5)">
        <tr><td style="padding:30px 30px 0 30px">
          <div style="text-align:center;margin-bottom:25px">
            <h1 style="color:#D4AF37;margin:0;font-size:28px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Izichanj</h1>
            <div style="height:2px;width:60px;background-color:#D4AF37;margin:10px auto 0 auto"></div>
          </div>
        </td></tr>
        <tr><td style="padding:0 30px 30px 30px">
          <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin-top:0;margin-bottom:6px">${escapeHtml(opts.title)}</h2>
          <p style="font-size:15px;line-height:1.6;color:#dddddd;margin:0 0 6px 0">${greeting}</p>
          <p style="font-size:15px;line-height:1.6;color:#dddddd;margin:0 0 18px 0">${escapeHtml(opts.intro)}</p>
          <div style="background-color:#111111;border:1px dashed #D4AF37;padding:20px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;border-radius:8px;margin:25px 0;color:#D4AF37;font-family:'SF Mono',Menlo,Consolas,monospace">${escapeHtml(opts.code)}</div>
          <p style="font-size:14px;line-height:1.5;color:#b3b3b3;margin:0 0 6px 0">Expires in 5 minutes. Don't share it with anyone.</p>
          <p style="font-size:14px;line-height:1.5;color:#b3b3b3;margin:0">${escapeHtml(opts.footer)}</p>
          <p style="color:#a0a0a0;font-size:12px;line-height:1.6;text-align:center;margin-top:30px;border-top:1px solid #333;padding-top:20px">
            If you didn't request this, you can safely ignore this email.<br>
            &copy; 2026 Izichanj. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = getClient();
  if (!c) {
    console.log(`[EMAIL] (mock — no RESEND_API_KEY) To: ${opts.to} | ${opts.subject}\n${opts.text}`);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const result = await c.emails.send({
      from: FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if ((result as any)?.error) {
      const err = (result as any).error;
      console.error(`[EMAIL ERROR] Resend rejected mail to ${opts.to}:`, err);
      return { ok: false, error: typeof err === "string" ? err : (err?.message || "Resend error") };
    }
    const id = (result as any)?.data?.id || (result as any)?.id;
    console.log(`[EMAIL] Sent "${opts.subject}" to ${opts.to}${id ? ` (id ${id})` : ""}`);
    return { ok: true, id };
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Failed to send to ${opts.to}:`, err?.message || err);
    return { ok: false, error: err?.message || "Send failed" };
  }
}

export async function sendVerificationEmail(to: string, code: string, name?: string | null) {
  const subject = "Verify your Izichanj account";
  const html = buildOtpHtml({
    title: "Account verification",
    intro: "Welcome to Izichanj! Use the 6-digit code below to verify your email address and finish setting up your account.",
    code,
    footer: "If you did not create an Izichanj account, you can safely ignore this email.",
    recipientName: name,
  });
  const text = `Welcome to Izichanj!\n\nYour verification code is: ${code}\n\nThis code expires in 5 minutes. If you didn't create an account, ignore this email.`;
  return send({ to, subject, html, text });
}

// ────────────────────────────────────────────────────────────────────
// Generic notification email — used to mirror every WhatsApp message
// to the user's inbox so they still receive notifications if they ever
// change their WhatsApp number.
// ────────────────────────────────────────────────────────────────────

// Strip the standard "*Izichanj*\n\n" header and convert basic WhatsApp
// markup (*bold*) into HTML. Returns { title, bodyHtml, bodyText }.
function parseWhatsAppMessage(message: string): { title: string; bodyHtml: string; bodyText: string } {
  let text = String(message || "").trim();
  // Drop the leading "*Izichanj*\n\n" or "*Izichanj — ...*\n\n" header — the
  // email template already brands itself.
  text = text.replace(/^\*Izichanj[^\n*]*\*\s*\n+/i, "");
  // Drop the trailing canonical https://izichanj.com line if present.
  text = text.replace(/\n+https?:\/\/izichanj\.com\/?\s*$/i, "");

  // First non-empty line becomes the title (e.g. "✅ Deposit Approved").
  const lines = text.split("\n");
  let title = "Notification from Izichanj";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) continue;
    title = ln.replace(/\*/g, "");
    bodyStart = i + 1;
    break;
  }
  const bodyText = lines.slice(bodyStart).join("\n").trim();

  // *bold* → <strong>bold</strong>; URLs → links; newlines → <br>.
  const escaped = escapeHtml(bodyText)
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5;text-decoration:none">$1</a>')
    .replace(/\n/g, "<br>");
  return { title, bodyHtml: escaped, bodyText };
}

function buildNotificationHtml(opts: { title: string; bodyHtml: string; recipientName?: string | null }): string {
  const greeting = opts.recipientName ? `Hi ${escapeHtml(opts.recipientName)},` : "Hi,";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06)">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 28px;color:#ffffff">
          <div style="font-size:22px;font-weight:700;letter-spacing:0.2px">Izichanj</div>
          <div style="font-size:13px;opacity:0.85;margin-top:2px">Crypto to Cash, simplified.</div>
        </td></tr>
        <tr><td style="padding:28px">
          <div style="font-size:18px;font-weight:600;color:#0f172a;margin-bottom:6px">${escapeHtml(opts.title)}</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:18px">${greeting}</div>
          <div style="font-size:15px;line-height:1.6;color:#334155">${opts.bodyHtml}</div>
          <div style="margin-top:24px">
            <a href="https://izichanj.com" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">Open Izichanj</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
          You're receiving this email because notifications are enabled on your Izichanj account.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendNotificationEmail(to: string, message: string, name?: string | null) {
  if (!to) return { ok: false, error: "no recipient" };
  const { title, bodyHtml, bodyText } = parseWhatsAppMessage(message);
  const html = buildNotificationHtml({ title, bodyHtml, recipientName: name });
  const text = `${title}\n\n${bodyText}\n\nhttps://izichanj.com`;
  return send({ to, subject: `${title} — Izichanj`, html, text });
}

export async function sendMediaNotificationEmail(to: string, fileUrl: string, fileName: string, caption: string | undefined, name?: string | null) {
  if (!to) return { ok: false, error: "no recipient" };
  const captionText = (caption || "").trim();
  const { title, bodyHtml } = captionText
    ? parseWhatsAppMessage(captionText)
    : { title: `Attachment from Izichanj`, bodyHtml: `You have received a new attachment.` };
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
  const attachmentBlock = isImage
    ? `<div style="margin:18px 0"><img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(fileName)}" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0"></div>`
    : `<div style="margin:18px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px"><div style="font-size:13px;color:#64748b;margin-bottom:6px">📎 Attachment</div><a href="${escapeHtml(fileUrl)}" style="color:#4f46e5;text-decoration:none;font-weight:500">${escapeHtml(fileName)}</a></div>`;
  const html = buildNotificationHtml({
    title,
    bodyHtml: `${bodyHtml}${attachmentBlock}`,
    recipientName: name,
  });
  const text = `${title}\n\n${captionText}\n\nAttachment: ${fileName}\n${fileUrl}`;
  return send({ to, subject: `${title} — Izichanj`, html, text });
}

// ────────────────────────────────────────────────────────────────────
// Newsletter — opt-in marketing email. Admin writes the subject/body,
// the helper auto-prepends "Hi {name}," and auto-appends a footer with
// the canonical https://izichanj.com link. Body is plain text with basic
// *bold* markup and newline preservation, never HTML from the admin.
// ────────────────────────────────────────────────────────────────────
function buildNewsletterHtml(opts: { subject: string; body: string; recipientName?: string | null }): string {
  const greeting = `Hi ${escapeHtml(opts.recipientName || "there")},`;
  const bodyHtml = escapeHtml(opts.body)
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5;text-decoration:none">$1</a>')
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06)">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;color:#ffffff">
          <div style="font-size:24px;font-weight:700;letter-spacing:0.2px">Izichanj</div>
          <div style="font-size:13px;opacity:0.85;margin-top:2px">Crypto to Cash, simplified.</div>
        </td></tr>
        <tr><td style="padding:32px">
          <div style="font-size:20px;font-weight:600;color:#0f172a;margin-bottom:6px">${escapeHtml(opts.subject)}</div>
          <div style="font-size:14px;color:#64748b;margin-bottom:22px">${greeting}</div>
          <div style="font-size:15px;line-height:1.7;color:#334155">${bodyHtml}</div>
          <div style="margin:28px 0 6px 0">
            <a href="https://izichanj.com" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:500">Visit Izichanj</a>
          </div>
          <div style="font-size:13px;color:#94a3b8;margin-top:24px">— The Izichanj Team<br>
            <a href="https://izichanj.com" style="color:#64748b;text-decoration:none">https://izichanj.com</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
          You're receiving this because you subscribed to the Izichanj newsletter.<br>
          You can unsubscribe anytime from your Izichanj profile page.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendNewsletterEmail(to: string, name: string | null | undefined, subject: string, body: string) {
  if (!to) return { ok: false, error: "no recipient" };
  const html = buildNewsletterHtml({ subject, body, recipientName: name });
  const greeting = `Hi ${name || "there"},`;
  const text = `${greeting}\n\n${body}\n\n— The Izichanj Team\nhttps://izichanj.com\n\nYou're receiving this because you subscribed to the Izichanj newsletter. You can unsubscribe anytime from your Izichanj profile.`;
  return send({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, code: string, name?: string | null) {
  const subject = "Your Izichanj password reset code";
  const html = buildOtpHtml({
    title: "Password reset",
    intro: "We received a request to reset your Izichanj password. Use the 6-digit code below to set a new password.",
    code,
    footer: "If you did not request a password reset, you can safely ignore this email — your password will not change.",
    recipientName: name,
  });
  const text = `Izichanj password reset\n\nYour reset code is: ${code}\n\nThis code expires in 5 minutes. If you didn't request a reset, ignore this email.`;
  return send({ to, subject, html, text });
}
