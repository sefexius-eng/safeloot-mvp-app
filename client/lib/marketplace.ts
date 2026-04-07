import {
  OrderStatus,
  Prisma,
  Role,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  sendNotificationEmails,
  type NotificationEmailDeliveryInput,
} from "@/lib/notification-delivery";
import {
  getSellerReviewSummary,
  getSellerReviewSummaryBySellerId,
  getSellerReviewSummaryMap,
} from "@/lib/review-summary";
import { isAdminRole } from "@/lib/roles";

const MONEY_SCALE = 2;
const COMMISSION_RATE = 0.05;
const COMMISSION_RATE_DECIMAL = new Prisma.Decimal(COMMISSION_RATE.toString());
const TYPING_TTL_MS = 5000;
const MAX_MESSAGE_IMAGE_BASE64_LENGTH = 2_000_000;
const MAX_PRODUCT_TITLE_LENGTH = 60;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;
const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_PRODUCT_IMAGE_BASE64_LENGTH = 2_000_000;
const PRODUCT_IMAGE_BASE64_PATTERN =
  /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;
const ZERO_MONEY = new Prisma.Decimal(0);
const TERMINAL_ORDER_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.CANCELLED,
] as const;

const chatTypingState = new Map<string, Map<string, number>>();

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>?/gm, "");
}

function sanitizeProductText(value?: string) {
  return normalizeText(stripHtmlTags(normalizeText(value)));
}

function roundMoney(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(
    MONEY_SCALE,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

function roundMoneyNumber(value: Prisma.Decimal.Value) {
  return Number(roundMoney(value).toFixed(MONEY_SCALE));
}

function ensureOrderIsNotTerminal(
  orderId: string,
  status: OrderStatus,
  action: string,
) {
  if (
    TERMINAL_ORDER_STATUSES.includes(
      status as (typeof TERMINAL_ORDER_STATUSES)[number],
    )
  ) {
    throw new Error(`Order ${orderId} cannot be ${action} from status ${status}.`);
  }
}

async function ensureSufficientUserBalance(
  transactionClient: Prisma.TransactionClient,
  input: {
    userId: string;
    balanceField: "holdBalance" | "availableBalance";
    requiredAmount: Prisma.Decimal;
    errorMessage: string;
  },
) {
  const user = await transactionClient.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
      holdBalance: true,
      availableBalance: true,
    },
  });

  if (!user) {
    throw new Error(`User with id ${input.userId} was not found.`);
  }

  if (user[input.balanceField].comparedTo(input.requiredAmount) < 0) {
    throw new Error(input.errorMessage);
  }
}

function calculateCommissionBreakdown(amount: Prisma.Decimal) {
  const normalizedAmount = roundMoney(amount);
  const fee = normalizedAmount
    .mul(COMMISSION_RATE_DECIMAL)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  const sellerPayout = normalizedAmount
    .sub(fee)
    .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

  return {
    fee,
    sellerPayout,
    feeAsNumber: roundMoneyNumber(fee),
  };
}

