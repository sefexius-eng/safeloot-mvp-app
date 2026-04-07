"use server";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  isEmailVerificationTestUser,
  sendVerificationEmailToUser,
} from "@/lib/email-verification";

interface SendVerificationEmailActionResult {
  ok: boolean;
  message: string;
  email?: string;
}

const VERIFICATION_EMAIL_SEND_ERROR_MESSAGE =
  "Не удалось отправить письмо. Попробуйте позже.";

export async function sendVerificationEmailAction(): Promise<SendVerificationEmailActionResult> {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

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

  if (!isEmailVerificationTestUser(session?.user?.email)) {
    return {
      ok: false,
      message: VERIFICATION_EMAIL_SEND_ERROR_MESSAGE,
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

    if (result.status === "skipped-test-mode") {
      return {
        ok: false,
        message: VERIFICATION_EMAIL_SEND_ERROR_MESSAGE,
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
      message: VERIFICATION_EMAIL_SEND_ERROR_MESSAGE,
    };
  }
}