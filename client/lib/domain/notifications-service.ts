import type { Prisma } from "@prisma/client";

import type { NotificationEmailDeliveryInput } from "@/lib/notification-delivery";
import { formatStoredOrderAmount } from "@/lib/currency-config";
import {
  publishUserNotificationEvent,
  type RealtimeNotificationPayload,
} from "@/lib/pusher";
import { getSiteUrl } from "@/lib/site-url";
import { escapeTelegramHtml, sendTelegramNotification } from "@/lib/telegram";

import { normalizeOptionalText, normalizeText } from "@/lib/domain/shared";

function formatTelegramNotificationAmount(
  amount: string | number,
  currency?: string | null,
) {
  return formatStoredOrderAmount(amount, currency);
}

function buildSellerNewOrderTelegramMessage(input: {
  productTitle: string;
  price: string;
  currency?: string | null;
}) {
  return [
    "🎉 <b>У вас новый заказ!</b>",
    "",
    `📦 <b>Товар:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `💰 <b>Сумма:</b> ${formatTelegramNotificationAmount(input.price, input.currency)}`,
    "",
    "Перейдите в свои сделки на SafeLoot, чтобы передать товар покупателю!",
  ].join("\n");
}

function buildSellerOrderCompletedTelegramMessage(input: {
  productTitle: string;
  sellerNetAmount: string;
  currency?: string | null;
}) {
  return [
    "✅ <b>Сделка завершена</b>",
    "",
    `📦 <b>Товар:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `💰 <b>Зачислено:</b> ${formatTelegramNotificationAmount(input.sellerNetAmount, input.currency)}`,
    "",
    "Средства уже доступны на вашем балансе SafeLoot.",
  ].join("\n");
}

function buildBuyerRefundTelegramMessage(input: {
  productTitle: string;
  refundAmount: string;
  currency?: string | null;
}) {
  return [
    "💸 <b>По заказу оформлен возврат</b>",
    "",
    `📦 <b>Товар:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `💰 <b>Сумма возврата:</b> ${formatTelegramNotificationAmount(input.refundAmount, input.currency)}`,
    "",
    "Средства уже возвращены на ваш баланс SafeLoot.",
  ].join("\n");
}

function buildOrderDisputeOpenedTelegramMessage(input: {
  productTitle: string;
  openedBy: "buyer" | "seller";
}) {
  const openedByLabel = input.openedBy === "buyer" ? "Покупатель" : "Продавец";

  return [
    "⚠️ <b>По сделке открыт спор</b>",
    "",
    `📦 <b>Товар:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `ℹ️ <b>Кто открыл:</b> ${openedByLabel}`,
    "",
    "Откройте сделку на SafeLoot, чтобы ознакомиться с деталями спора.",
  ].join("\n");
}

export async function sendSellerOrderTelegramNotification(input: {
  telegramId?: bigint | null;
  productTitle: string;
  price: string;
  currency?: string | null;
}) {
  if (!input.telegramId) {
    return;
  }

  await sendTelegramNotification(
    input.telegramId,
    buildSellerNewOrderTelegramMessage({
      productTitle: input.productTitle,
      price: input.price,
      currency: input.currency,
    }),
  );
}

export async function sendSellerOrderCompletedTelegramNotification(input: {
  telegramId?: bigint | null;
  productTitle: string;
  sellerNetAmount: string;
  currency?: string | null;
}) {
  if (!input.telegramId) {
    return;
  }

  await sendTelegramNotification(
    input.telegramId,
    buildSellerOrderCompletedTelegramMessage({
      productTitle: input.productTitle,
      sellerNetAmount: input.sellerNetAmount,
      currency: input.currency,
    }),
  );
}

export async function sendBuyerRefundTelegramNotification(input: {
  telegramId?: bigint | null;
  productTitle: string;
  refundAmount: string;
  currency?: string | null;
}) {
  if (!input.telegramId) {
    return;
  }

  await sendTelegramNotification(
    input.telegramId,
    buildBuyerRefundTelegramMessage({
      productTitle: input.productTitle,
      refundAmount: input.refundAmount,
      currency: input.currency,
    }),
  );
}

