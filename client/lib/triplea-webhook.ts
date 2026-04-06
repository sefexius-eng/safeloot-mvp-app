import { createHmac, timingSafeEqual } from "node:crypto";

import {
  OrderStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface TripleAWebhookPayload {
  event?: string;
  status?: string;
  payment_reference?: string;
  receive_amount?: number | string;
}

export function mapTripleAWebhookErrorToStatusCode(message: string) {
  if (message.includes("Missing Triplea-Signature")) {
    return 401;
  }

  if (message.includes("Invalid Triple-A webhook signature")) {
    return 401;
  }

  if (message.includes("not configured")) {
    return 500;
  }

  if (message.includes("was not found")) {
    return 404;
  }

  if (message.includes("cannot be completed")) {
    return 409;
  }

  return 400;
}

export async function handleTripleAWebhook(input: {
  rawBody: string;
  signature: string | null;
  payload: TripleAWebhookPayload;
}) {
  if (!input.rawBody) {
    throw new Error("Raw request body is required for signature verification.");
  }

  if (!input.signature) {
    throw new Error("Missing Triplea-Signature header.");
  }

  const notifySecret = getNotifySecret();

  if (!isValidSignature(input.rawBody, input.signature, notifySecret)) {
    throw new Error("Invalid Triple-A webhook signature.");
  }

  if (input.payload.event !== "payment" || input.payload.status !== "good") {
    return {
      processed: false,
      transactionId: null,
    };
  }

  const paymentReference = input.payload.payment_reference?.trim();

  if (!paymentReference) {
    throw new Error("payment_reference is required for a payment webhook.");
  }

  const receiveAmount = parseWebhookAmount(input.payload.receive_amount);

  return prisma.$transaction(
    async (transactionClient) => {
      const existingTransaction = await transactionClient.transaction.findUnique({
        where: {
          externalId: paymentReference,
        },
        select: {
          id: true,
          userId: true,
          orderId: true,
          type: true,
          status: true,
          order: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!existingTransaction) {
        throw new Error(
          `Transaction with externalId ${paymentReference} was not found.`,
        );
      }

      if (existingTransaction.status === TransactionStatus.COMPLETED) {
        return {
          processed: false,
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
        },
      });

      if (updatedTransaction.count !== 1) {
        throw new Error(
          `Transaction ${existingTransaction.id} cannot be completed from status ${existingTransaction.status}.`,
        );
      }

      if (
        existingTransaction.type === TransactionType.ESCROW_HOLD &&
        existingTransaction.orderId
      ) {
        if (existingTransaction.order?.status === OrderStatus.CANCELLED) {
          throw new Error(
            `Order ${existingTransaction.orderId} is cancelled and cannot be paid.`,
          );
        }

        if (existingTransaction.order?.status === OrderStatus.PENDING) {
          await transactionClient.order.update({
            where: {
              id: existingTransaction.orderId,
            },
            data: {
              status: OrderStatus.PAID,
            },
          });
        }
      } else {
        await transactionClient.user.update({
          where: {
            id: existingTransaction.userId,
          },
          data: {
            availableBalance: {
              increment: receiveAmount,
            },
          },
        });
      }

      return {
        processed: true,
        transactionId: existingTransaction.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

function getNotifySecret() {
  const notifySecret =
    process.env.TRIPLEA_NOTIFY_SECRET ??
    process.env.NOTIFY_SECRET ??
    process.env.notify_secret;

  if (!notifySecret?.trim()) {
    throw new Error("TRIPLEA_NOTIFY_SECRET is not configured.");
  }

  return notifySecret.trim();
}

function isValidSignature(
  rawBody: string,
  signatureHeader: string,
  notifySecret: string,
) {
  const normalizedSignature = signatureHeader.trim().replace(/^sha256=/i, "");
  const hexDigest = createHmac("sha256", notifySecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const base64Digest = createHmac("sha256", notifySecret)
    .update(rawBody, "utf8")
    .digest("base64");

  return (
    safeCompare(normalizedSignature, hexDigest) ||
    safeCompare(normalizedSignature, base64Digest)
  );
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseWebhookAmount(amount: number | string | undefined) {
  if (amount === undefined || amount === null || amount === "") {
    throw new Error("receive_amount is required for a payment webhook.");
  }

  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.lte(0)) {
    throw new Error("receive_amount must be greater than zero.");
  }

  return decimalAmount;
}