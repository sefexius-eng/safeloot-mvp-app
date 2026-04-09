"use server";

import { redirect } from "next/navigation";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { moderateAntiLeakageMessageText } from "@/lib/domain/shared";
import {
  createChatMessage,
  createConversationMessage,
  getOrCreateConversation as getOrCreateConversationRecord,
  markChatMessagesAsRead,
  markConversationMessagesAsRead as markConversationMessagesAsReadRecord,
} from "@/lib/domain/chat-service";

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

async function requireActiveChatUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

export async function getOrCreateConversation(productId: string, sellerId: string) {
  const currentUser = await requireActiveChatUser();
  const result = await getOrCreateConversationRecord({
    buyerId: currentUser.id,
    sellerId,
    productId,
  });

  redirect(`/chats/${result.conversationId}`);
}

export async function sendMessage(
  orderId: string,
  content?: string,
  imageBase64?: string | null,
) {
  const userId = await requireActiveChatUserId();
  const sanitizedContent = moderateAntiLeakageMessageText(content).text;

  return createChatMessage({
    orderId,
    senderId: userId,
    content: sanitizedContent,
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

export async function sendConversationMessage(
  conversationId: string,
  text?: string,
  imageBase64?: string | null,
) {
  const userId = await requireActiveChatUserId();
  const sanitizedText = moderateAntiLeakageMessageText(text).text;

  return createConversationMessage({
    conversationId,
    senderId: userId,
    text: sanitizedText,
    imageBase64,
  });
}

export async function markConversationMessagesAsRead(conversationId: string) {
  const userId = await requireActiveChatUserId();

  return markConversationMessagesAsReadRecord({
    conversationId,
    userId,
  });
}