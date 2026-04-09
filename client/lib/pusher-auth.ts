import {
  ensureConversationAccess,
  ensureOrderAccess,
} from "@/lib/domain/shared";
import { getPusherServerClient, parseRealtimeChannelName } from "@/lib/pusher";
import { prisma } from "@/lib/prisma";

async function assertConversationChannelAccess(
  conversationId: string,
  userId: string,
  role?: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  const latestOrder = conversation.productId
    ? await prisma.order.findFirst({
        where: {
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId,
          productId: conversation.productId,
        },
        select: {
          status: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : null;

  ensureConversationAccess(
    userId,
    {
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      latestOrder,
    },
    role,
  );
}

async function assertOrderChannelAccess(orderId: string, userId: string, role?: string) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      status: true,
    },
  });

  if (!order) {
    throw new Error(`Order with id ${orderId} was not found.`);
  }

  ensureOrderAccess(userId, order, role);
}

export async function authorizePusherChannelSubscription(input: {
  socketId: string;
  channelName: string;
  userId: string;
  role?: string;
}) {
  const socketId = input.socketId.trim();
  const channelName = input.channelName.trim();
  const userId = input.userId.trim();
  const pusher = await getPusherServerClient();

  if (!socketId || !channelName || !userId) {
    throw new Error("socketId, channelName and userId are required.");
  }

  if (!pusher) {
    throw new Error("Pusher server client is not configured.");
  }

  const channelDescriptor = parseRealtimeChannelName(channelName);

  if (!channelDescriptor) {
    throw new Error("Unsupported Pusher channel.");
  }

  if (channelDescriptor.kind === "user") {
    if (channelDescriptor.id !== userId) {
      throw new Error("Only the notification owner can access this channel.");
    }

    return pusher.authorizeChannel(socketId, channelName);
  }

  if (channelDescriptor.kind === "presence") {
    return pusher.authorizeChannel(socketId, channelName, {
      user_id: userId,
    });
  }

  if (channelDescriptor.kind === "conversation") {
    await assertConversationChannelAccess(channelDescriptor.id, userId, input.role);
    return pusher.authorizeChannel(socketId, channelName);
  }

  await assertOrderChannelAccess(channelDescriptor.id, userId, input.role);
  return pusher.authorizeChannel(socketId, channelName);
}