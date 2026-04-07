import nodemailer from "nodemailer";

import { getSiteUrl } from "@/lib/site-url";

export interface NotificationEmailDeliveryInput {
  recipientEmail: string;
  recipientName: string;
  title: string;
  message: string;
  link?: string | null;
}

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getEmailTransporter() {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !from) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  const port = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "587", 10);
  const secure =
    process.env.SMTP_SECURE?.trim() === "true" ||
    (!Number.isNaN(port) && port === 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number.isNaN(port) ? 587 : port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return cachedTransporter;
}

function normalizeNotificationLink(link?: string | null) {
  const normalizedLink = link?.trim();

  if (!normalizedLink) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedLink)) {
    return normalizedLink;
  }

  return `${getSiteUrl()}${normalizedLink.startsWith("/") ? normalizedLink : `/${normalizedLink}`}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailContent(input: NotificationEmailDeliveryInput) {
  const absoluteLink = normalizeNotificationLink(input.link);
  const safeRecipientName = escapeHtml(input.recipientName);
  const safeTitle = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);

  return {
    subject: `[SafeLoot] ${input.title}`,
    text: [
      `Здравствуйте, ${input.recipientName}!`,
      "",
      input.title,
      input.message,
      absoluteLink ? `Открыть: ${absoluteLink}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="background:#09090b;padding:32px 20px;font-family:Arial,sans-serif;color:#f4f4f5;">
        <div style="max-width:560px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:24px;background:rgba(24,24,27,0.96);overflow:hidden;">
          <div style="padding:24px 24px 12px;">
            <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#fdba74;">SafeLoot Notifications</div>
            <h1 style="margin:14px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">${safeTitle}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">Здравствуйте, ${safeRecipientName}.</p>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${safeMessage}</p>
            ${absoluteLink ? `<a href="${absoluteLink}" style="display:inline-block;margin-top:20px;padding:12px 18px;border-radius:14px;background:#ea580c;color:#ffffff;font-weight:700;text-decoration:none;">Открыть в SafeLoot</a>` : ""}
          </div>
          <div style="padding:16px 24px 24px;font-size:12px;line-height:1.7;color:#71717a;">
            Вы получили это письмо, потому что email-уведомления включены в настройках профиля.
          </div>
        </div>
      </div>
    `,
  };
}

export async function sendNotificationEmail(input: NotificationEmailDeliveryInput) {
  const transporter = getEmailTransporter();
  const from = process.env.SMTP_FROM?.trim();

  if (!transporter || !from) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: "SMTP is not configured.",
    };
  }

  const content = buildEmailContent(input);

  await transporter.sendMail({
    from,
    to: input.recipientEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return {
    ok: true as const,
    skipped: false as const,
  };
}

export async function sendNotificationEmails(inputs: NotificationEmailDeliveryInput[]) {
  if (inputs.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    inputs.map((input) => sendNotificationEmail(input)),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[NOTIFICATION_EMAIL_ERROR]", result.reason);
    }
  }
}