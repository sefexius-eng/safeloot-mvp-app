import Stripe from "stripe";
import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export function mapStripeWebhookErrorToStatusCode(message: string) {
  if (message.includes("Missing Stripe-Signature")) {
    return 401;
  }

  if (message.includes("Invalid Stripe webhook signature")) {
    return 401;
  }

  if (message.includes("not configured")) {
    return 500;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (
    message.includes("Amount mismatch") ||
    message.includes("Currency mismatch") ||
    message.includes("not a balance topup") ||
    message.includes("cannot be completed")
  ) {
    return 409;
  }

  return 400;
}

export async function handleCompletedTopupSession(
  session: Stripe.Checkout.Session,
) {
  const transactionId = session.client_reference_id?.trim();

  if (!transactionId) {
    throw new Error(
      "client_reference_id is required for a Stripe checkout.session.completed webhook.",
    );
  }

  if (session.payment_status !== "paid") {
    return {
      processed: false,
      alreadyProcessed: false,
      transactionId,
    };
  }

  const providerId = session.id?.trim() || null;
  const amount = parseAmountTotal(session.amount_total);
  const currency = normalizeCurrency(session.currency ?? "USD");

  return prisma.$transaction(
    async (transactionClient) => {
      const existingTransaction = await transactionClient.transaction.findUnique({
        where: {
          id: transactionId,
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          status: true,
          type: true,
        },
      });

      if (!existingTransaction) {
        throw new Error(`Transaction with id ${transactionId} was not found.`);
      }

      if (existingTransaction.type !== TransactionType.DEPOSIT) {
        throw new Error(`Transaction ${transactionId} is not a balance topup.`);
      }

      if (!existingTransaction.amount.equals(amount)) {
        throw new Error(`Amount mismatch for transaction ${transactionId}.`);
      }

      if (normalizeCurrency(existingTransaction.currency) !== currency) {
        throw new Error(`Currency mismatch for transaction ${transactionId}.`);
      }

      if (existingTransaction.status === TransactionStatus.COMPLETED) {
        return {
          processed: false,
          alreadyProcessed: true,
          transactionId: existingTransaction.id,
        };
      }

      const updatedTransaction = await transactionClient.transaction.updateMany({
        where: {
          id: existingTransaction.id,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.COMPLETED,
          ...(providerId
            ? {
                externalId: providerId,
              }
            : {}),
        },
      });

      if (updatedTransaction.count !== 1) {
        throw new Error(
          `Transaction ${existingTransaction.id} cannot be completed from status ${existingTransaction.status}.`,
        );
      }

      await transactionClient.user.update({
        where: {
          id: existingTransaction.userId,
        },
        data: {
          availableBalance: {
            increment: existingTransaction.amount,
          },
        },
      });

      return {
        processed: true,
        alreadyProcessed: false,
        transactionId: existingTransaction.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

function normalizeCurrency(currency: string) {
  return currency.trim().toUpperCase();
}

function parseAmountTotal(amountTotal: number | null | undefined) {
  if (amountTotal === undefined || amountTotal === null || !Number.isFinite(amountTotal)) {
    throw new Error("amount_total is required for a Stripe webhook.");
  }

  if (amountTotal <= 0) {
    throw new Error("Stripe webhook amount_total must be greater than zero.");
  }

  return new Prisma.Decimal(amountTotal)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}