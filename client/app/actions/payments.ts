"use server";

import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  getCurrencyDefinition,
  isStripeTopupCurrency,
  type CurrencyCode,
} from "@/lib/currency-config";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { stripe } from "@/lib/stripe";

interface CreateTopupSessionResult {
  ok: boolean;
  checkoutUrl?: string;
  transactionId?: string;
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

function normalizeTopupAmount(amount: number, currencyCode: CurrencyCode) {
  if (!Number.isFinite(amount)) {
    throw new Error("Укажите корректную сумму пополнения.");
  }

  const currencyDefinition = getCurrencyDefinition(currencyCode);
  const normalizedAmount = new Prisma.Decimal(amount.toFixed(2));
  const minimumAmount = new Prisma.Decimal(currencyDefinition.rate).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const maximumAmount = new Prisma.Decimal(100000)
    .mul(currencyDefinition.rate)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  if (normalizedAmount.lt(minimumAmount)) {
    throw new Error(
      `Минимальная сумма пополнения — ${minimumAmount.toFixed(2)} ${currencyCode}.`,
    );
  }

  if (normalizedAmount.gt(maximumAmount)) {
    throw new Error("Сумма пополнения превышает допустимый лимит.");
  }

  return normalizedAmount;
}

function convertPaymentAmountToUsd(
  amount: Prisma.Decimal,
  currencyCode: CurrencyCode,
) {
  const currencyDefinition = getCurrencyDefinition(currencyCode);

  return amount.div(currencyDefinition.rate).toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP);
}

function toMinorUnits(amount: Prisma.Decimal) {
  return amount
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

export async function createTopupSession(
  amount: number,
  currencyCode = "USD",
): Promise<CreateTopupSessionResult> {
  try {
    const currentUser = await requireActivePaymentUser();
    const normalizedCurrencyCode = currencyCode.trim().toUpperCase();

    if (!isStripeTopupCurrency(normalizedCurrencyCode)) {
      throw new Error("Для оплаты картой поддерживаются только USD, EUR и UAH.");
    }

    const normalizedAmount = normalizeTopupAmount(amount, normalizedCurrencyCode);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || getSiteUrl();
    const transaction = await prisma.transaction.create({
      data: {
        userId: currentUser.id,
        amount: normalizedAmount,
        currency: normalizedCurrencyCode,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      },
      select: {
        id: true,
        amount: true,
      },
    });

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: normalizedCurrencyCode.toLowerCase(),
              product_data: {
                name: "Пополнение баланса SafeLoot",
              },
              unit_amount: toMinorUnits(transaction.amount),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${appUrl}/profile?topup=success`,
        cancel_url: `${appUrl}/profile?topup=cancelled`,
        client_reference_id: transaction.id,
        metadata: {
          transactionId: transaction.id,
          creditedAmountUsd: convertPaymentAmountToUsd(
            transaction.amount,
            normalizedCurrencyCode,
          ).toFixed(8),
          paymentCurrency: normalizedCurrencyCode,
        },
      });

      const checkoutUrl = session.url?.trim();

      if (!checkoutUrl) {
        throw new Error("Stripe не вернул checkout URL.");
      }

      if (session.id) {
        await prisma.transaction.update({
          where: {
            id: transaction.id,
          },
          data: {
            externalId: session.id,
          },
        });
      }

      return {
        ok: true,
        checkoutUrl,
        transactionId: transaction.id,
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