"use server";

import { revalidatePath } from "next/cache";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { createTavernMessage } from "@/lib/domain/tavern";
import type { RealtimeTavernMessagePayload } from "@/lib/pusher";

interface SendTavernMessageResult {
  ok: boolean;
  message?: string;
  tavernMessage?: RealtimeTavernMessagePayload;
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

export async function sendTavernMessage(
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