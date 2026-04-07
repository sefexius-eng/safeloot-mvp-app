"use server";

import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStripeCheckoutSession } from "@/lib/stripe";

interface CreateTopupSessionResult {
  ok: boolean;
  checkoutUrl?: string;
  transactionId?: string;
  isMock?: boolean;
  message?: string;
}

async function requireActivePaymentUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

function normalizeTopupAmount(amount: number) {
  if (!Number.isFinite(amount)) {
    throw new Error("Укажите корректную сумму пополнения.");
  }

  const normalizedAmount = new Prisma.Decimal(amount.toFixed(2));

  if (normalizedAmount.lt(1)) {
    throw new Error("Минимальная сумма пополнения — 1 USD.");
  }

  if (normalizedAmount.gt(100000)) {
    throw new Error("Сумма пополнения превышает допустимый лимит.");
  }

  return normalizedAmount;
}

export async function createTopupSession(
  amount: number,
): Promise<CreateTopupSessionResult> {
  try {
    const currentUser = await requireActivePaymentUser();
    const normalizedAmount = normalizeTopupAmount(amount);
    const transaction = await prisma.transaction.create({
      data: {
        userId: currentUser.id,
        amount: normalizedAmount,
        currency: "USD",
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      },
      select: {
        id: true,
        amount: true,
      },
    });

    try {
      const checkoutSession = await createStripeCheckoutSession({
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: "USD",
      });

      if (checkoutSession.providerId) {
        await prisma.transaction.update({
          where: {
            id: transaction.id,
          },
          data: {
            externalId: checkoutSession.providerId,
          },
        });
      }

      return {
        ok: true,
        checkoutUrl: checkoutSession.checkoutUrl,
        transactionId: transaction.id,
        isMock: checkoutSession.isMock,
      };
    } catch (error) {
      await prisma.transaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: TransactionStatus.FAILED,
        },
      });

      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось создать checkout сессию на пополнение.",
    };
  }
}

export const createTopupInvoice = createTopupSession;