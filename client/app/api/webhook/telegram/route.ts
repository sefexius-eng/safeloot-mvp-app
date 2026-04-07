import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendTelegramTextMessage } from "@/lib/telegram";

interface TelegramUser {
  id: number;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

const LINK_SUCCESS_MESSAGE =
  "✅ Аккаунт привязан! Я буду присылать сюда уведомления о твоих продажах и новых сообщениях в SafeLoot.";
const LINK_MISSING_TOKEN_MESSAGE =
  "Отправьте команду привязки из SafeLoot заново, чтобы подключить Telegram к аккаунту.";
const LINK_INVALID_TOKEN_MESSAGE =
  "Ссылка для привязки недействительна или устарела. Запросите новую в настройках профиля SafeLoot.";
const LINK_ALREADY_USED_MESSAGE =
  "Этот Telegram уже привязан к другому аккаунту SafeLoot.";

function extractStartToken(text: string | undefined) {
  const normalizedText = text?.trim();

  if (!normalizedText) {
    return null;
  }

  const match = normalizedText.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);

  return match?.[1]?.trim() || null;
}

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const chatId = message?.chat?.id;
  const telegramUserId = message?.from?.id;
  const token = extractStartToken(message?.text);

  if (!message || !chatId || !telegramUserId) {
    return NextResponse.json({ ok: true });
  }

  if (!token) {
    await sendTelegramTextMessage(chatId, LINK_MISSING_TOKEN_MESSAGE).catch((error) => {
      console.error("[TELEGRAM_WEBHOOK_REPLY_ERROR]", error);
    });

    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: {
      tgLinkToken: token,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    await sendTelegramTextMessage(chatId, LINK_INVALID_TOKEN_MESSAGE).catch((error) => {
      console.error("[TELEGRAM_WEBHOOK_REPLY_ERROR]", error);
    });

    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        telegramId: BigInt(telegramUserId),
        tgLinkToken: null,
      },
    });

    await sendTelegramTextMessage(chatId, LINK_SUCCESS_MESSAGE);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await sendTelegramTextMessage(chatId, LINK_ALREADY_USED_MESSAGE).catch((sendError) => {
        console.error("[TELEGRAM_WEBHOOK_REPLY_ERROR]", sendError);
      });

      return NextResponse.json({ ok: true });
    }

    console.error("[TELEGRAM_WEBHOOK_LINK_ERROR]", error);

    await sendTelegramTextMessage(
      chatId,
      "Не удалось завершить привязку. Попробуйте снова из настроек профиля SafeLoot.",
    ).catch((sendError) => {
      console.error("[TELEGRAM_WEBHOOK_REPLY_ERROR]", sendError);
    });
  }

  return NextResponse.json({ ok: true });
}