async function getPlatformAdminAccount(transactionClient: Prisma.TransactionClient) {
  const superAdminUser = await transactionClient.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
    },
    select: {
      id: true,
      holdBalance: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (superAdminUser) {
    return superAdminUser;
  }

  const fallbackAdmin = await transactionClient.user.findFirst({
    where: {
      role: Role.ADMIN,
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!fallbackAdmin) {
    throw new Error("Не найден SUPER_ADMIN для учёта комиссии платформы.");
  }

  return transactionClient.user.update({
    where: {
      id: fallbackAdmin.id,
    },
    data: {
      role: Role.SUPER_ADMIN,
    },
    select: {
      id: true,
      holdBalance: true,
    },
  });
}

async function findCompletedEscrowHoldTransaction(
  transactionClient: Prisma.TransactionClient,
  input: { orderId: string; adminUserId: string },
) {
  return transactionClient.transaction.findFirst({
    where: {
      orderId: input.orderId,
      userId: input.adminUserId,
      type: TransactionType.ESCROW_HOLD,
      status: TransactionStatus.COMPLETED,
    },
    select: {
      id: true,
    },
  });
}

function validateProductTextFields(input: {
  title?: string;
  description?: string;
}) {
  const title = sanitizeProductText(input.title);
  const description = sanitizeProductText(input.description);

  if (!title) {
    throw new Error("title is required.");
  }

  if (!description) {
    throw new Error("description is required.");
  }

  if (title.length > MAX_PRODUCT_TITLE_LENGTH) {
    throw new Error(
      `title must be at most ${MAX_PRODUCT_TITLE_LENGTH} characters.`,
    );
  }

  if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
    throw new Error(
      `description must be at most ${MAX_PRODUCT_DESCRIPTION_LENGTH} characters.`,
    );
  }

  return {
    title,
    description,
  };
}

function validateProductImages(images?: string[]) {
  const normalizedImages = Array.isArray(images)
    ? images
        .map((image) => normalizeText(image))
        .filter(Boolean)
    : [];

  if (normalizedImages.length > MAX_PRODUCT_IMAGE_COUNT) {
    throw new Error(`images must contain at most ${MAX_PRODUCT_IMAGE_COUNT} items.`);
  }

  for (const image of normalizedImages) {
    if (image.length > MAX_PRODUCT_IMAGE_BASE64_LENGTH) {
      throw new Error("images must be compressed before upload.");
    }

    if (!PRODUCT_IMAGE_BASE64_PATTERN.test(image)) {
      throw new Error("images must be valid webp base64 data.");
    }
  }

  return normalizedImages;
}

async function validateCatalogSelection(gameId: string, categoryId: string) {
  const [game, category] = await Promise.all([
    prisma.game.findUnique({
      where: {
        id: gameId,
      },
      select: {
        id: true,
        slug: true,
      },
    }),
    prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        gameId: true,
      },
    }),
  ]);

  if (!game) {
    throw new Error(`Game with id ${gameId} was not found.`);
  }

  if (!category) {
    throw new Error(`Category with id ${categoryId} was not found.`);
  }

  if (category.gameId !== gameId) {
    throw new Error("categoryId does not belong to selected gameId.");
  }

  return {
    game,
    category,
  };
}

function ensureProductManagementAccess(
  userId: string,
  role: Role | string | undefined,
  product: { sellerId: string },
) {
  if (userId === product.sellerId || isAdminRole((role as Role | null | undefined) ?? undefined)) {
    return;
  }

  throw new Error("Only the seller or admin can manage this product.");
}

function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  return normalizedValue || null;
}

function formatMoney(value: Prisma.Decimal) {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

async function createUserNotification(
  transactionClient: Prisma.TransactionClient,
  input: {
    userId: string;
    title: string;
    message: string;
    link?: string;
  },
  emailDeliveryQueue?: NotificationEmailDeliveryInput[],
) {
  const userId = normalizeText(input.userId);
  const title = normalizeText(input.title);
  const message = normalizeText(input.message);
  const link = normalizeOptionalText(input.link);

  if (!userId || !title || !message) {
    return;
  }

  let recipientEmailDelivery: NotificationEmailDeliveryInput | null = null;

  if (emailDeliveryQueue) {
    const user = await transactionClient.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
        emailVerified: true,
        name: true,
        emailNotifications: true,
      },
    });

    if (user?.emailNotifications && user.emailVerified) {
      recipientEmailDelivery = {
        recipientEmail: user.email,
        recipientName: user.name?.trim() || user.email.split("@")[0],
        title,
        message,
        link,
      };
    }
  }

  await transactionClient.notification.create({
    data: {
      userId,
      title,
      message,
      link,
    },
  });

  if (recipientEmailDelivery && emailDeliveryQueue) {
    emailDeliveryQueue.push(recipientEmailDelivery);
  }
}

async function mapProductsWithSellerReviewSummary<
  T extends {
    price: Prisma.Decimal;
    seller: {
      id: string;
      lastSeen?: Date | string | null;
    };
  },
>(products: T[]) {
  const reviewSummaryMap = await getSellerReviewSummaryMap(
    products.map((product) => product.seller.id),
  );

  return products.map((product) => ({
    ...product,
    price: formatMoney(product.price),
    seller: {
      ...product.seller,
      ...("lastSeen" in product.seller
        ? {
            lastSeen:
              product.seller.lastSeen instanceof Date
                ? product.seller.lastSeen.toISOString()
                : (product.seller.lastSeen ?? null),
          }
        : {}),
      reviewSummary: getSellerReviewSummary(reviewSummaryMap, product.seller.id),
    },
  }));
}

function normalizeMappedProductsSellerLastSeen<
  T extends {
    seller: {
      lastSeen: Date | string | null;
    };
  },
>(products: T[]) {
  return products.map((product) => ({
    ...product,
    seller: {
      ...product.seller,
      lastSeen:
        product.seller.lastSeen instanceof Date
          ? product.seller.lastSeen.toISOString()
          : (product.seller.lastSeen ?? null),
    },
  }));
}