export async function sendOrderDisputeOpenedTelegramNotification(input: {
  telegramId?: bigint | null;
  productTitle: string;
  openedBy: "buyer" | "seller";
}) {
  if (!input.telegramId) {
    return;
  }

  await sendTelegramNotification(
    input.telegramId,
    buildOrderDisputeOpenedTelegramMessage({
      productTitle: input.productTitle,
      openedBy: input.openedBy,
    }),
  );
}

function buildDealChatTelegramMessage(input: {
  orderId: string;
  productTitle: string;
  senderName: string;
  messageText: string;
}) {
  const dealUrl = `${getSiteUrl()}/order/${input.orderId}`;

  return [
    "💬 <b>Новое сообщение!</b>",
    "",
    `🛍 <b>Сделка:</b> ${escapeTelegramHtml(input.productTitle)}`,
    `👤 <b>От:</b> ${escapeTelegramHtml(input.senderName)}`,
    "",
    `<i>«${escapeTelegramHtml(input.messageText)}»</i>`,
    "",
    `<a href="${dealUrl}">Перейти в чат</a>`,
  ].join("\n");
}

async function sendDealChatMessageTelegramNotification(input: {
  telegramId?: bigint | null;
  orderId: string;
  productTitle: string;
  senderName: string;
  messageText: string;
}) {
  if (!input.telegramId) {
    return;
  }

  await sendTelegramNotification(
    input.telegramId,
    buildDealChatTelegramMessage({
      orderId: input.orderId,
      productTitle: input.productTitle,
      senderName: input.senderName,
      messageText: input.messageText,
    }),
  );
}

export function triggerDealChatTelegramNotification(input: {
  telegramId?: bigint | null;
  orderId: string;
  productTitle: string;
  senderName: string;
  messageText: string;
}) {
  if (!input.telegramId) {
    return;
  }

  try {
    void sendDealChatMessageTelegramNotification(input).catch((error) => {
      console.error("[DEAL_CHAT_TELEGRAM_NOTIFICATION_ERROR]", error);
    });
  } catch (error) {
    console.error("[DEAL_CHAT_TELEGRAM_NOTIFICATION_ERROR]", error);
  }
}

export interface NotificationRealtimeDeliveryInput {
  userId: string;
  notification: RealtimeNotificationPayload;
}

export async function sendNotificationRealtimeEvents(
  realtimeDeliveryQueue: NotificationRealtimeDeliveryInput[],
) {
  if (realtimeDeliveryQueue.length === 0) {
    return;
  }

  await Promise.all(
    realtimeDeliveryQueue.map(({ userId, notification }) =>
      publishUserNotificationEvent(userId, notification),
    ),
  );
}

export async function createUserNotification(
  transactionClient: Prisma.TransactionClient,
  input: {
    userId: string;
    title: string;
    message: string;
    link?: string;
  },
  emailDeliveryQueue?: NotificationEmailDeliveryInput[],
  realtimeDeliveryQueue?: NotificationRealtimeDeliveryInput[],
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

  const createdNotification = await transactionClient.notification.create({
    data: {
      userId,
      title,
      message,
      link,
    },
    select: {
      id: true,
      userId: true,
      title: true,
      message: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });

  if (recipientEmailDelivery && emailDeliveryQueue) {
    emailDeliveryQueue.push(recipientEmailDelivery);
  }

  if (realtimeDeliveryQueue) {
    realtimeDeliveryQueue.push({
      userId,
      notification: {
        id: createdNotification.id,
        title: createdNotification.title,
        message: createdNotification.message,
        link: createdNotification.link,
        isRead: createdNotification.isRead,
        createdAt: createdNotification.createdAt.toISOString(),
      },
    });
  }
}