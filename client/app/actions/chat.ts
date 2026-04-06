"use server";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { createChatMessage, markChatMessagesAsRead } from "@/lib/marketplace";

async function requireActiveChatUserId() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser.id;
}

export async function sendMessage(
  orderId: string,
  content?: string,
  imageBase64?: string | null,
) {
  const userId = await requireActiveChatUserId();

  return createChatMessage({
    orderId,
    senderId: userId,
    content,
    imageBase64,
  });
}

export async function markMessagesAsRead(chatRoomId: string) {
  const userId = await requireActiveChatUserId();

  return markChatMessagesAsRead({
    chatRoomId,
    userId,
  });
}