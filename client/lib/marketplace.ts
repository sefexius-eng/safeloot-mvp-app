import {
  OrderStatus,
  Prisma,
  ProductType,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MONEY_SCALE = 8;
const PLATFORM_FEE_RATE = new Prisma.Decimal("0.05");
const TYPING_TTL_MS = 5000;

const chatTypingState = new Map<string, Map<string, number>>();

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function formatMoney(value: Prisma.Decimal) {
  return value.toFixed(MONEY_SCALE);
}

function parseProductType(type: string): ProductType {
  const normalizedType = normalizeText(type).toUpperCase();

  if (normalizedType === ProductType.ITEM) {
    return ProductType.ITEM;
  }

  if (normalizedType === ProductType.ACCOUNT) {
    return ProductType.ACCOUNT;
  }

  if (normalizedType === ProductType.SERVICE) {
    return ProductType.SERVICE;
  }

  throw new Error("type must be one of ITEM, ACCOUNT, SERVICE.");
}

function ensureOrderParticipant(
  userId: string,
  order: { buyerId: string; sellerId: string },
) {
  if (userId !== order.buyerId && userId !== order.sellerId) {
    throw new Error("Only order participants can access this order.");
  }
}

function ensureChatParticipant(
  userId: string,
  chatRoom: { buyerId: string; sellerId: string },
) {
  if (userId !== chatRoom.buyerId && userId !== chatRoom.sellerId) {
    throw new Error("Only order participants can access this chat.");
  }
}

function setTypingState(orderId: string, senderId: string, isTyping: boolean) {
  const currentOrderTyping =
    chatTypingState.get(orderId) ?? new Map<string, number>();

  if (isTyping) {
    currentOrderTyping.set(senderId, Date.now());
    chatTypingState.set(orderId, currentOrderTyping);
    return;
  }

  currentOrderTyping.delete(senderId);

  if (currentOrderTyping.size === 0) {
    chatTypingState.delete(orderId);
    return;
  }

  chatTypingState.set(orderId, currentOrderTyping);
}

function getTypingUsers(chatRoom: {
  orderId: string;
  buyerId: string;
  sellerId: string;
  buyer: { email: string };
  seller: { email: string };
}) {
  const now = Date.now();
  const currentOrderTyping =
    chatTypingState.get(chatRoom.orderId) ?? new Map<string, number>();

  for (const [senderId, lastTypedAt] of currentOrderTyping.entries()) {
    if (now - lastTypedAt > TYPING_TTL_MS) {
      currentOrderTyping.delete(senderId);
    }
  }

  if (currentOrderTyping.size === 0) {
    chatTypingState.delete(chatRoom.orderId);
    return [];
  }

  chatTypingState.set(chatRoom.orderId, currentOrderTyping);

  const typingUsers: Array<{
    senderId: string;
    role: "BUYER" | "SELLER";
    email: string;
  }> = [];

  if (currentOrderTyping.has(chatRoom.buyerId)) {
    typingUsers.push({
      senderId: chatRoom.buyerId,
      role: "BUYER",
      email: chatRoom.buyer.email,
    });
  }

  if (currentOrderTyping.has(chatRoom.sellerId)) {
    typingUsers.push({
      senderId: chatRoom.sellerId,
      role: "SELLER",
      email: chatRoom.seller.email,
    });
  }

  return typingUsers;
}

export function mapMarketplaceErrorToStatusCode(message: string) {
  if (
    message.includes("required") ||
    message.includes("must") ||
    message.includes("свой собственный товар")
  ) {
    return 400;
  }

  if (message.includes("Only ") || message.includes("participants")) {
    return 403;
  }

  if (message.includes("was not found") || message.includes("not found")) {
    return 404;
  }

  if (
    message.includes("cannot be confirmed") ||
    message.includes("cannot be completed") ||
    message.includes("could not be")
  ) {
    return 409;
  }

  return 400;
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    include: {
      seller: {
        select: {
          id: true,
          email: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return products.map((product) => ({
    ...product,
    price: formatMoney(product.price),
  }));
}

export async function getProductById(productId: string) {
  const normalizedProductId = normalizeText(productId);

  if (!normalizedProductId) {
    throw new Error("productId is required.");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
    },
    include: {
      seller: {
        select: {
          id: true,
          email: true,
          rank: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  return {
    ...product,
    price: formatMoney(product.price),
  };
}

export async function createProduct(input: {
  title?: string;
  description?: string;
  price?: number;
  gameId?: string;
  type?: string;
  sellerId?: string;
}) {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const gameId = normalizeText(input.gameId);
  const sellerId = normalizeText(input.sellerId);
  const price = Number(input.price);

  if (!title) {
    throw new Error("title is required.");
  }

  if (!description) {
    throw new Error("description is required.");
  }

  if (!gameId) {
    throw new Error("gameId is required.");
  }

  if (!sellerId) {
    throw new Error("sellerId is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("price must be a positive number.");
  }

  const seller = await prisma.user.findUnique({
    where: {
      id: sellerId,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error(`Seller with id ${sellerId} was not found.`);
  }

  const product = await prisma.product.create({
    data: {
      title,
      description,
      gameId,
      sellerId,
      type: parseProductType(input.type ?? ""),
      price: new Prisma.Decimal(price.toFixed(MONEY_SCALE)),
    },
  });

  return {
    ...product,
    price: formatMoney(product.price),
  };
}

export async function getUserById(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      rank: true,
      availableBalance: true,
      holdBalance: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error(`User with id ${normalizedUserId} was not found.`);
  }

  return {
    ...user,
    availableBalance: formatMoney(user.availableBalance),
    holdBalance: formatMoney(user.holdBalance),
  };
}

export async function listProductsBySeller(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const products = await prisma.product.findMany({
    where: {
      sellerId: normalizedUserId,
    },
    include: {
      seller: {
        select: {
          id: true,
          email: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return products.map((product) => ({
    ...product,
    price: formatMoney(product.price),
  }));
}

export async function createOrder(input: {
  productId?: string;
  buyerId: string;
}) {
  const productId = normalizeText(input.productId);
  const buyerId = normalizeText(input.buyerId);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  const [buyer, product] = await Promise.all([
    prisma.user.findUnique({
      where: { id: buyerId },
      select: { id: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        price: true,
        sellerId: true,
      },
    }),
  ]);

  if (!buyer) {
    throw new Error(`Buyer with id ${buyerId} was not found.`);
  }

  if (!product) {
    throw new Error(`Product with id ${productId} was not found.`);
  }

  if (product.sellerId === buyerId) {
    throw new Error("Вы не можете купить свой собственный товар");
  }

  const order = await prisma.order.create({
    data: {
      buyerId,
      sellerId: product.sellerId,
      productId: product.id,
      price: product.price,
      status: OrderStatus.PENDING,
    },
    select: {
      id: true,
    },
  });

  return {
    orderId: order.id,
    hosted_url: `/payment-mock?orderId=${order.id}`,
  };
}

export async function getOrderById(orderId: string, userId: string) {
  const normalizedOrderId = normalizeText(orderId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedOrderId) {
    throw new Error("orderId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const order = await prisma.order.findUnique({
    where: { id: normalizedOrderId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      productId: true,
      price: true,
      platformFee: true,
      status: true,
      chatRoom: {
        select: {
          id: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order with id ${normalizedOrderId} was not found.`);
  }

  ensureOrderParticipant(normalizedUserId, order);

  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
    price: formatMoney(order.price),
    platformFee: formatMoney(order.platformFee),
    status: order.status,
    chatRoomId: order.chatRoom?.id ?? null,
    product: order.product,
  };
}

export async function confirmOrder(input: { orderId?: string; buyerId: string }) {
  const orderId = normalizeText(input.orderId);
  const buyerId = normalizeText(input.buyerId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      const existingOrder = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
        },
      });

      if (!existingOrder) {
        throw new Error(`Order with id ${orderId} was not found.`);
      }

      if (existingOrder.buyerId !== buyerId) {
        throw new Error("Only the buyer can confirm this order.");
      }

      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new Error(
          `Order ${orderId} cannot be confirmed from status ${existingOrder.status}.`,
        );
      }

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.PENDING,
        },
        data: {
          status: OrderStatus.PAID,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be confirmed.`);
      }

      await transactionClient.chatRoom.upsert({
        where: {
          orderId: existingOrder.id,
        },
        update: {
          buyerId: existingOrder.buyerId,
          sellerId: existingOrder.sellerId,
        },
        create: {
          orderId: existingOrder.id,
          buyerId: existingOrder.buyerId,
          sellerId: existingOrder.sellerId,
        },
      });

      return {
        orderId: existingOrder.id,
        status: OrderStatus.PAID,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function completeOrder(input: { orderId: string; buyerId: string }) {
  const orderId = normalizeText(input.orderId);
  const buyerId = normalizeText(input.buyerId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          price: true,
          status: true,
        },
      });

      if (!order) {
        throw new Error(`Order with id ${orderId} was not found.`);
      }

      if (order.buyerId !== buyerId) {
        throw new Error("Only the buyer can complete this order.");
      }

      if (order.status !== OrderStatus.PAID) {
        throw new Error(
          `Order ${orderId} cannot be completed from status ${order.status}.`,
        );
      }

      const platformFee = order.price
        .mul(PLATFORM_FEE_RATE)
        .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
      const sellerHoldAmount = order.price
        .sub(platformFee)
        .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PAID,
        },
        data: {
          status: OrderStatus.COMPLETED,
          platformFee,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be completed.`);
      }

      await transactionClient.user.update({
        where: {
          id: order.sellerId,
        },
        data: {
          holdBalance: {
            increment: sellerHoldAmount,
          },
        },
      });

      const transaction = await transactionClient.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          amount: sellerHoldAmount,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
        },
        select: {
          id: true,
        },
      });

      return {
        orderId: order.id,
        transactionId: transaction.id,
        status: OrderStatus.COMPLETED,
        platformFee: formatMoney(platformFee),
        sellerHoldAmount: formatMoney(sellerHoldAmount),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

async function getChatRoomContext(orderId: string) {
  return prisma.chatRoom.findUnique({
    where: {
      orderId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      buyer: {
        select: {
          email: true,
        },
      },
      seller: {
        select: {
          email: true,
        },
      },
    },
  });
}

export async function getChatMessages(orderId: string, userId: string) {
  const normalizedOrderId = normalizeText(orderId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedOrderId) {
    throw new Error("orderId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const chatRoom = await prisma.chatRoom.findUnique({
    where: {
      orderId: normalizedOrderId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!chatRoom) {
    throw new Error(`Chat for order ${normalizedOrderId} was not found.`);
  }

  ensureChatParticipant(normalizedUserId, chatRoom);

  return {
    orderId: chatRoom.orderId,
    chatRoomId: chatRoom.id,
    messages: chatRoom.messages,
  };
}

export async function createChatMessage(input: {
  orderId: string;
  senderId: string;
  content?: string;
}) {
  const orderId = normalizeText(input.orderId);
  const senderId = normalizeText(input.senderId);
  const content = normalizeText(input.content);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!senderId) {
    throw new Error("senderId is required.");
  }

  if (!content) {
    throw new Error("content is required.");
  }

  const chatRoom = await prisma.chatRoom.findUnique({
    where: {
      orderId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!chatRoom) {
    throw new Error(`Chat for order ${orderId} was not found.`);
  }

  ensureChatParticipant(senderId, chatRoom);
  setTypingState(orderId, senderId, false);

  const message = await prisma.message.create({
    data: {
      chatRoomId: chatRoom.id,
      senderId,
      content,
    },
    select: {
      id: true,
      content: true,
      senderId: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return {
    orderId: chatRoom.orderId,
    chatRoomId: chatRoom.id,
    message,
  };
}

export async function getChatTyping(orderId: string, userId: string) {
  const normalizedOrderId = normalizeText(orderId);
  const normalizedUserId = normalizeText(userId);

  if (!normalizedOrderId) {
    throw new Error("orderId is required.");
  }

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const chatRoom = await getChatRoomContext(normalizedOrderId);

  if (!chatRoom) {
    throw new Error(`Chat for order ${normalizedOrderId} was not found.`);
  }

  ensureChatParticipant(normalizedUserId, chatRoom);

  return {
    orderId: chatRoom.orderId,
    typingUsers: getTypingUsers(chatRoom),
  };
}

export async function setChatTyping(input: {
  orderId: string;
  senderId: string;
  isTyping?: boolean;
}) {
  const orderId = normalizeText(input.orderId);
  const senderId = normalizeText(input.senderId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!senderId) {
    throw new Error("senderId is required.");
  }

  const chatRoom = await getChatRoomContext(orderId);

  if (!chatRoom) {
    throw new Error(`Chat for order ${orderId} was not found.`);
  }

  ensureChatParticipant(senderId, chatRoom);
  setTypingState(orderId, senderId, Boolean(input.isTyping));

  return {
    orderId: chatRoom.orderId,
    typingUsers: getTypingUsers(chatRoom),
  };
}