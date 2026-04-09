import { prisma } from "@/lib/prisma";
import {
  publishTavernMessageEvent,
  type RealtimeTavernMessagePayload,
} from "@/lib/pusher";

import { normalizeText } from "@/lib/domain/shared";

const DEFAULT_TAVERN_MESSAGES_LIMIT = 30;
const MAX_TAVERN_MESSAGE_LENGTH = 280;

interface TavernMessageRecord {
  id: string;
  text: string;
  isSystem: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

function resolveTavernDisplayName(
  user: TavernMessageRecord["user"],
  isSystem: boolean,
) {
  if (isSystem) {
    return "Система";
  }

  const userName = normalizeText(user?.name ?? undefined);

  if (userName) {
    return userName;
  }

  if (user?.email) {
    return user.email.split("@")[0];
  }

  return "Игрок";
}

function mapTavernMessage(
  message: TavernMessageRecord,
): RealtimeTavernMessagePayload {
  const displayName = resolveTavernDisplayName(message.user, message.isSystem);

  return {
    id: message.id,
    text: message.text,
    isSystem: message.isSystem,
    createdAt: message.createdAt.toISOString(),
    displayName,
    user: message.user
      ? {
          id: message.user.id,
          name: displayName,
          image: message.user.image,
        }
      : null,
  };
}

function getTavernMessageSelect() {
  return {
    id: true,
    text: true,
    isSystem: true,
    createdAt: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    },
  } as const;
}

export async function listRecentTavernMessages(limit = DEFAULT_TAVERN_MESSAGES_LIMIT) {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const messages = await prisma.tavernMessage.findMany({
    take: normalizedLimit,
    orderBy: {
      createdAt: "desc",
    },
    select: getTavernMessageSelect(),
  });

  return messages.reverse().map(mapTavernMessage);
}

export async function createTavernMessage(input: {
  text?: string;
  userId?: string | null;
  isSystem?: boolean;
}) {
  const text = normalizeText(input.text);
  const userId = normalizeText(input.userId ?? undefined);
  const isSystem = Boolean(input.isSystem);

  if (!text) {
    throw new Error("Введите сообщение для таверны.");
  }

  if (text.length > MAX_TAVERN_MESSAGE_LENGTH) {
    throw new Error(
      `Сообщение в таверне должно быть не длиннее ${MAX_TAVERN_MESSAGE_LENGTH} символов.`,
    );
  }

  if (!isSystem && !userId) {
    throw new Error("Unauthorized");
  }

  const createdMessage = await prisma.tavernMessage.create({
    data: {
      text,
      isSystem,
      userId: userId || null,
    },
    select: getTavernMessageSelect(),
  });

  const tavernMessage = mapTavernMessage(createdMessage);
  await publishTavernMessageEvent(tavernMessage);
  return tavernMessage;
}

export async function publishSystemTavernPurchaseAnnouncement(input: {
  buyerName?: string;
  gameName?: string;
}) {
  const buyerName = normalizeText(input.buyerName) || "Неизвестный покупатель";
  const gameName = normalizeText(input.gameName) || "игры";

  return createTavernMessage({
    text: `🎉 Пользователь ${buyerName} только что приобрел товар из категории ${gameName}!`,
    isSystem: true,
  });
}