function ensureOrderParticipant(
  userId: string,
  order: { buyerId: string; sellerId: string },
) {
  if (userId !== order.buyerId && userId !== order.sellerId) {
    throw new Error("Only order participants can access this order.");
  }
}

function canAdminAccessDisputedOrder(
  role: string | null | undefined,
  status: OrderStatus,
) {
  return isAdminRole((role as Role | null | undefined) ?? undefined) && status === OrderStatus.DISPUTED;
}

function ensureOrderAccess(
  userId: string,
  order: { buyerId: string; sellerId: string; status: OrderStatus },
  role?: string,
) {
  if (
    userId === order.buyerId ||
    userId === order.sellerId ||
    canAdminAccessDisputedOrder(role, order.status)
  ) {
    return;
  }

  throw new Error("Only order participants can access this order.");
}

function ensurePendingCheckoutAccess<
  T extends {
    buyerId: string;
    status: OrderStatus;
  },
>(
  buyerId: string,
  orderId: string,
  order: T | null,
) {
  if (!order) {
    throw new Error(`Order with id ${orderId} was not found.`);
  }

  if (order.buyerId !== buyerId) {
    throw new Error("Only the buyer can access checkout for this order.");
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new Error(
      `Checkout is not available for order ${orderId} in status ${order.status}.`,
    );
  }

  return order;
}

function ensureConversationParticipant(
  userId: string,
  conversation: { buyerId: string; sellerId: string },
) {
  if (userId !== conversation.buyerId && userId !== conversation.sellerId) {
    throw new Error("Only order participants can access this chat.");
  }
}

function ensureConversationAccess(
  userId: string,
  conversation: {
    buyerId: string;
    sellerId: string;
    latestOrder?: { status: OrderStatus } | null;
  },
  role?: string,
  statusOverride?: OrderStatus,
) {
  const accessStatus = statusOverride ?? conversation.latestOrder?.status;

  if (
    userId === conversation.buyerId ||
    userId === conversation.sellerId ||
    (accessStatus ? canAdminAccessDisputedOrder(role, accessStatus) : false)
  ) {
    return;
  }

  throw new Error("Only order participants can access this chat.");
}

function setTypingState(conversationId: string, senderId: string, isTyping: boolean) {
  const currentConversationTyping =
    chatTypingState.get(conversationId) ?? new Map<string, number>();

  if (isTyping) {
    currentConversationTyping.set(senderId, Date.now());
    chatTypingState.set(conversationId, currentConversationTyping);
    return;
  }

  currentConversationTyping.delete(senderId);

  if (currentConversationTyping.size === 0) {
    chatTypingState.delete(conversationId);
    return;
  }

  chatTypingState.set(conversationId, currentConversationTyping);
}

