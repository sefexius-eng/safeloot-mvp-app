"use server";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { sendVerificationEmailToUser } from "@/lib/email-verification";

interface SendVerificationEmailActionResult {
  ok: boolean;
  message: string;
  email?: string;
}

export async function sendVerificationEmailAction(): Promise<SendVerificationEmailActionResult> {
  const currentUser = await getCurrentSessionUser(await getAuthSession());

  if (!currentUser) {
    return {
      ok: false,
      message: "Требуется авторизация.",
    };
  }

  if (currentUser.isBanned) {
    return {
      ok: false,
      message: BANNED_USER_MESSAGE,
    };
  }

  try {
    const result = await sendVerificationEmailToUser(currentUser.id);

    if (result.status === "already-verified") {
      return {
        ok: true,
        message: "Email уже подтвержден.",
        email: result.email,
      };
    }

    return {
      ok: true,
      message: `Письмо отправлено на ${result.email}.`,
      email: result.email,
    };
  } catch (error) {
    console.error("[SEND_VERIFICATION_EMAIL_ACTION_ERROR]", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось отправить письмо для подтверждения email.",
    };
  }
}