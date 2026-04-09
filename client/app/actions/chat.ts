"use server";

import { MessageType } from "@prisma/client";
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
  getConversationRoom as getConversationRoomRecord,
  markChatMessagesAsRead,
  markConversationMessagesAsRead as markConversationMessagesAsReadRecord,
  softDeleteConversationByUser,
  toggleArchiveConversationByUser,
  updateConversationGameCanvasState as updateConversationGameCanvasStateRecord,
  updateConversationChessGameState as updateConversationChessGameStateRecord,
  updateConversationGameInviteStatus as updateConversationGameInviteStatusRecord,
} from "@/lib/domain/chat-service";
import type { ConversationGameStatus, ConversationGameType } from "@/lib/pusher";

const CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

function isSupportedConversationGameType(
  gameType: string,
): gameType is ConversationGameType {
  return gameType === "crocodile" || gameType === "chess";
}

function isSupportedConversationGameStatus(
  status: string,
): status is Exclude<ConversationGameStatus, "pending"> {
  return status === "active" || status === "completed";
}

function getConversationGameInviteText(gameType: ConversationGameType) {
  switch (gameType) {
    case "crocodile":
      return "Приглашение в мини-игру: Крокодил.";
    case "chess":
      return "Приглашение в мини-игру: Шахматы.";
  }
}

export async function sendGameInvite(
  conversationId: string,
  gameType: ConversationGameType,
) {
  const userId = await requireActiveChatUserId();

  if (!isSupportedConversationGameType(gameType)) {
    throw new Error("Unsupported game type.");
  }

  const conversation = await getConversationRoomRecord(conversationId, userId);
  const targetUserId = conversation.otherParty.id;

  const result = await createConversationMessage({
    conversationId,
    senderId: userId,
    text: getConversationGameInviteText(gameType),
    type: MessageType.GAME_INVITE,
    gameMetadata:
      gameType === "chess"
        ? {
            game: gameType,
            status: "pending",
            initiatorId: userId,
            fen: CHESS_START_FEN,
            whitePlayerId: userId,
            blackPlayerId: targetUserId,
          }
        : {
            game: gameType,
            status: "pending",
            initiatorId: userId,
          },
  });

  revalidateChatPaths(result.conversationId);

  return result;
}

export async function updateGameInviteStatus(
  conversationId: string,
  messageId: string,
  status: "active" | "completed",
) {
  const userId = await requireActiveChatUserId();

  if (!isSupportedConversationGameStatus(status)) {
    throw new Error("Unsupported game invite status.");
  }

  const result = await updateConversationGameInviteStatusRecord({
    conversationId,
    messageId,
    userId,
    status,
  });

  revalidateChatPaths(result.conversationId);

  return result;
}

export async function saveGameCanvasState(
  conversationId: string,
  base64Image: string,
) {
  const userId = await requireActiveChatUserId();

  const result = await updateConversationGameCanvasStateRecord({
    conversationId,
    userId,
    canvasSnapshot: base64Image,
  });

  revalidateChatPaths(result.conversationId);

  return result;
}

export async function saveChessGameState(
  conversationId: string,
  messageId: string,
  fen: string,
  moveHistory: string[],
) {
  const userId = await requireActiveChatUserId();

  const result = await updateConversationChessGameStateRecord({
    conversationId,
    messageId,
    userId,
    fen,
    moveHistory,
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