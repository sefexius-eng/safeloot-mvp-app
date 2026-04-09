import { Prisma } from "@prisma/client";

import { USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import {
  sendNotificationEmails,
  type NotificationEmailDeliveryInput,
} from "@/lib/notification-delivery";
import {
  publishConversationMessageEvent,
  publishConversationTypingStateEvent,
  publishOrderMessageEvent,
  publishOrderTypingStateEvent,
  type RealtimeConversationMessagePayload,
  type RealtimeOrderMessagePayload,
  type RealtimeTypingUser,
} from "@/lib/pusher";
import { prisma } from "@/lib/prisma";

import {
  DEAL_ROOM_SECURITY_WARNING,
  ensureConversationAccess,
  ensureConversationParticipant,
  formatMoney,
  getTypingUsers,
  MAX_MESSAGE_IMAGE_BASE64_LENGTH,
  moderateAntiLeakageMessageText,
  normalizeOptionalText,
  normalizeText,
  setTypingState,
} from "@/lib/domain/shared";
import {
  createUserNotification,
  sendNotificationRealtimeEvents,
  type NotificationRealtimeDeliveryInput,
  triggerDealChatTelegramNotification,
} from "@/lib/domain/notifications-service";

function uniqueUserIds(userIds: string[]) {
  return Array.from(new Set(userIds.filter(Boolean)));
}

async function getConversationContextById(conversationId: string) {
  return prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      archivedByIds: true,
      deletedByIds: true,
      buyer: {
        select: {
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
        },
      },
      seller: {
        select: {
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          price: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function getLatestConversationOrder(conversation: {
  buyerId: string;
  sellerId: string;
  productId: string | null;
}) {
  if (!conversation.productId) {
    return null;
  }

  return prisma.order.findFirst({
    where: {
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      productId: conversation.productId,
    },
    select: {
      id: true,
      status: true,
      price: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getConversationContextWithOrder(conversationId: string) {
  const conversation = await getConversationContextById(conversationId);

  if (!conversation) {
    return null;
  }

  const latestOrder = await getLatestConversationOrder(conversation);

  return {
    ...conversation,
    latestOrder,
  };
}

async function getOrCreateConversationRecord(input: {
  buyerId: string;
  sellerId: string;
  productId?: string | null;
}) {
  const buyerId = normalizeText(input.buyerId);
  const sellerId = normalizeText(input.sellerId);
  const productId = normalizeOptionalText(input.productId);

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  if (!sellerId) {
    throw new Error("sellerId is required.");
  }

  if (buyerId === sellerId) {
    throw new Error("Нельзя начать диалог с самим собой.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      if (productId) {
        const product = await transactionClient.product.findUnique({
          where: {
            id: productId,
          },
          select: {
            id: true,
            sellerId: true,
          },
        });

        if (!product) {
          throw new Error(`Product with id ${productId} was not found.`);
        }

        if (product.sellerId !== sellerId) {
          throw new Error("Товар не принадлежит указанному продавцу.");
        }
      }

      const existingConversation = await transactionClient.conversation.findFirst({
        where: {
          buyerId,
          sellerId,
          productId: productId ?? null,
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existingConversation) {
        return existingConversation;
      }

      return transactionClient.conversation.create({
        data: {
          buyerId,
          sellerId,
          productId: productId ?? null,
        },
        select: {
          id: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

function buildDirectConversationWhere(
  userId: string,
  targetUserId: string,
): Prisma.ConversationWhereInput {
  return {
    productId: null,
    OR: [
      {
        buyerId: userId,
        sellerId: targetUserId,
      },
      {
        buyerId: targetUserId,
        sellerId: userId,
      },
    ],
  };
}

function getDirectConversationLockKey(userId: string, targetUserId: string) {
  const [firstParticipantId, secondParticipantId] = [userId, targetUserId].sort();

  return `direct-conversation:${firstParticipantId}:${secondParticipantId}`;
}

export async function getOrCreateDirectConversation(input: {
  userId: string;
  targetUserId: string;
}) {
  const userId = normalizeText(input.userId);
  const targetUserId = normalizeText(input.targetUserId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!targetUserId) {
    throw new Error("targetUserId is required.");
  }

  if (userId === targetUserId) {
    throw new Error("Нельзя начать диалог с самим собой.");
  }

  const directConversationWhere = buildDirectConversationWhere(
    userId,
    targetUserId,
  );
  const existingConversation = await prisma.conversation.findFirst({
    where: directConversationWhere,
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingConversation) {
    return {
      conversationId: existingConversation.id,
    };
  }

  const conversation = await prisma.$transaction(
    async (transactionClient) => {
      const targetUser = await transactionClient.user.findUnique({
        where: {
          id: targetUserId,
        },
        select: {
          id: true,
        },
      });

      if (!targetUser) {
        throw new Error("Пользователь не найден.");
      }

      await transactionClient.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${getDirectConversationLockKey(userId, targetUserId)}))`,
      );

      const existingConversationInTransaction = await transactionClient.conversation.findFirst({
        where: directConversationWhere,
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existingConversationInTransaction) {
        return existingConversationInTransaction;
      }

      return transactionClient.conversation.create({
        data: {
          buyerId: userId,
          sellerId: targetUserId,
          productId: null,
        },
        select: {
          id: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return {
    conversationId: conversation.id,
  };
}

async function getOrCreateConversationByOrder(orderId: string) {
  const normalizedOrderId = normalizeText(orderId);

  if (!normalizedOrderId) {
    throw new Error("orderId is required.");
  }

  const order = await prisma.order.findUnique({
    where: {
      id: normalizedOrderId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      status: true,
      product: {
        select: {
          title: true,
        },
      },
      buyer: {
        select: {
          id: true,
          name: true,
          telegramId: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          telegramId: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order with id ${normalizedOrderId} was not found.`);
  }

  const conversation = await getOrCreateConversationRecord({
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
  });

  return {
    ...conversation,
    order,
  };
}

export async function getOrCreateConversation(input: {
  buyerId: string;
  sellerId: string;
  productId?: string | null;
}) {
  const conversation = await getOrCreateConversationRecord(input);

  return {
    conversationId: conversation.id,
  };
}

export async function toggleArchiveConversationByUser(input: {
  conversationId: string;
  userId: string;
}) {
  const conversationId = normalizeText(input.conversationId);
  const userId = normalizeText(input.userId);

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      archivedByIds: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationParticipant(userId, conversation);

  const isArchived = conversation.archivedByIds.includes(userId);
  const nextArchivedByIds = isArchived
    ? conversation.archivedByIds.filter((participantId) => participantId !== userId)
    : uniqueUserIds([...conversation.archivedByIds, userId]);

  await prisma.conversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      archivedByIds: nextArchivedByIds,
    },
  });

  return {
    conversationId: conversation.id,
    isArchived: !isArchived,
  };
}

export async function softDeleteConversationByUser(input: {
  conversationId: string;
  userId: string;
}) {
  const conversationId = normalizeText(input.conversationId);
  const userId = normalizeText(input.userId);

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      archivedByIds: true,
      deletedByIds: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationParticipant(userId, conversation);

  await prisma.conversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      archivedByIds: conversation.archivedByIds.filter(
        (participantId) => participantId !== userId,
      ),
      deletedByIds: uniqueUserIds([...conversation.deletedByIds, userId]),
    },
  });

  return {
    conversationId: conversation.id,
    isDeleted: true,
  };
}

export async function listConversationsByUser(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      NOT: {
        deletedByIds: {
          has: normalizedUserId,
        },
      },
      OR: [
        {
          buyerId: normalizedUserId,
        },
        {
          sellerId: normalizedUserId,
        },
      ],
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      archivedByIds: true,
      createdAt: true,
      updatedAt: true,
      buyer: {
        select: {
          id: true,
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          role: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          role: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          price: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          text: true,
          imageUrl: true,
          createdAt: true,
          senderId: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return conversations.map((conversation) => {
    const isBuyer = conversation.buyerId === normalizedUserId;
    const otherParty = isBuyer ? conversation.seller : conversation.buyer;
    const lastMessage = conversation.messages[0] ?? null;

    return {
      id: conversation.id,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      isArchived: conversation.archivedByIds.includes(normalizedUserId),
      otherParty: {
        id: otherParty.id,
        name: otherParty.name,
        image: otherParty.image,
        activeColor: otherParty.activeColor,
        activeFont: otherParty.activeFont,
        activeDecoration: otherParty.activeDecoration,
        accountRole: otherParty.role,
      },
      product: conversation.product
        ? {
            id: conversation.product.id,
            title: conversation.product.title,
            price: formatMoney(conversation.product.price),
          }
        : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            text: lastMessage.text,
            hasImage: Boolean(lastMessage.imageUrl),
            createdAt: lastMessage.createdAt.toISOString(),
            senderId: lastMessage.senderId,
          }
        : null,
    };
  });
}

export async function getConversationRoom(conversationId: string, userId: string) {
  const normalizedConversationId = normalizeText(conversationId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedConversationId) {
    throw new Error("conversationId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversation = await getConversationContextWithOrder(normalizedConversationId);

  if (!conversation) {
    throw new Error(`Conversation with id ${normalizedConversationId} was not found.`);
  }

  ensureConversationAccess(normalizedUserId, conversation);

  return {
    id: conversation.id,
    buyerId: conversation.buyerId,
    sellerId: conversation.sellerId,
    product: conversation.product
      ? {
          id: conversation.product.id,
          title: conversation.product.title,
          price: formatMoney(conversation.product.price),
        }
      : null,
    otherParty:
      normalizedUserId === conversation.buyerId
        ? {
            id: conversation.sellerId,
            role: "SELLER" as const,
            name: conversation.seller.name,
            image: conversation.seller.image,
            activeColor: conversation.seller.activeColor,
            activeFont: conversation.seller.activeFont,
            activeDecoration: conversation.seller.activeDecoration,
            lastSeen: conversation.seller.lastSeen.toISOString(),
            accountRole: conversation.seller.role,
          }
        : {
            id: conversation.buyerId,
            role: "BUYER" as const,
            name: conversation.buyer.name,
            image: conversation.buyer.image,
            activeColor: conversation.buyer.activeColor,
            activeFont: conversation.buyer.activeFont,
            activeDecoration: conversation.buyer.activeDecoration,
            lastSeen: conversation.buyer.lastSeen.toISOString(),
            accountRole: conversation.buyer.role,
          },
    latestOrder: conversation.latestOrder
      ? {
          id: conversation.latestOrder.id,
          status: conversation.latestOrder.status,
          price: formatMoney(conversation.latestOrder.price),
          createdAt: conversation.latestOrder.createdAt.toISOString(),
        }
      : null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  role?: string,
) {
  const normalizedConversationId = normalizeText(conversationId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedConversationId) {
    throw new Error("conversationId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: normalizedConversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          isSystem: true,
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
              ...USER_APPEARANCE_SELECT,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${normalizedConversationId} was not found.`);
  }

  const latestOrder = await getLatestConversationOrder(conversation);
  ensureConversationAccess(
    normalizedUserId,
    {
      ...conversation,
      latestOrder,
    },
    role,
  );

  return {
    conversationId: conversation.id,
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
  };
}

function serializeConversationMessage(message: {
  id: string;
  text: string;
  imageUrl: string | null;
  isSystem: boolean;
  isRead: boolean;
  senderId: string;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
    activeColor: string | null;
    activeFont: string | null;
    activeDecoration: string | null;
  };
}): RealtimeConversationMessagePayload {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function mapConversationMessageToOrderMessage(
  message: RealtimeConversationMessagePayload,
): RealtimeOrderMessagePayload {
  return {
    id: message.id,
    content: message.text,
    imageUrl: message.imageUrl,
    isSystem: message.isSystem,
    isRead: message.isRead,
    senderId: message.senderId,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sender: message.sender,
  };
}

export async function createConversationMessage(input: {
  conversationId: string;
  senderId: string;
  text?: string;
  imageBase64?: string | null;
}) {
  const conversationId = normalizeText(input.conversationId);
  const senderId = normalizeText(input.senderId);
  const moderationResult = moderateAntiLeakageMessageText(input.text);
  const text = moderationResult.text;
  const imageBase64 = normalizeOptionalText(input.imageBase64);

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!senderId) {
    throw new Error("senderId is required.");
  }

  if (!text && !imageBase64) {
    throw new Error("text or imageBase64 is required.");
  }

  if (imageBase64 && !imageBase64.startsWith("data:image/webp;base64,")) {
    throw new Error("imageBase64 must be a WebP data URL.");
  }

  if (imageBase64 && imageBase64.length > MAX_MESSAGE_IMAGE_BASE64_LENGTH) {
    throw new Error("imageBase64 is too large.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      deletedByIds: true,
      buyer: {
        select: {
          name: true,
        },
      },
      seller: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationParticipant(senderId, conversation);
  setTypingState(conversationId, senderId, false);

  const recipientId =
    senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];
  const realtimeNotificationQueue: NotificationRealtimeDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const createdMessage = await transactionClient.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          text,
          imageUrl: imageBase64,
          isSystem: false,
        },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          isSystem: true,
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
              ...USER_APPEARANCE_SELECT,
            },
          },
        },
      });

      const systemMessage = moderationResult.wasBlocked
        ? await transactionClient.message.create({
            data: {
              conversationId: conversation.id,
              senderId,
              text: DEAL_ROOM_SECURITY_WARNING,
              isSystem: true,
            },
            select: {
              id: true,
              text: true,
              imageUrl: true,
              isSystem: true,
              isRead: true,
              senderId: true,
              createdAt: true,
              updatedAt: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  ...USER_APPEARANCE_SELECT,
                },
              },
            },
          })
        : null;

      await transactionClient.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          deletedByIds: [],
          updatedAt: new Date(),
        },
      });

      await createUserNotification(
        transactionClient,
        {
          userId: recipientId,
          title: "Новое сообщение",
          message: "Вам написали в личном диалоге.",
          link: `/chats/${conversation.id}`,
        },
        emailDeliveryQueue,
        realtimeNotificationQueue,
      );

      return {
        message: createdMessage,
        systemMessage,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const serializedMessage = serializeConversationMessage(result.message);
  const serializedSystemMessage = result.systemMessage
    ? serializeConversationMessage(result.systemMessage)
    : null;
  const typingUsers = getTypingUsers(conversation) as RealtimeTypingUser[];

  await Promise.all([
    sendNotificationEmails(emailDeliveryQueue),
    sendNotificationRealtimeEvents(realtimeNotificationQueue),
    publishConversationMessageEvent(conversation.id, serializedMessage),
    publishConversationTypingStateEvent(conversation.id, typingUsers),
    ...(serializedSystemMessage
      ? [publishConversationMessageEvent(conversation.id, serializedSystemMessage)]
      : []),
  ]);

  return {
    conversationId: conversation.id,
    message: serializedMessage,
    systemMessage: serializedSystemMessage,
    typingUsers,
  };
}

export async function markConversationMessagesAsRead(input: {
  conversationId: string;
  userId: string;
}) {
  const conversationId = normalizeText(input.conversationId);
  const userId = normalizeText(input.userId);

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const conversation = await getConversationContextById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} was not found.`);
  }

  ensureConversationParticipant(userId, conversation);

  const updatedMessages = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: {
        not: userId,
      },
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return {
    conversationId: conversation.id,
    updatedCount: updatedMessages.count,
  };
}

export async function getConversationTyping(
  conversationId: string,
  userId: string,
  role?: string,
) {
  const normalizedConversationId = normalizeText(conversationId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedConversationId) {
    throw new Error("conversationId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversation = await getConversationContextWithOrder(normalizedConversationId);

  if (!conversation) {
    throw new Error(`Conversation with id ${normalizedConversationId} was not found.`);
  }

  ensureConversationAccess(normalizedUserId, conversation, role);

  return {
    conversationId: conversation.id,
    typingUsers: getTypingUsers(conversation),
  };
}

export async function setConversationTyping(input: {
  conversationId: string;
  senderId: string;
  isTyping?: boolean;
}) {
  const conversationId = normalizeText(input.conversationId);
  const senderId = normalizeText(input.senderId);

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!senderId) {
    throw new Error("senderId is required.");
  }

  const conversation = await getConversationContextById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationParticipant(senderId, conversation);
  setTypingState(conversationId, senderId, Boolean(input.isTyping));

  const typingUsers = getTypingUsers(conversation) as RealtimeTypingUser[];
  void publishConversationTypingStateEvent(conversation.id, typingUsers);

  return {
    conversationId: conversation.id,
    typingUsers,
  };
}

export async function getChatMessages(
  orderId: string,
  userId: string,
  role?: string,
) {
  const { id: conversationId, order } = await getOrCreateConversationByOrder(orderId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversationRecord = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          isSystem: true,
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
              ...USER_APPEARANCE_SELECT,
            },
          },
        },
      },
    },
  });

  if (!conversationRecord) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationAccess(normalizedUserId, conversationRecord, role, order.status);

  return {
    orderId: order.id,
    chatRoomId: conversationRecord.id,
    messages: conversationRecord.messages.map((message) => ({
      id: message.id,
      content: message.text,
      imageUrl: message.imageUrl,
      isSystem: message.isSystem,
      isRead: message.isRead,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      sender: message.sender,
    })),
  };
}

export async function createChatMessage(input: {
  orderId: string;
  senderId: string;
  content?: string;
  imageBase64?: string | null;
}) {
  const { id: conversationId, order } = await getOrCreateConversationByOrder(input.orderId);
  const result = await createConversationMessage({
    conversationId,
    senderId: input.senderId,
    text: input.content,
    imageBase64: input.imageBase64,
  });

  const sender = input.senderId === order.buyerId ? order.buyer : order.seller;
  const recipient = input.senderId === order.buyerId ? order.seller : order.buyer;
  const normalizedMessageText =
    normalizeText(result.message?.text ?? input.content) ||
    (result.message?.imageUrl || input.imageBase64
      ? "Отправлено изображение."
      : "Новое сообщение.");
  const senderName =
    sender.name?.trim() ||
    (input.senderId === order.buyerId ? "Покупатель" : "Продавец");

  const orderMessage = result.message
    ? mapConversationMessageToOrderMessage(result.message)
    : null;
  const orderSystemMessage = result.systemMessage
    ? mapConversationMessageToOrderMessage(result.systemMessage)
    : null;

  await Promise.all([
    publishOrderTypingStateEvent(order.id, result.typingUsers),
    ...(orderMessage ? [publishOrderMessageEvent(order.id, orderMessage)] : []),
    ...(orderSystemMessage
      ? [publishOrderMessageEvent(order.id, orderSystemMessage)]
      : []),
  ]);

  triggerDealChatTelegramNotification({
    telegramId: recipient.telegramId,
    orderId: order.id,
    productTitle: order.product.title,
    senderName,
    messageText: normalizedMessageText,
  });

  return {
    orderId: order.id,
    chatRoomId: result.conversationId,
    message: orderMessage,
    systemMessage: orderSystemMessage,
  };
}

export async function markChatMessagesAsRead(input: {
  chatRoomId: string;
  userId: string;
}) {
  const result = await markConversationMessagesAsRead({
    conversationId: input.chatRoomId,
    userId: input.userId,
  });

  return {
    chatRoomId: result.conversationId,
    orderId: null,
    updatedCount: result.updatedCount,
  };
}

export async function getChatTyping(
  orderId: string,
  userId: string,
  role?: string,
) {
  const { id: conversationId, order } = await getOrCreateConversationByOrder(orderId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversation = await getConversationContextById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationAccess(normalizedUserId, conversation, role, order.status);

  return {
    orderId: order.id,
    typingUsers: getTypingUsers(conversation),
  };
}

export async function setChatTyping(input: {
  orderId: string;
  senderId: string;
  isTyping?: boolean;
}) {
  const { id: conversationId, order } = await getOrCreateConversationByOrder(input.orderId);
  const result = await setConversationTyping({
    conversationId,
    senderId: input.senderId,
    isTyping: input.isTyping,
  });

  void publishOrderTypingStateEvent(order.id, result.typingUsers);

  return {
    orderId: order.id,
    typingUsers: result.typingUsers,
  };
}