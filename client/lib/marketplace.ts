import {
  OrderStatus,
  Prisma,
  Role,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getSellerReviewSummary,
  getSellerReviewSummaryBySellerId,
  getSellerReviewSummaryMap,
} from "@/lib/review-summary";

const MONEY_SCALE = 8;
const PLATFORM_FEE_RATE = new Prisma.Decimal("0.05");
const TYPING_TTL_MS = 5000;
const MAX_MESSAGE_IMAGE_BASE64_LENGTH = 2_000_000;
const MAX_PRODUCT_TITLE_LENGTH = 60;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;
const MAX_PRODUCT_IMAGE_COUNT = 3;
const MAX_PRODUCT_IMAGE_BASE64_LENGTH = 2_000_000;
const PRODUCT_IMAGE_BASE64_PATTERN =
  /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;

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
  if (userId === product.sellerId || role === Role.ADMIN) {
    return;
  }

  throw new Error("Only the seller or admin can manage this product.");
}

function normalizeOptionalText(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  return normalizedValue || null;
}

function formatMoney(value: Prisma.Decimal) {
  return value.toFixed(MONEY_SCALE);
}

async function mapProductsWithSellerReviewSummary<
  T extends {
    price: Prisma.Decimal;
    seller: {
      id: string;
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
      reviewSummary: getSellerReviewSummary(reviewSummaryMap, product.seller.id),
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
  return role === "ADMIN" && status === OrderStatus.DISPUTED;
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

function ensureChatParticipant(
  userId: string,
  chatRoom: { buyerId: string; sellerId: string },
) {
  if (userId !== chatRoom.buyerId && userId !== chatRoom.sellerId) {
    throw new Error("Only order participants can access this chat.");
  }
}

function ensureChatAccess(
  userId: string,
  chatRoom: {
    buyerId: string;
    sellerId: string;
    order: { status: OrderStatus };
  },
  role?: string,
) {
  if (
    userId === chatRoom.buyerId ||
    userId === chatRoom.sellerId ||
    canAdminAccessDisputedOrder(role, chatRoom.order.status)
  ) {
    return;
  }

  throw new Error("Only order participants can access this chat.");
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
    message.includes("cannot be disputed") ||
    message.includes("cannot be resolved") ||
    message.includes("Checkout is not available") ||
    message.includes("could not be")
  ) {
    return 409;
  }

  return 400;
}

export async function listProducts() {
  const products = await prisma.product.findMany({
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
  });

  if (!product) {
    return null;
  }

  const [mappedProduct] = await mapProductsWithSellerReviewSummary([product]);

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

  return prisma.$transaction(
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
      name: true,
      image: true,
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

  const reviewSummary = await getSellerReviewSummaryBySellerId(normalizedUserId);

  return {
    ...user,
    name: user.name ?? user.email.split("@")[0],
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

  const order = await prisma.$transaction(
    async (transactionClient) => {
      const existingPendingOrder = await transactionClient.order.findFirst({
        where: {
          buyerId,
          productId: product.id,
          status: OrderStatus.PENDING,
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existingPendingOrder) {
        return existingPendingOrder;
      }

      return transactionClient.order.create({
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return {
    orderId: order.id,
    hosted_url: `/payment-mock?orderId=${order.id}`,
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
    chatRoomId: order.chatRoom?.id ?? null,
    review: order.review
      ? {
          ...order.review,
          createdAt: order.review.createdAt.toISOString(),
        }
      : null,
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

      const checkoutOrder = ensurePendingCheckoutAccess(
        buyerId,
        orderId,
        existingOrder,
      );

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
          orderId: checkoutOrder.id,
        },
        update: {
          buyerId: checkoutOrder.buyerId,
          sellerId: checkoutOrder.sellerId,
        },
        create: {
          orderId: checkoutOrder.id,
          buyerId: checkoutOrder.buyerId,
          sellerId: checkoutOrder.sellerId,
        },
      });

      return {
        orderId: checkoutOrder.id,
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

      const refundAmount = order.price.toDecimalPlaces(
        MONEY_SCALE,
        Prisma.Decimal.ROUND_HALF_UP,
      );

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.DISPUTED,
        },
        data: {
          status: OrderStatus.REFUNDED,
          platformFee: new Prisma.Decimal(0),
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be resolved to buyer.`);
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

      const platformFee = order.price
        .mul(PLATFORM_FEE_RATE)
        .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
      const sellerNetAmount = order.price
        .sub(platformFee)
        .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

      const updatedOrder = await transactionClient.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.DISPUTED,
        },
        data: {
          status: OrderStatus.COMPLETED,
          platformFee,
        },
      });

      if (updatedOrder.count !== 1) {
        throw new Error(`Order ${orderId} could not be resolved to seller.`);
      }

      await transactionClient.user.update({
        where: {
          id: order.sellerId,
        },
        data: {
          availableBalance: {
            increment: sellerNetAmount,
          },
        },
      });

      await transactionClient.transaction.create({
        data: {
          userId: order.sellerId,
          orderId: order.id,
          amount: sellerNetAmount,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
        },
      });

      return {
        orderId: order.id,
        status: OrderStatus.COMPLETED,
        platformFee: formatMoney(platformFee),
        sellerNetAmount: formatMoney(sellerNetAmount),
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
      order: {
        select: {
          status: true,
        },
      },
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

async function getChatRoomContextById(chatRoomId: string) {
  return prisma.chatRoom.findUnique({
    where: {
      id: chatRoomId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      order: {
        select: {
          status: true,
        },
      },
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

export async function getChatMessages(
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

  const chatRoom = await prisma.chatRoom.findUnique({
    where: {
      orderId: normalizedOrderId,
    },
    select: {
      id: true,
      orderId: true,
      buyerId: true,
      sellerId: true,
      order: {
        select: {
          status: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          content: true,
          imageUrl: true,
          isRead: true,
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

  ensureChatAccess(normalizedUserId, chatRoom, role);

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
  imageBase64?: string | null;
}) {
  const orderId = normalizeText(input.orderId);
  const senderId = normalizeText(input.senderId);
  const content = normalizeText(input.content);
  const imageBase64 = normalizeOptionalText(input.imageBase64);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  if (!senderId) {
    throw new Error("senderId is required.");
  }

  if (!content && !imageBase64) {
    throw new Error("content or imageBase64 is required.");
  }

  if (imageBase64 && !imageBase64.startsWith("data:image/webp;base64,")) {
    throw new Error("imageBase64 must be a WebP data URL.");
  }

  if (imageBase64 && imageBase64.length > MAX_MESSAGE_IMAGE_BASE64_LENGTH) {
    throw new Error("imageBase64 is too large.");
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
      imageUrl: imageBase64,
    },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      isRead: true,
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

export async function markChatMessagesAsRead(input: {
  chatRoomId: string;
  userId: string;
}) {
  const chatRoomId = normalizeText(input.chatRoomId);
  const userId = normalizeText(input.userId);

  if (!chatRoomId) {
    throw new Error("chatRoomId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const chatRoom = await getChatRoomContextById(chatRoomId);

  if (!chatRoom) {
    throw new Error(`Chat room ${chatRoomId} was not found.`);
  }

  ensureChatParticipant(userId, chatRoom);

  const updatedMessages = await prisma.message.updateMany({
    where: {
      chatRoomId,
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
    chatRoomId: chatRoom.id,
    orderId: chatRoom.orderId,
    updatedCount: updatedMessages.count,
  };
}

export async function getChatTyping(
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

  const chatRoom = await getChatRoomContext(normalizedOrderId);

  if (!chatRoom) {
    throw new Error(`Chat for order ${normalizedOrderId} was not found.`);
  }

  ensureChatAccess(normalizedUserId, chatRoom, role);

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