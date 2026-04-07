import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";

interface StripeConfig {
  secretKey?: string;
  apiUrl: string;
}

interface StripeCreateCheckoutSessionResponse {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
}

interface StripeSessionMetadata {
  transactionId?: string;
  transaction_id?: string;
  [key: string]: string | undefined;
}

interface StripeCheckoutSessionObject {
  id?: string;
  client_reference_id?: string;
  metadata?: StripeSessionMetadata | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  status?: string | null;
}

export interface StripeCheckoutSessionResult {
  checkoutUrl: string;
  providerId: string | null;
  isMock: boolean;
}

export interface StripeWebhookPayload {
  id?: string;
  type?: string;
  data?: {
    object?: StripeCheckoutSessionObject | null;
  } | null;
}

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

export async function createStripeCheckoutSession(input: {
  transactionId: string;
  amount: Prisma.Decimal;
  currency?: string;
}) {
  const baseUrl = getSiteUrl();
  const config = getStripeConfig();
  const currency = normalizeCurrency(input.currency ?? "USD");

  if (!config.secretKey) {
    return {
      checkoutUrl: `${baseUrl}/topup-mock?transactionId=${input.transactionId}`,
      providerId: `cs_mock_${input.transactionId}`,
      isMock: true,
    } satisfies StripeCheckoutSessionResult;
  }

  const formData = new URLSearchParams();
  const minorUnits = toMinorUnits(input.amount);

  // TODO: Implement Stripe Checkout via the official Stripe SDK if you need subscriptions,
  // automatic tax, or richer event verification helpers beyond this Checkout session flow.
  formData.set("mode", "payment");
  formData.set("success_url", `${baseUrl}/profile?topup=success`);
  formData.set("cancel_url", `${baseUrl}/profile?topup=cancelled`);
  formData.set("client_reference_id", input.transactionId);
  formData.set("submit_type", "pay");
  formData.set("payment_method_types[0]", "card");
  formData.set("metadata[transactionId]", input.transactionId);
  formData.set("line_items[0][quantity]", "1");
  formData.set("line_items[0][price_data][currency]", currency.toLowerCase());
  formData.set("line_items[0][price_data][unit_amount]", minorUnits.toString());
  formData.set(
    "line_items[0][price_data][product_data][name]",
    "SafeLoot balance topup",
  );
  formData.set(
    "line_items[0][price_data][product_data][description]",
    `Balance topup transaction ${input.transactionId}`,
  );

  const response = await fetch(`${config.apiUrl}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
    cache: "no-store",
  });

  const payload =
    (await response.json().catch(() => null)) as
      | StripeCreateCheckoutSessionResponse
      | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || "Не удалось создать Stripe Checkout сессию.",
    );
  }

  const checkoutUrl = payload?.url?.trim();

  if (!checkoutUrl) {
    throw new Error("Stripe не вернул checkout URL.");
  }

  return {
    checkoutUrl,
    providerId: payload?.id?.trim() || null,
    isMock: false,
  } satisfies StripeCheckoutSessionResult;
}

export async function handleStripeWebhook(input: {
  rawBody: string;
  signature: string | null;
  payload: StripeWebhookPayload;
}) {
  if (!input.rawBody) {
    throw new Error("Raw request body is required for signature verification.");
  }

  if (!input.signature?.trim()) {
    throw new Error("Missing Stripe-Signature header.");
  }

  const eventType = input.payload.type?.trim();

  if (eventType !== "checkout.session.completed") {
    return {
      processed: false,
      alreadyProcessed: false,
      transactionId: extractTransactionId(input.payload),
    };
  }

  const session = input.payload.data?.object;

  if (!session) {
    throw new Error("checkout.session payload is required for a Stripe webhook.");
  }

  const transactionId = extractTransactionId(input.payload);

  if (!transactionId) {
    throw new Error(
      "client_reference_id or metadata.transactionId is required for a Stripe webhook.",
    );
  }

  const isPaid =
    session.payment_status?.trim().toLowerCase() === "paid" ||
    session.status?.trim().toLowerCase() === "complete";

  if (!isPaid) {
    return {
      processed: false,
      alreadyProcessed: false,
      transactionId,
    };
  }

  const providerId = session.id?.trim() || input.payload.id?.trim() || null;
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

function getStripeConfig(): StripeConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim(),
    apiUrl: process.env.STRIPE_API_URL?.trim() || STRIPE_API_BASE_URL,
  };
}

function extractTransactionId(payload: StripeWebhookPayload) {
  const session = payload.data?.object;
  const candidates = [
    session?.client_reference_id,
    session?.metadata?.transactionId,
    session?.metadata?.transaction_id,
  ];

  for (const candidate of candidates) {
    const transactionId = candidate?.trim();

    if (transactionId) {
      return transactionId;
    }
  }

  return null;
}

function normalizeCurrency(currency: string) {
  return currency.trim().toUpperCase();
}

function toMinorUnits(amount: Prisma.Decimal) {
  return amount
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
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