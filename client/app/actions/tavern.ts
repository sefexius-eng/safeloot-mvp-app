"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { createTavernMessage, deleteTavernMessage } from "@/lib/domain/tavern";
import type { RealtimeTavernMessagePayload } from "@/lib/pusher";

interface SendTavernMessageResult {
  ok: boolean;
  message?: string;
  tavernMessage?: RealtimeTavernMessagePayload;
}

interface DeleteGlobalMessageResult {
  ok: boolean;
  message?: string;
  deletedMessageId?: string;
}

function hasStrictTavernDeleteAccess(role: Role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function requireActiveTavernUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

async function requireTavernModerator() {
  const currentUser = await requireActiveTavernUser();

  if (!hasStrictTavernDeleteAccess(currentUser.role)) {
    throw new Error("Недостаточно прав для удаления сообщений таверны.");
  }

  return currentUser;
}

export async function sendTavernMessage(
  text: string,
): Promise<SendTavernMessageResult> {
  return sendGlobalMessage(text);
}

export async function sendGlobalMessage(
  text: string,
): Promise<SendTavernMessageResult> {
  try {
    const currentUser = await requireActiveTavernUser();
    const tavernMessage = await createTavernMessage({
      text,
      userId: currentUser.id,
    });

    revalidatePath("/");

    return {
      ok: true,
      tavernMessage,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось отправить сообщение в таверну.",
    };
  }
}

export async function deleteGlobalMessage(
  messageId: string,
): Promise<DeleteGlobalMessageResult> {
  try {
    await requireTavernModerator();
    const deletedMessage = await deleteTavernMessage(messageId);

    revalidatePath("/");

    return {
      ok: true,
      deletedMessageId: deletedMessage.id,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось удалить сообщение из таверны.",
    };
  }
}