function getTypingUsers(conversation: {
  id: string;
  buyerId: string;
  sellerId: string;
  buyer: { name: string | null };
  seller: { name: string | null };
}) {
  const now = Date.now();
  const currentConversationTyping =
    chatTypingState.get(conversation.id) ?? new Map<string, number>();

  for (const [senderId, lastTypedAt] of currentConversationTyping.entries()) {
    if (now - lastTypedAt > TYPING_TTL_MS) {
      currentConversationTyping.delete(senderId);
    }
  }

  if (currentConversationTyping.size === 0) {
    chatTypingState.delete(conversation.id);
    return [];
  }

  chatTypingState.set(conversation.id, currentConversationTyping);

  const typingUsers: Array<{
    senderId: string;
    role: "BUYER" | "SELLER";
    name: string | null;
  }> = [];

  if (currentConversationTyping.has(conversation.buyerId)) {
    typingUsers.push({
      senderId: conversation.buyerId,
      role: "BUYER",
      name: conversation.buyer.name,
    });
  }

  if (currentConversationTyping.has(conversation.sellerId)) {
    typingUsers.push({
      senderId: conversation.sellerId,
      role: "SELLER",
      name: conversation.seller.name,
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
    message.includes("cannot be refunded") ||
    message.includes("cannot be disputed") ||
    message.includes("cannot be resolved") ||
    message.includes("Недостаточно средств") ||
    message.includes("Checkout is not available") ||
    message.includes("could not be")
  ) {
    return 409;
  }

  return 400;
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const mappedProducts = await mapProductsWithSellerReviewSummary(products);

  return normalizeMappedProductsSellerLastSeen(mappedProducts);
}

export async function listCatalogGamesForProductForms() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const categories = await prisma.category.findMany({
    where: {
      gameId: {
        in: games.map((game) => game.id),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      gameId: true,
    },
    orderBy: [
      {
        gameId: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const categoriesByGameId = categories.reduce<
    Record<
      string,
      Array<{
        id: string;
        name: string;
        slug: string;
      }>
    >
  >((accumulator, category) => {
    if (!accumulator[category.gameId]) {
      accumulator[category.gameId] = [];
    }

    accumulator[category.gameId].push({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });

    return accumulator;
  }, {});

  return games.map((game) => ({
    ...game,
    categories: categoriesByGameId[game.id] ?? [],
  }));
}

export async function getProductById(
  productId: string,
  options?: {
    viewerId?: string | null;
    viewerRole?: Role | string | null;
  },
) {
  const normalizedProductId = normalizeText(productId);

  if (!normalizedProductId) {
    throw new Error("productId is required.");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  if (
    !product.isActive &&
    product.sellerId !== normalizeText(options?.viewerId ?? "") &&
    !isAdminRole((options?.viewerRole as Role | null | undefined) ?? undefined)
  ) {
    return null;
  }

  const [mappedProduct] = normalizeMappedProductsSellerLastSeen(
    await mapProductsWithSellerReviewSummary([product]),
  );

  return mappedProduct ?? null;
}

export async function createProduct(input: {
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  gameId?: string;
  categoryId?: string;
  sellerId?: string;
}) {
  const { title, description } = validateProductTextFields(input);
  const images = validateProductImages(input.images);
  const gameId = normalizeText(input.gameId);
  const categoryId = normalizeText(input.categoryId);
  const sellerId = normalizeText(input.sellerId);
  const price = Number(input.price);

  if (!gameId) {
    throw new Error("gameId is required.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required.");
  }

  if (!sellerId) {
    throw new Error("sellerId is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("price must be a positive number.");
  }

  const [seller, { game, category }] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: sellerId,
      },
      select: {
        id: true,
      },
    }),
    validateCatalogSelection(gameId, categoryId),
  ]);

  if (!seller) {
    throw new Error(`Seller with id ${sellerId} was not found.`);
  }

  const product = await prisma.product.create({
    data: {
      title,
      description,
      images,
      gameId,
      categoryId,
      sellerId,
      price: new Prisma.Decimal(price.toFixed(MONEY_SCALE)),
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
  });

  return {
    ...product,
    price: formatMoney(product.price),
  };
}

export async function updateProductByActor(input: {
  productId?: string;
  userId: string;
  role?: Role;
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  gameId?: string;
  categoryId?: string;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);
  const gameId = normalizeText(input.gameId);
  const categoryId = normalizeText(input.categoryId);
  const price = Number(input.price);
  const { title, description } = validateProductTextFields(input);
  const images = validateProductImages(input.images);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!gameId) {
    throw new Error("gameId is required.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("price must be a positive number.");
  }

  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      sellerId: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!existingProduct) {
    throw new Error(`Product with id ${productId} was not found.`);
  }

  ensureProductManagementAccess(userId, input.role, existingProduct);

  const { game } = await validateCatalogSelection(gameId, categoryId);

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      title,
      description,
      images,
      price: new Prisma.Decimal(price.toFixed(MONEY_SCALE)),
      gameId,
      categoryId,
    },
    select: {
      id: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  return {
    productId: updatedProduct.id,
    currentGameSlug: updatedProduct.game.slug,
    previousGameSlug: existingProduct.game.slug,
  };
}

export async function deleteProductByActor(input: {
  productId?: string;
  userId: string;
  role?: Role;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const product = await transactionClient.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          id: true,
          sellerId: true,
          game: {
            select: {
              slug: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
          orders: {
            where: {
              status: {
                notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

      if (!product) {
        throw new Error("Товар не найден.");
      }

      ensureProductManagementAccess(userId, input.role, product);

      if (product.orders.length > 0) {
        throw new Error("Нельзя удалить товар, пока у него есть активные сделки.");
      }

      if (product._count.orders > 0) {
        throw new Error("Нельзя удалить товар с историей сделок.");
      }

      await transactionClient.product.delete({
        where: {
          id: productId,
        },
      });

      return {
        productId: product.id,
        gameSlug: product.game.slug,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}

export async function toggleProductVisibilityBySeller(input: {
  productId?: string;
  userId: string;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      sellerId: true,
      isActive: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("Товар не найден.");
  }

  if (product.sellerId !== userId) {
    throw new Error("Только продавец может менять видимость своего товара.");
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isActive: !product.isActive,
    },
    select: {
      id: true,
      sellerId: true,
      isActive: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  return {
    productId: updatedProduct.id,
    sellerId: updatedProduct.sellerId,
    isActive: updatedProduct.isActive,
    gameSlug: updatedProduct.game.slug,
  };
}

export async function toggleAllProductsVisibilityBySeller(input: {
  userId: string;
  isActive: boolean;
}) {
  const userId = normalizeText(input.userId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  const seller = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error(`User with id ${userId} was not found.`);
  }

  const products = await prisma.product.findMany({
    where: {
      sellerId: userId,
    },
    select: {
      id: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  const result = await prisma.product.updateMany({
    where: {
      sellerId: userId,
    },
    data: {
      isActive: input.isActive,
    },
  });

  return {
    updatedCount: result.count,
    sellerId: userId,
    productIds: products.map((product) => product.id),
    gameSlugs: [...new Set(products.map((product) => product.game.slug))],
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
      emailVerified: true,
      name: true,
      image: true,
      emailNotifications: true,
      pushNotifications: true,
      role: true,
      rank: true,
      lastSeen: true,
      platformRevenue: true,
      availableBalance: true,
      holdBalance: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error(`User with id ${normalizedUserId} was not found.`);
  }

  const reviewSummary = await getSellerReviewSummaryBySellerId(normalizedUserId);

  return {
    ...user,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    name: user.name ?? user.email.split("@")[0],
    lastSeen: user.lastSeen.toISOString(),
    platformRevenue: user.platformRevenue,
    availableBalance: formatMoney(user.availableBalance),
    holdBalance: formatMoney(user.holdBalance),
    reviewSummary,
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
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return mapProductsWithSellerReviewSummary(products);
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

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const [buyer, product] = await Promise.all([
        transactionClient.user.findUnique({
          where: { id: buyerId },
          select: {
            id: true,
            availableBalance: true,
          },
        }),
        transactionClient.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            price: true,
            sellerId: true,
            isActive: true,
          },
        }),
      ]);

      if (!buyer) {
        throw new Error(`Buyer with id ${buyerId} was not found.`);
      }

      if (!product) {
        throw new Error(`Product with id ${productId} was not found.`);
      }

      if (!product.isActive) {
        throw new Error("Товар скрыт продавцом и недоступен для покупки.");
      }

      if (product.sellerId === buyerId) {
        throw new Error("Вы не можете купить свой собственный товар");
      }

      const orderPrice = roundMoney(product.price);

      if (buyer.availableBalance.comparedTo(orderPrice) < 0) {
        throw new Error("Недостаточно средств");
      }

      const existingPendingOrder = await transactionClient.order.findFirst({
        where: {
          buyerId,
          productId: product.id,
          status: OrderStatus.PENDING,
        },
        select: {
          id: true,
          sellerId: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const debitedBuyer = await transactionClient.user.updateMany({
        where: {
          id: buyerId,
          availableBalance: {
            gte: orderPrice,
          },
        },
        data: {
          availableBalance: {
            decrement: orderPrice,
          },
        },
      });

      if (debitedBuyer.count !== 1) {
        throw new Error("Недостаточно средств");
      }

      let orderId = existingPendingOrder?.id;

      if (existingPendingOrder) {
        const updatedOrder = await transactionClient.order.updateMany({
          where: {
            id: existingPendingOrder.id,
            status: OrderStatus.PENDING,
          },
          data: {
            sellerId: product.sellerId,
            price: orderPrice,
            status: OrderStatus.PAID,
          },
        });

        if (updatedOrder.count !== 1) {
          throw new Error(`Order ${existingPendingOrder.id} could not be funded.`);
        }
      } else {
        const createdOrder = await transactionClient.order.create({
          data: {
            buyerId,
            sellerId: product.sellerId,
            productId: product.id,
            price: orderPrice,
            status: OrderStatus.PAID,
          },
          select: {
            id: true,
          },
        });

        orderId = createdOrder.id;
      }

      if (!orderId) {
        throw new Error("Не удалось создать заказ.");
      }

      const platformAdmin = await getPlatformAdminAccount(transactionClient);

      await transactionClient.user.update({
        where: {
          id: platformAdmin.id,
        },
        data: {
          holdBalance: {
            increment: orderPrice,
          },
        },
      });

      await transactionClient.transaction.create({
        data: {
          userId: platformAdmin.id,
          orderId,
          amount: orderPrice,
          type: TransactionType.ESCROW_HOLD,
          status: TransactionStatus.COMPLETED,
        },
      });

      await createUserNotification(transactionClient, {
        userId: product.sellerId,
        title: "Новый заказ!",
        message: "У вас купили товар. Перейдите к сделке.",
        link: `/orders/${orderId}`,
      }, emailDeliveryQueue);

      return {
        orderId,
        status: OrderStatus.PAID,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await sendNotificationEmails(emailDeliveryQueue);

  return {
    orderId: result.orderId,
    status: result.status,
    hosted_url: `/orders/${result.orderId}`,
  };
}

export async function getPendingCheckoutOrder(input: {
  orderId?: string;
  buyerId: string;
}) {
  const orderId = normalizeText(input.orderId);
  const buyerId = normalizeText(input.buyerId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      buyerId: true,
      price: true,
      status: true,
      product: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const checkoutOrder = ensurePendingCheckoutAccess(buyerId, orderId, order);

  return {
    id: checkoutOrder.id,
    price: formatMoney(checkoutOrder.price),
    status: checkoutOrder.status,
    product: checkoutOrder.product,
  };
}

export async function getOrderById(
  orderId: string,
  userId: string,
  role?: string,
) {
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
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
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

  ensureOrderAccess(normalizedUserId, order, role);

  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
    price: formatMoney(order.price),
    platformFee: formatMoney(order.platformFee),
    status: order.status,
    chatRoomId: null,
    review: order.review
      ? {
          ...order.review,
          createdAt: order.review.createdAt.toISOString(),
        }
      : null,
    buyer: {
      ...order.buyer,
      lastSeen: order.buyer.lastSeen.toISOString(),
    },
    seller: {
      ...order.seller,
      lastSeen: order.seller.lastSeen.toISOString(),
    },
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

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const existingOrder = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          price: true,
          status: true,
        },
      });

      const checkoutOrder = ensurePendingCheckoutAccess(
        buyerId,
        orderId,
        existingOrder,
      );
      const escrowAmount = roundMoney(checkoutOrder.price);

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

      const platformAdmin = await getPlatformAdminAccount(transactionClient);

      await transactionClient.user.update({
        where: {
          id: platformAdmin.id,
        },
        data: {
          holdBalance: {
            increment: escrowAmount,
          },
        },
      });

      await transactionClient.transaction.create({
        data: {
          userId: platformAdmin.id,
          orderId: checkoutOrder.id,
          amount: escrowAmount,
          type: TransactionType.ESCROW_HOLD,
          status: TransactionStatus.COMPLETED,
        },
      });

      await createUserNotification(transactionClient, {
        userId: checkoutOrder.sellerId,
        title: "Новый заказ!",
        message: "У вас купили товар. Перейдите к сделке.",
        link: `/orders/${checkoutOrder.id}`,
      }, emailDeliveryQueue);

      return {
        orderId: checkoutOrder.id,
        status: OrderStatus.PAID,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await sendNotificationEmails(emailDeliveryQueue);

  return result;
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

  const result = await prisma.$transaction(
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

      ensureOrderIsNotTerminal(order.id, order.status, "completed");

      if (
        order.status !== OrderStatus.PAID &&
        order.status !== OrderStatus.DISPUTED
      ) {
        throw new Error(
          `Order ${orderId} cannot be completed from status ${order.status}.`,
        );
      }

      const orderAmount = roundMoney(order.price);
      const { fee, sellerPayout, feeAsNumber } = calculateCommissionBreakdown(
        orderAmount,
      );
      const platformAdmin = await getPlatformAdminAccount(transactionClient);
      const escrowHoldTransaction = await findCompletedEscrowHoldTransaction(
        transactionClient,
        {
          orderId: order.id,
          adminUserId: platformAdmin.id,
        },
      );

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [OrderStatus.PAID, OrderStatus.DISPUTED],
          },
        },
        data: {
          status: OrderStatus.COMPLETED,
          platformFee: fee,
          commission: feeAsNumber,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be completed.`);
      }

      if (escrowHoldTransaction) {
        await ensureSufficientUserBalance(transactionClient, {
          userId: platformAdmin.id,
          balanceField: "holdBalance",
          requiredAmount: orderAmount,
          errorMessage: "Недостаточно средств в escrow-холде платформы для завершения заказа.",
        });

        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            holdBalance: {
              decrement: orderAmount,
            },
            platformRevenue: {
              increment: feeAsNumber,
            },
          },
        });
      } else {
        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            platformRevenue: {
              increment: feeAsNumber,
            },
          },
        });
      }

      await transactionClient.user.update({
        where: {
          id: order.sellerId,
        },
        data: {
          availableBalance: {
            increment: sellerPayout,
          },
        },
      });

      const transaction = await transactionClient.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          amount: sellerPayout,
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
        platformFee: formatMoney(fee),
        sellerNetAmount: formatMoney(sellerPayout),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}

export async function refundOrder(input: { orderId: string; sellerId: string }) {
  const orderId = normalizeText(input.orderId);
  const sellerId = normalizeText(input.sellerId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!sellerId) {
    throw new Error("sellerId is required.");
  }

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];

  const result = await prisma.$transaction(
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

      if (order.sellerId !== sellerId) {
        throw new Error("Only the seller can refund this order.");
      }

      ensureOrderIsNotTerminal(order.id, order.status, "refunded");

      if (
        order.status !== OrderStatus.PAID &&
        order.status !== OrderStatus.DISPUTED
      ) {
        throw new Error(
          `Order ${orderId} cannot be refunded from status ${order.status}.`,
        );
      }

      const refundAmount = roundMoney(order.price);
      const platformAdmin = await getPlatformAdminAccount(transactionClient);
      const escrowHoldTransaction = await findCompletedEscrowHoldTransaction(
        transactionClient,
        {
          orderId: order.id,
          adminUserId: platformAdmin.id,
        },
      );

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [OrderStatus.PAID, OrderStatus.DISPUTED],
          },
        },
        data: {
          status: OrderStatus.REFUNDED,
          platformFee: ZERO_MONEY,
          commission: 0,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be refunded.`);
      }

      if (escrowHoldTransaction) {
        await ensureSufficientUserBalance(transactionClient, {
          userId: platformAdmin.id,
          balanceField: "holdBalance",
          requiredAmount: refundAmount,
          errorMessage: "Недостаточно средств в escrow-холде платформы для возврата средств.",
        });

        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            holdBalance: {
              decrement: refundAmount,
            },
          },
        });
      }

      await transactionClient.user.update({
        where: {
          id: order.buyerId,
        },
        data: {
          availableBalance: {
            increment: refundAmount,
          },
        },
      });

      await createUserNotification(transactionClient, {
        userId: order.buyerId,
        title: "Возврат по сделке",
        message: "Продавец оформил возврат средств по заказу.",
        link: `/orders/${order.id}`,
      }, emailDeliveryQueue);

      return {
        orderId: order.id,
        status: OrderStatus.REFUNDED,
        refundAmount: formatMoney(refundAmount),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await sendNotificationEmails(emailDeliveryQueue);

  return result;
}

export async function openOrderDispute(input: {
  orderId: string;
  userId: string;
}) {
  const orderId = normalizeText(input.orderId);
  const userId = normalizeText(input.userId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
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

      ensureOrderParticipant(userId, order);

      if (
        order.status !== OrderStatus.PAID &&
        order.status !== OrderStatus.DELIVERED
      ) {
        throw new Error(
          `Order ${orderId} cannot be disputed from status ${order.status}.`,
        );
      }

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [OrderStatus.PAID, OrderStatus.DELIVERED],
          },
        },
        data: {
          status: OrderStatus.DISPUTED,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be disputed.`);
      }

      return {
        orderId: order.id,
        status: OrderStatus.DISPUTED,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function resolveOrderDisputeToBuyer(input: { orderId: string }) {
  const orderId = normalizeText(input.orderId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          price: true,
          status: true,
        },
      });

      if (!order) {
        throw new Error(`Order with id ${orderId} was not found.`);
      }

      if (order.status !== OrderStatus.DISPUTED) {
        throw new Error(
          `Order ${orderId} cannot be resolved from status ${order.status}.`,
        );
      }

      const refundAmount = roundMoney(order.price);
      const platformAdmin = await getPlatformAdminAccount(transactionClient);
      const escrowHoldTransaction = await findCompletedEscrowHoldTransaction(
        transactionClient,
        {
          orderId: order.id,
          adminUserId: platformAdmin.id,
        },
      );

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.DISPUTED,
        },
        data: {
          status: OrderStatus.REFUNDED,
          platformFee: ZERO_MONEY,
          commission: 0,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be resolved to buyer.`);
      }

      if (escrowHoldTransaction) {
        await ensureSufficientUserBalance(transactionClient, {
          userId: platformAdmin.id,
          balanceField: "holdBalance",
          requiredAmount: refundAmount,
          errorMessage: "Недостаточно средств в escrow-холде платформы для возврата средств.",
        });

        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            holdBalance: {
              decrement: refundAmount,
            },
          },
        });
      }

      await transactionClient.user.update({
        where: {
          id: order.buyerId,
        },
        data: {
          availableBalance: {
            increment: refundAmount,
          },
        },
      });

      return {
        orderId: order.id,
        status: OrderStatus.REFUNDED,
        refundAmount: formatMoney(refundAmount),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function resolveOrderDisputeToSeller(input: { orderId: string }) {
  const orderId = normalizeText(input.orderId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  return prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          sellerId: true,
          price: true,
          status: true,
        },
      });

      if (!order) {
        throw new Error(`Order with id ${orderId} was not found.`);
      }

      if (order.status !== OrderStatus.DISPUTED) {
        throw new Error(
          `Order ${orderId} cannot be resolved from status ${order.status}.`,
        );
      }

      const orderAmount = roundMoney(order.price);
      const { fee, sellerPayout, feeAsNumber } = calculateCommissionBreakdown(
        orderAmount,
      );
      const platformAdmin = await getPlatformAdminAccount(transactionClient);
      const escrowHoldTransaction = await findCompletedEscrowHoldTransaction(
        transactionClient,
        {
          orderId: order.id,
          adminUserId: platformAdmin.id,
        },
      );

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.DISPUTED,
        },
        data: {
          status: OrderStatus.COMPLETED,
          platformFee: fee,
          commission: feeAsNumber,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be resolved to seller.`);
      }

      if (escrowHoldTransaction) {
        await ensureSufficientUserBalance(transactionClient, {
          userId: platformAdmin.id,
          balanceField: "holdBalance",
          requiredAmount: orderAmount,
          errorMessage: "Недостаточно средств в escrow-холде платформы для завершения заказа.",
        });

        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            holdBalance: {
              decrement: orderAmount,
            },
            platformRevenue: {
              increment: feeAsNumber,
            },
          },
        });
      } else {
        await transactionClient.user.update({
          where: {
            id: platformAdmin.id,
          },
          data: {
            platformRevenue: {
              increment: feeAsNumber,
            },
          },
        });
      }

      await transactionClient.user.update({
        where: {
          id: order.sellerId,
        },
        data: {
          availableBalance: {
            increment: sellerPayout,
          },
        },
      });

      await transactionClient.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          amount: sellerPayout,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
        },
      });

      return {
        orderId: order.id,
        status: OrderStatus.COMPLETED,
        platformFee: formatMoney(fee),
        sellerNetAmount: formatMoney(sellerPayout),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
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
      buyer: {
        select: {
          name: true,
          image: true,
          role: true,
        },
      },
      seller: {
        select: {
          name: true,
          image: true,
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

export async function listConversationsByUser(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const conversations = await prisma.conversation.findMany({
    where: {
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
      createdAt: true,
      updatedAt: true,
      buyer: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
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
      otherParty: {
        id: otherParty.id,
        name: otherParty.name,
        image: otherParty.image,
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
    otherParty: normalizedUserId === conversation.buyerId
      ? {
          role: "SELLER" as const,
          name: conversation.seller.name,
          image: conversation.seller.image,
          accountRole: conversation.seller.role,
        }
      : {
          role: "BUYER" as const,
          name: conversation.buyer.name,
          image: conversation.buyer.image,
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
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
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
  ensureConversationAccess(normalizedUserId, {
    ...conversation,
    latestOrder,
  }, role);

  return {
    conversationId: conversation.id,
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    })),
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
  const text = normalizeText(input.text);
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
    },
  });

  if (!conversation) {
    throw new Error(`Conversation with id ${conversationId} was not found.`);
  }

  ensureConversationParticipant(senderId, conversation);
  setTypingState(conversationId, senderId, false);

  const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];

  const message = await prisma.$transaction(
    async (transactionClient) => {
      const createdMessage = await transactionClient.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          text,
          imageUrl: imageBase64,
        },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      await transactionClient.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      await createUserNotification(transactionClient, {
        userId: recipientId,
        title: "Новое сообщение",
        message: "Вам написали в личном диалоге.",
        link: `/chats/${conversation.id}`,
      }, emailDeliveryQueue);

      return createdMessage;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await sendNotificationEmails(emailDeliveryQueue);

  return {
    conversationId: conversation.id,
    message: {
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    },
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

  return {
    conversationId: conversation.id,
    typingUsers: getTypingUsers(conversation),
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
          isRead: true,
          senderId: true,
          createdAt: true,
          updatedAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              image: true,
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

  return {
    orderId: order.id,
    chatRoomId: result.conversationId,
    message: result.message
      ? {
          id: result.message.id,
          content: result.message.text,
          imageUrl: result.message.imageUrl,
          isRead: result.message.isRead,
          senderId: result.message.senderId,
          createdAt: result.message.createdAt,
          updatedAt: result.message.updatedAt,
          sender: result.message.sender,
        }
      : null,
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

  return {
    orderId: order.id,
    typingUsers: result.typingUsers,
  };
}