import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
const resendFromEmail = "onboarding@resend.dev";
const VERIFICATION_EMAIL_SEND_ERROR_MESSAGE =
  "Не удалось отправить письмо. Попробуйте позже.";

export const resend = new Resend(resendApiKey);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendVerificationEmail(email: string, token: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://safeloot-mvp-app.vercel.app"
  )
    .trim()
    .replace(/\/$/, "");

  if (!normalizedEmail) {
    throw new Error("Email is required for verification delivery.");
  }

  if (!normalizedToken) {
    throw new Error("Verification token is required.");
  }

  if (!resendApiKey) {
    throw new Error(VERIFICATION_EMAIL_SEND_ERROR_MESSAGE);
  }

  const verificationUrl = `${baseUrl}/auth/verify?token=${normalizedToken}`;
  const safeEmail = escapeHtml(normalizedEmail);

  try {
    const result = await resend.emails.send({
      from: resendFromEmail,
      to: normalizedEmail,
      subject: "Подтвердите email в SafeLoot",
      html: `
        <div style="margin:0;padding:32px 16px;background:#09090b;font-family:Arial,sans-serif;color:#f4f4f5;">
          <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:28px;overflow:hidden;background:linear-gradient(180deg,rgba(24,24,27,0.98),rgba(12,12,14,0.98));box-shadow:0 24px 80px rgba(0,0,0,0.35);">
            <div style="padding:32px 32px 24px;background:radial-gradient(circle at top left,rgba(249,115,22,0.22),transparent 32%),radial-gradient(circle at bottom right,rgba(14,165,233,0.18),transparent 38%);">
              <div style="display:inline-flex;padding:8px 14px;border-radius:999px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.18);font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#fdba74;">SafeLoot Security</div>
              <h1 style="margin:18px 0 0;font-size:30px;line-height:1.15;color:#ffffff;">Подтвердите ваш email</h1>
              <p style="margin:16px 0 0;font-size:16px;line-height:1.75;color:#d4d4d8;">Мы используем подтверждение почты, чтобы защитить маркетплейс от фейковых аккаунтов, мошенничества и спам-рассылок.</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#d4d4d8;">Аккаунт <strong style="color:#ffffff;">${safeEmail}</strong> сможет получать email-уведомления и размещать товары только после верификации.</p>
              <a href="${verificationUrl}" style="display:inline-block;margin-top:24px;padding:14px 20px;border-radius:16px;background:#ea580c;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Подтвердить email</a>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#a1a1aa;">Если кнопка не открывается, используйте прямую ссылку:</p>
              <p style="margin:8px 0 0;word-break:break-all;font-size:13px;line-height:1.7;color:#93c5fd;">${verificationUrl}</p>
            </div>
            <div style="padding:0 32px 32px;font-size:12px;line-height:1.8;color:#71717a;">
              Если вы не регистрировались в SafeLoot, просто проигнорируйте это письмо.
            </div>
          </div>
        </div>
      `,
      text: [
        "Подтвердите ваш email в SafeLoot.",
        "",
        `Перейдите по ссылке: ${verificationUrl}`,
        "",
        "Если вы не регистрировались в SafeLoot, проигнорируйте это письмо.",
      ].join("\n"),
    });

    if (result.error) {
      throw new Error(VERIFICATION_EMAIL_SEND_ERROR_MESSAGE);
    }
  } catch (error) {
    console.error("[SEND_VERIFICATION_EMAIL_ERROR]", error);
    throw new Error(VERIFICATION_EMAIL_SEND_ERROR_MESSAGE);
  }
}