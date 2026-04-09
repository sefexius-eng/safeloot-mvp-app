import {
  OrderStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import {
  sendNotificationEmails,
  type NotificationEmailDeliveryInput,
} from "@/lib/notification-delivery";
import { createOrderSystemMessages } from "@/lib/domain/chat-service";
import { publishSystemTavernPurchaseAnnouncement } from "@/lib/domain/tavern";
import { publishOrderUpdatedEvent } from "@/lib/pusher";
import { prisma } from "@/lib/prisma";
import { normalizeCurrencyCode } from "@/lib/currency-config";

import {
  ACHIEVEMENT_CODES,
  grantAchievementToUserIfExists,
  maybeGrantBuyerPurchaseAchievements,
  maybeGrantSellerSaleAchievements,
  runAchievementAutomation,
} from "@/lib/domain/achievements";
import {
  calculateCommissionBreakdown,
  ensureOrderAccess,
  ensureOrderIsNotTerminal,
  ensureOrderParticipant,
  ensurePendingCheckoutAccess,
  ensureSufficientUserBalance,
  findCompletedEscrowHoldTransaction,
  formatMoney,
  getPlatformAdminAccount,
  normalizeText,
  roundMoney,
  ZERO_MONEY,
} from "@/lib/domain/shared";
import {
  createUserNotification,
  sendNotificationRealtimeEvents,
  type NotificationRealtimeDeliveryInput,
  sendBuyerRefundTelegramNotification,
  sendOrderDisputeOpenedTelegramNotification,
  sendSellerOrderCompletedTelegramNotification,
  sendSellerOrderTelegramNotification,
} from "@/lib/domain/notifications-service";

const ZERO_PLATFORM_FEE = formatMoney(ZERO_MONEY);
const ORDER_PAID_SYSTEM_MESSAGE =
  "Оплата получена. SafeLoot зарезервировал средства по сделке. Продавец может передать товар в этом чате.";
const ORDER_COMPLETED_SYSTEM_MESSAGE =
  "Сделка успешно завершена. Средства переведены продавцу.";
const ORDER_REFUNDED_SYSTEM_MESSAGE =
  "Возврат оформлен. Средства возвращены покупателю.";
const ORDER_DISPUTE_RESOLVED_TO_BUYER_SYSTEM_MESSAGE =
  "Спор завершен в пользу покупателя. Средства возвращены покупателю.";
const ORDER_DISPUTE_RESOLVED_TO_SELLER_SYSTEM_MESSAGE =
  "Спор завершен в пользу продавца. Сделка завершена, средства переведены продавцу.";

function getOrderDisputeOpenedSystemMessage(openedBy: "buyer" | "seller") {
  return openedBy === "buyer"
    ? "Покупатель открыл спор. Команда SafeLoot подключится к разбору сделки."
    : "Продавец открыл спор. Команда SafeLoot подключится к разбору сделки.";
}

function getAutoDeliverySystemMessage(autoDeliveryContent: string) {
  return `Система SafeLoot: ${autoDeliveryContent}`;
}

function logSettledSideEffectResults(
  scope: string,
  results: PromiseSettledResult<unknown>[],
) {
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[${scope}_${index}_ERROR]`, result.reason);
    }
  });
}

async function publishPaidOrderRealtimeAndSystem(input: {
  orderId: string;
  buyerId: string;
  sellerTelegramId: bigint | null;
  productTitle: string;
  orderPrice: string;
  orderCurrency: string;
  autoDeliveryContent: string | null;
}) {
  const systemMessages = [ORDER_PAID_SYSTEM_MESSAGE];

  if (input.autoDeliveryContent) {
    systemMessages.push(getAutoDeliverySystemMessage(input.autoDeliveryContent));
  }

  const sideEffectResults = await Promise.allSettled([
    sendSellerOrderTelegramNotification({
      telegramId: input.sellerTelegramId,
      productTitle: input.productTitle,
      price: input.orderPrice,
      currency: input.orderCurrency,
    }),
    publishOrderUpdatedEvent({
      orderId: input.orderId,
      status: OrderStatus.PAID,
      platformFee: ZERO_PLATFORM_FEE,
    }),
    createOrderSystemMessages({
      orderId: input.orderId,
      senderId: input.buyerId,
      texts: systemMessages,
      ensureDedicatedConversation: true,
    }),
  ]);

  logSettledSideEffectResults("ORDER_PAID_SIDE_EFFECT", sideEffectResults);
}

export async function createOrder(input: {
  productId?: string;
  buyerId: string;
  currency?: string;
}) {
  const productId = normalizeText(input.productId);
  const buyerId = normalizeText(input.buyerId);
  const orderCurrency = normalizeCurrencyCode(input.currency);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!buyerId) {
    throw new Error("buyerId is required.");
  }

  const emailDeliveryQueue: NotificationEmailDeliveryInput[] = [];
  const realtimeNotificationQueue: NotificationRealtimeDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const [buyer, product] = await Promise.all([
        transactionClient.user.findUnique({
          where: { id: buyerId },
          select: {
            id: true,
            email: true,
            name: true,
            availableBalance: true,
          },
        }),
        transactionClient.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            title: true,
            autoDeliveryContent: true,
            price: true,
            sellerId: true,
            isActive: true,
            game: {
              select: {
                name: true,
              },
            },
            seller: {
              select: {
                telegramId: true,
              },
            },
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
            currency: orderCurrency,
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
            currency: orderCurrency,
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

      await createUserNotification(
        transactionClient,
        {
          userId: product.sellerId,
          title: "Новый заказ!",
          message: "У вас купили товар. Перейдите к сделке.",
          link: `/orders/${orderId}`,
        },
        emailDeliveryQueue,
        realtimeNotificationQueue,
      );

      return {
        orderId,
        status: OrderStatus.PAID,
        sellerTelegramId: product.seller.telegramId,
        productTitle: product.title,
        orderPrice: formatMoney(orderPrice),
        orderCurrency,
        autoDeliveryContent: product.autoDeliveryContent,
        buyerDisplayName:
          normalizeText(buyer.name ?? undefined) || buyer.email.split("@")[0],
        gameName: normalizeText(product.game.name) || "игры",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  const postCommitResults = await Promise.allSettled([
    sendNotificationEmails(emailDeliveryQueue),
    sendNotificationRealtimeEvents(realtimeNotificationQueue),
    publishPaidOrderRealtimeAndSystem({
      orderId: result.orderId,
      buyerId,
      sellerTelegramId: result.sellerTelegramId,
      productTitle: result.productTitle,
      orderPrice: result.orderPrice,
      orderCurrency: result.orderCurrency,
      autoDeliveryContent: result.autoDeliveryContent,
    }),
  ]);

  logSettledSideEffectResults("CREATE_ORDER_POST_COMMIT", postCommitResults);

  try {
    await publishSystemTavernPurchaseAnnouncement({
      buyerName: result.buyerDisplayName,
      gameName: result.gameName,
    });
  } catch (error) {
    console.error("[TAVERN_PURCHASE_ANNOUNCEMENT_ERROR]", error);
  }

  try {
    await runAchievementAutomation("create-order", [
      {
        label: "buyer-purchase-achievements",
        run: () => maybeGrantBuyerPurchaseAchievements(buyerId),
      },
    ]);
  } catch (error) {
    console.error("[CREATE_ORDER_ACHIEVEMENTS_ERROR]", error);
  }

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
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          sellerReply: true,
          replyCreatedAt: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              ...USER_APPEARANCE_SELECT,
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          title: true,
        },
      },
      conversation: {
        select: {
          id: true,
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
    currency: order.currency,
    platformFee: formatMoney(order.platformFee),
    status: order.status,
    chatRoomId: order.conversation?.id ?? null,
    review: order.review
      ? {
          ...order.review,
          createdAt: order.review.createdAt.toISOString(),
          replyCreatedAt: order.review.replyCreatedAt?.toISOString() ?? null,
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
  const realtimeNotificationQueue: NotificationRealtimeDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const existingOrder = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          price: true,
          currency: true,
          status: true,
          seller: {
            select: {
              telegramId: true,
            },
          },
          product: {
            select: {
              title: true,
              autoDeliveryContent: true,
            },
          },
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

      await createUserNotification(
        transactionClient,
        {
          userId: checkoutOrder.sellerId,
          title: "Новый заказ!",
          message: "У вас купили товар. Перейдите к сделке.",
          link: `/orders/${checkoutOrder.id}`,
        },
        emailDeliveryQueue,
        realtimeNotificationQueue,
      );

      return {
        orderId: checkoutOrder.id,
        status: OrderStatus.PAID,
        sellerTelegramId: checkoutOrder.seller.telegramId,
        productTitle: checkoutOrder.product.title,
        orderPrice: formatMoney(escrowAmount),
        orderCurrency: checkoutOrder.currency,
        autoDeliveryContent: checkoutOrder.product.autoDeliveryContent,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await Promise.all([
    sendNotificationEmails(emailDeliveryQueue),
    sendNotificationRealtimeEvents(realtimeNotificationQueue),
    publishPaidOrderRealtimeAndSystem({
      orderId: result.orderId,
      buyerId,
      sellerTelegramId: result.sellerTelegramId,
      productTitle: result.productTitle,
      orderPrice: result.orderPrice,
      orderCurrency: result.orderCurrency,
      autoDeliveryContent: result.autoDeliveryContent,
    }),
  ]);

  await runAchievementAutomation("confirm-order", [
    {
      label: "buyer-purchase-achievements",
      run: () => maybeGrantBuyerPurchaseAchievements(buyerId),
    },
  ]);

  return {
    orderId: result.orderId,
    status: result.status,
  };
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
          currency: true,
          status: true,
          seller: {
            select: {
              telegramId: true,
            },
          },
          product: {
            select: {
              title: true,
            },
          },
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
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        status: OrderStatus.COMPLETED,
        platformFee: formatMoney(fee),
        sellerNetAmount: formatMoney(sellerPayout),
        sellerTelegramId: order.seller.telegramId,
        productTitle: order.product.title,
        orderCurrency: order.currency,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await Promise.all([
    sendSellerOrderCompletedTelegramNotification({
      telegramId: result.sellerTelegramId,
      productTitle: result.productTitle,
      sellerNetAmount: result.sellerNetAmount,
      currency: result.orderCurrency,
    }),
    publishOrderUpdatedEvent({
      orderId: result.orderId,
      status: result.status,
      platformFee: result.platformFee,
      sellerNetAmount: result.sellerNetAmount,
    }),
    createOrderSystemMessages({
      orderId: result.orderId,
      senderId: buyerId,
      texts: [ORDER_COMPLETED_SYSTEM_MESSAGE],
    }),
  ]);

  await runAchievementAutomation("complete-order", [
    {
      label: "buyer-first-trade-achievement",
      run: () =>
        grantAchievementToUserIfExists({
          userId: result.buyerId,
          achievementCode: ACHIEVEMENT_CODES.FIRST_TRADE,
          notifyUser: true,
        }),
    },
    {
      label: "seller-first-trade-achievement",
      run: () =>
        grantAchievementToUserIfExists({
          userId: result.sellerId,
          achievementCode: ACHIEVEMENT_CODES.FIRST_TRADE,
          notifyUser: true,
        }),
    },
    {
      label: "seller-sale-achievements",
      run: () => maybeGrantSellerSaleAchievements(result.sellerId),
    },
  ]);

  return {
    orderId: result.orderId,
    transactionId: result.transactionId,
    status: result.status,
    platformFee: result.platformFee,
    sellerNetAmount: result.sellerNetAmount,
  };
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
  const realtimeNotificationQueue: NotificationRealtimeDeliveryInput[] = [];

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          price: true,
          currency: true,
          status: true,
          buyer: {
            select: {
              telegramId: true,
            },
          },
          product: {
            select: {
              title: true,
            },
          },
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

      await createUserNotification(
        transactionClient,
        {
          userId: order.buyerId,
          title: "Возврат по сделке",
          message: "Продавец оформил возврат средств по заказу.",
          link: `/orders/${order.id}`,
        },
        emailDeliveryQueue,
        realtimeNotificationQueue,
      );

      return {
        orderId: order.id,
        status: OrderStatus.REFUNDED,
        refundAmount: formatMoney(refundAmount),
        buyerTelegramId: order.buyer.telegramId,
        productTitle: order.product.title,
        orderCurrency: order.currency,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await Promise.all([
    sendNotificationEmails(emailDeliveryQueue),
    sendNotificationRealtimeEvents(realtimeNotificationQueue),
    sendBuyerRefundTelegramNotification({
      telegramId: result.buyerTelegramId,
      productTitle: result.productTitle,
      refundAmount: result.refundAmount,
      currency: result.orderCurrency,
    }),
    publishOrderUpdatedEvent({
      orderId: result.orderId,
      status: result.status,
      platformFee: ZERO_PLATFORM_FEE,
      refundAmount: result.refundAmount,
    }),
    createOrderSystemMessages({
      orderId: result.orderId,
      senderId: sellerId,
      texts: [ORDER_REFUNDED_SYSTEM_MESSAGE],
    }),
  ]);

  return {
    orderId: result.orderId,
    status: result.status,
    refundAmount: result.refundAmount,
  };
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

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const order = await transactionClient.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
          buyer: {
            select: {
              telegramId: true,
            },
          },
          seller: {
            select: {
              telegramId: true,
            },
          },
          product: {
            select: {
              title: true,
            },
          },
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

      const disputeOpenedBy = order.buyerId === userId ? "buyer" : "seller";

      return {
        orderId: order.id,
        status: OrderStatus.DISPUTED,
        recipientTelegramId:
          disputeOpenedBy === "buyer"
            ? order.seller.telegramId
            : order.buyer.telegramId,
        productTitle: order.product.title,
        openedBy: disputeOpenedBy,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await Promise.all([
    sendOrderDisputeOpenedTelegramNotification({
      telegramId: result.recipientTelegramId,
      productTitle: result.productTitle,
      openedBy: result.openedBy as "buyer" | "seller",
    }),
    publishOrderUpdatedEvent({
      orderId: result.orderId,
      status: result.status,
      platformFee: ZERO_PLATFORM_FEE,
    }),
    createOrderSystemMessages({
      orderId: result.orderId,
      senderId: userId,
      texts: [getOrderDisputeOpenedSystemMessage(result.openedBy as "buyer" | "seller")],
    }),
  ]);

  return {
    orderId: result.orderId,
    status: result.status,
  };
}

export async function resolveOrderDisputeToBuyer(input: { orderId: string }) {
  const orderId = normalizeText(input.orderId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  const result = await prisma.$transaction(
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
        buyerId: order.buyerId,
        refundAmount: formatMoney(refundAmount),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await publishOrderUpdatedEvent({
    orderId: result.orderId,
    status: result.status,
    platformFee: ZERO_PLATFORM_FEE,
    refundAmount: result.refundAmount,
  });

  await createOrderSystemMessages({
    orderId: result.orderId,
    senderId: result.buyerId,
    texts: [ORDER_DISPUTE_RESOLVED_TO_BUYER_SYSTEM_MESSAGE],
  });

  return result;
}

export async function resolveOrderDisputeToSeller(input: { orderId: string }) {
  const orderId = normalizeText(input.orderId);

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  const result = await prisma.$transaction(
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
        sellerId: order.sellerId,
        platformFee: formatMoney(fee),
        sellerNetAmount: formatMoney(sellerPayout),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await publishOrderUpdatedEvent({
    orderId: result.orderId,
    status: result.status,
    platformFee: result.platformFee,
    sellerNetAmount: result.sellerNetAmount,
  });

  await createOrderSystemMessages({
    orderId: result.orderId,
    senderId: result.sellerId,
    texts: [ORDER_DISPUTE_RESOLVED_TO_SELLER_SYSTEM_MESSAGE],
  });

  return result;
}