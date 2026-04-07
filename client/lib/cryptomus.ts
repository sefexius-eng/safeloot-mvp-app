import { createHash } from "node:crypto";

import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

const CRYPTOMUS_PAYMENT_ENDPOINT = "https://api.cryptomus.com/v1/payment";
const SUCCESS_STATUSES = new Set(["paid", "paid_over", "success", "succeeded"]);
const FAILED_STATUSES = new Set([
  "fail",
  "failed",
  "cancel",
  "canceled",
  "cancelled",
  "system_fail",
  "expired",
]);

interface CryptomusConfig {
  apiKey?: string;
  merchantId?: string;
  apiUrl: string;
  network?: string;
}

interface CryptomusCreateInvoiceResponse {
  state?: number;
  message?: string;
  error?: string;
  result?: {
    uuid?: string;
    url?: string;
  };
}

export interface CryptomusInvoiceResult {
  checkoutUrl: string;
  providerId: string | null;
  isMock: boolean;
}

export interface CryptomusWebhookPayload {
  order_id?: string;
  uuid?: string;
  status?: string;
  payment_status?: string;
  amount?: number | string;
  pay_amount?: number | string;
  currency?: string;
}

export function mapCryptomusWebhookErrorToStatusCode(message: string) {
  if (message.includes("required")) {
    return 400;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("Amount mismatch")) {
    return 409;
  }

  if (message.includes("not a balance topup")) {
    return 409;
  }

  if (message.includes("cannot be completed")) {
    return 409;
  }

  return 400;
}

export async function createCryptomusInvoice(input: {
  transactionId: string;
  amount: Prisma.Decimal;
  currency?: string;
}) {
  const baseUrl = getSiteUrl();
  const config = getCryptomusConfig();

  if (!config.apiKey || !config.merchantId) {
    return {
      checkoutUrl: `${baseUrl}/topup-mock?transactionId=${input.transactionId}`,
      providerId: `mock-${input.transactionId}`,
      isMock: true,
    } satisfies CryptomusInvoiceResult;
  }

  const payload: Record<string, string | number | boolean> = {
    amount: input.amount.toFixed(2),
    currency: input.currency ?? "USDT",
    order_id: input.transactionId,
    url_return: `${baseUrl}/profile?topup=success`,
    url_callback: `${baseUrl}/api/webhooks/cryptomus`,
    is_payment_multiple: false,
    lifetime: 3600,
  };

  if (config.network) {
    payload.network = config.network;
  }

  const rawPayload = JSON.stringify(payload);
  const sign = createHash("md5")
    .update(Buffer.from(rawPayload).toString("base64") + config.apiKey)
    .digest("hex");

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      merchant: config.merchantId,
      sign,
      "Content-Type": "application/json",
    },
    body: rawPayload,
    cache: "no-store",
  });

  const payloadResponse =
    (await response.json().catch(() => null)) as CryptomusCreateInvoiceResponse | null;

  if (!response.ok) {
    throw new Error(
      payloadResponse?.message ||
        payloadResponse?.error ||
        "Не удалось создать счёт на оплату через Cryptomus.",
    );
  }

  const checkoutUrl = payloadResponse?.result?.url?.trim();

  if (!checkoutUrl) {
    throw new Error("Cryptomus не вернул checkout URL.");
  }

  return {
    checkoutUrl,
    providerId: payloadResponse?.result?.uuid?.trim() || null,
    isMock: false,
  } satisfies CryptomusInvoiceResult;
}

export async function handleCryptomusWebhook(input: {
  rawBody: string;
  signature: string | null;
  payload: CryptomusWebhookPayload;
}) {
  const transactionId = input.payload.order_id?.trim();

  if (!transactionId) {
    throw new Error("order_id is required for a Cryptomus webhook.");
  }

  const providerId = input.payload.uuid?.trim() || null;
  const paymentStatus = normalizePaymentStatus(input.payload);
  const webhookAmount = parseOptionalAmount(
    input.payload.pay_amount ?? input.payload.amount,
  );

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
          status: true,
          type: true,
          externalId: true,
        },
      });

      if (!existingTransaction) {
        throw new Error(`Transaction with id ${transactionId} was not found.`);
      }

      if (existingTransaction.type !== TransactionType.DEPOSIT) {
        throw new Error(`Transaction ${transactionId} is not a balance topup.`);
      }

      if (webhookAmount && !existingTransaction.amount.equals(webhookAmount)) {
        throw new Error(`Amount mismatch for transaction ${transactionId}.`);
      }

      if (SUCCESS_STATUSES.has(paymentStatus)) {
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
      }

      if (
        FAILED_STATUSES.has(paymentStatus) &&
        existingTransaction.status === TransactionStatus.PENDING
      ) {
        await transactionClient.transaction.update({
          where: {
            id: existingTransaction.id,
          },
          data: {
            status: TransactionStatus.FAILED,
            ...(providerId
              ? {
                  externalId: providerId,
                }
              : {}),
          },
        });
      }

      return {
        processed: false,
        alreadyProcessed: false,
        transactionId: existingTransaction.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

function getCryptomusConfig(): CryptomusConfig {
  return {
    apiKey: process.env.CRYPTOMUS_API_KEY?.trim(),
    merchantId: process.env.CRYPTOMUS_MERCHANT_ID?.trim(),
    apiUrl: process.env.CRYPTOMUS_API_URL?.trim() || CRYPTOMUS_PAYMENT_ENDPOINT,
    network: process.env.CRYPTOMUS_NETWORK?.trim(),
  };
}

function normalizePaymentStatus(payload: CryptomusWebhookPayload) {
  return (payload.status ?? payload.payment_status ?? "")
    .toString()
    .trim()
    .toLowerCase();
}

function parseOptionalAmount(amount: number | string | undefined) {
  if (amount === undefined || amount === null || amount === "") {
    return null;
  }

  const decimalAmount = new Prisma.Decimal(amount);

  if (decimalAmount.lte(0)) {
    throw new Error("Webhook amount must be greater than zero.");
  }

  return decimalAmount;
}