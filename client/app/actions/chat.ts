"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { moderateAntiLeakageMessageText } from "@/lib/domain/shared";
import {
  createChatMessage,
  createConversationMessage,
  getOrCreateDirectConversation as getOrCreateDirectConversationRecord,
  getOrCreateConversation as getOrCreateConversationRecord,
  markChatMessagesAsRead,
  markConversationMessagesAsRead as markConversationMessagesAsReadRecord,
  softDeleteConversationByUser,
  toggleArchiveConversationByUser,
} from "@/lib/domain/chat-service";

interface StartDirectConversationResult {
  ok: boolean;
  conversationId?: string;
  message?: string;
  requiresLogin?: boolean;
}

interface ConversationPreferenceActionResult {
  ok: boolean;
  message?: string;
  conversationId?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
}

function revalidateChatPaths(conversationId?: string) {
  revalidatePath("/chats", "layout");

  if (conversationId) {
    revalidatePath(`/chats/${conversationId}`);
  }
}

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

export async function startDirectConversation(
  targetUserId: string,
): Promise<StartDirectConversationResult> {
  try {
    const userId = await requireActiveChatUserId();
    const result = await getOrCreateDirectConversationRecord({
      userId,
      targetUserId,
    });

    return {
      ok: true,
      conversationId: result.conversationId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось открыть диалог.";

    return {
      ok: false,
      message,
      requiresLogin: message === "Unauthorized",
    };
  }
}

export async function toggleArchiveConversation(
  chatId: string,
): Promise<ConversationPreferenceActionResult> {
  try {
    const userId = await requireActiveChatUserId();
    const result = await toggleArchiveConversationByUser({
      conversationId: chatId,
      userId,
    });

    revalidateChatPaths(result.conversationId);

    return {
      ok: true,
      conversationId: result.conversationId,
      isArchived: result.isArchived,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обновить архив чата.",
    };
  }
}

export async function deleteConversation(
  chatId: string,
): Promise<ConversationPreferenceActionResult> {
  try {
    const userId = await requireActiveChatUserId();
    const result = await softDeleteConversationByUser({
      conversationId: chatId,
      userId,
    });

    revalidateChatPaths(result.conversationId);

    return {
      ok: true,
      conversationId: result.conversationId,
      isDeleted: result.isDeleted,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось удалить чат.",
    };
  }
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

  const result = await createConversationMessage({
    conversationId,
    senderId: userId,
    text: sanitizedText,
    imageBase64,
  });

  revalidateChatPaths(result.conversationId);

  return result;
}

export async function markConversationMessagesAsRead(conversationId: string) {
  const userId = await requireActiveChatUserId();

  return markConversationMessagesAsReadRecord({
    conversationId,
    userId,
  });
}