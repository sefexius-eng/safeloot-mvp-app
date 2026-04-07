"use server";

import { revalidatePath } from "next/cache";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTelegramLinkToken,
  getTelegramBotUsername,
  hasTelegramBotTokenConfigured,
} from "@/lib/telegram";

interface TelegramLinkActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  url?: string;
  telegramId?: string | null;
}

const TELEGRAM_CONNECT_ERROR_MESSAGE =
  "Не удалось подготовить подключение Telegram. Попробуйте позже.";
const TELEGRAM_DISCONNECT_ERROR_MESSAGE =
  "Не удалось отключить Telegram. Попробуйте позже.";
const TELEGRAM_TOKEN_MISSING_MESSAGE =
  "Настройте TELEGRAM_BOT_TOKEN в Vercel";

export async function createTelegramLinkAction(): Promise<TelegramLinkActionResult> {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);
  const userId = currentUser?.id?.trim();

  if (!currentUser || !userId) {
    return {
      ok: false,
      error: "Требуется авторизация.",
    };
  }

  if (currentUser.isBanned) {
    return {
      ok: false,
      error: BANNED_USER_MESSAGE,
    };
  }

  if (!hasTelegramBotTokenConfigured()) {
    return {
      ok: false,
      error: TELEGRAM_TOKEN_MISSING_MESSAGE,
    };
  }

  try {
    const [freshUser, botUsername] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          telegramId: true,
        },
      }),
      getTelegramBotUsername(),
    ]);

    if (!freshUser) {
      return {
        ok: false,
        error: "Пользователь не найден.",
      };
    }

    if (freshUser.telegramId) {
      return {
        ok: true,
        message: "Telegram уже подключен.",
        telegramId: freshUser.telegramId.toString(),
      };
    }

    const token = createTelegramLinkToken();

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        tgLinkToken: token,
      },
    });

    revalidatePath("/profile");
    revalidatePath("/profile/settings");

    return {
      ok: true,
      message: "Откройте Telegram и подтвердите привязку через бота.",
      url: `https://t.me/${botUsername}?start=${token}`,
      telegramId: null,
    };
  } catch (error) {
    console.error("[CREATE_TELEGRAM_LINK_ACTION_ERROR]", error);

    return {
      ok: false,
      error:
        error instanceof Error && error.message === "TELEGRAM_BOT_TOKEN is not configured."
          ? TELEGRAM_TOKEN_MISSING_MESSAGE
          : TELEGRAM_CONNECT_ERROR_MESSAGE,
    };
  }
}

export async function disconnectTelegramAction(): Promise<TelegramLinkActionResult> {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);
  const userId = currentUser?.id?.trim();

  if (!currentUser || !userId) {
    return {
      ok: false,
      error: "Требуется авторизация.",
    };
  }

  if (currentUser.isBanned) {
    return {
      ok: false,
      error: BANNED_USER_MESSAGE,
    };
  }

  try {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        telegramId: null,
        tgLinkToken: null,
      },
    });

    revalidatePath("/profile");
    revalidatePath("/profile/settings");

    return {
      ok: true,
      message: "Telegram отключен.",
      telegramId: null,
    };
  } catch (error) {
    console.error("[DISCONNECT_TELEGRAM_ACTION_ERROR]", error);

    return {
      ok: false,
      error: TELEGRAM_DISCONNECT_ERROR_MESSAGE,
    };
  }
}