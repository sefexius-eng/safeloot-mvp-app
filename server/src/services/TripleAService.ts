import {
  OrderStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "./prisma.service";

const DEFAULT_TRIPLEA_PAYMENT_URL = "https://api.triple-a.io/api/v2/payment";
const DEFAULT_APP_URL = "http://localhost:3000";

interface TripleAPaymentApiResponse {
  hosted_url?: string;
  payment_reference?: string;
  message?: string;
  error?: unknown;
  data?: {
    hosted_url?: string;
    payment_reference?: string;
    message?: string;
  };
}

export interface TripleAWebhookPayload {
  event?: string;
  status?: string;
  payment_reference?: string;
  receive_amount?: number | string;
}

export interface CreatePaymentRequestResult {
  hosted_url: string;
}

export interface HandleTripleAWebhookResult {
  processed: boolean;
  transactionId: string | null;
}

export class TripleAService {
  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    private readonly paymentUrl: string =
      process.env.TRIPLEA_PAYMENT_URL ?? DEFAULT_TRIPLEA_PAYMENT_URL,
  ) {}

  async createPaymentRequest(
    orderId: string,
    amount: number,
    currency: string = "USDT",
  ): Promise<CreatePaymentRequestResult> {
    const normalizedOrderId = orderId.trim();

    if (!normalizedOrderId) {
      throw new Error("orderId is required.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("amount must be a positive number.");
    }

    const normalizedCurrency = currency.trim().toUpperCase();

    if (!normalizedCurrency) {
      throw new Error("currency is required.");
    }

    const existingOrder = await this.prismaClient.order.findUnique({
      where: { id: normalizedOrderId },
      select: {
        id: true,
        buyerId: true,
        productId: true,
      },
    });

    if (!existingOrder) {
      throw new Error(`Order with id ${normalizedOrderId} was not found.`);
    }

    const normalizedAmount = this.normalizeAmount(amount);
    const accessToken = process.env.TRIPLEA_ACCESS_TOKEN?.trim();
    const requestPayload = {
      type: "triplea",
      merchant_key: this.getRequiredEnv("TRIPLEA_MERCHANT_KEY"),
      order_id: normalizedOrderId,
      order_currency: normalizedCurrency,
      order_amount: normalizedAmount.apiAmount,
      notify_url: this.getNotifyUrl(),
      success_url: this.getSuccessUrl(normalizedOrderId),
      cancel_url: this.getCancelUrl(existingOrder.productId),
    };

    const response = await fetch(this.paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {}),
      },
      body: JSON.stringify(requestPayload),
    });

    const responseBody =
      await this.parseJsonResponse<TripleAPaymentApiResponse>(response);

    if (!response.ok) {
      throw new Error(
        `Triple-A payment request failed with status ${response.status}: ${this.stringifyError(responseBody)}`,
      );
    }

    const hostedUrl = responseBody.hosted_url ?? responseBody.data?.hosted_url;
    const paymentReference =
      responseBody.payment_reference ?? responseBody.data?.payment_reference;

    if (!hostedUrl || !paymentReference) {
      throw new Error(
        "Triple-A response did not include hosted_url or payment_reference.",
      );
    }

    await this.prismaClient.transaction.create({
      data: {
        userId: existingOrder.buyerId,
        orderId: normalizedOrderId,
        amount: new Prisma.Decimal(normalizedAmount.dbAmount),
        currency: normalizedCurrency,
        type: TransactionType.ESCROW_HOLD,
        status: TransactionStatus.PENDING,
        externalId: paymentReference,
      },
    });

    return { hosted_url: hostedUrl };
  }

  private normalizeAmount(amount: number) {
    const dbAmount = amount.toFixed(8);

    return {
      dbAmount,
      apiAmount: Number(dbAmount),
    };
  }

  private getNotifyUrl() {
    return `${this.getAppUrl()}/api/webhooks/triplea`;
  }

  async handleWebhook(
    payload: TripleAWebhookPayload,
  ): Promise<HandleTripleAWebhookResult> {
    if (payload.event !== "payment" || payload.status !== "good") {
      return {
        processed: false,
        transactionId: null,
      };
    }

    const paymentReference = payload.payment_reference?.trim();

    if (!paymentReference) {
      throw new Error("payment_reference is required for a payment webhook.");
    }

    const receiveAmount = this.parseWebhookAmount(payload.receive_amount);

    return this.prismaClient.$transaction(
      async (transactionClient) => {
        const existingTransaction = await transactionClient.transaction.findUnique(
          {
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
          },
        );

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

  private getSuccessUrl(orderId: string) {
    return `${this.getAppUrl()}/order/${orderId}`;
  }

  private getCancelUrl(productId: string) {
    return `${this.getAppUrl()}/product/${productId}`;
  }

  private getAppUrl() {
    return process.env.APP_URL?.trim() ?? DEFAULT_APP_URL;
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is not configured.`);
    }

    return value;
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const responseText = await response.text();

    if (!responseText) {
      return {} as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new Error(
        `Triple-A returned a non-JSON response: ${responseText.slice(0, 300)}`,
      );
    }
  }

  private stringifyError(payload: TripleAPaymentApiResponse) {
    if (payload.message) {
      return payload.message;
    }

    if (payload.data?.message) {
      return payload.data.message;
    }

    if (payload.error) {
      return JSON.stringify(payload.error);
    }

    return JSON.stringify(payload);
  }

  private parseWebhookAmount(amount: number | string | undefined) {
    if (amount === undefined || amount === null || amount === "") {
      throw new Error("receive_amount is required for a payment webhook.");
    }

    const decimalAmount = new Prisma.Decimal(amount);

    if (decimalAmount.lte(0)) {
      throw new Error("receive_amount must be greater than zero.");
    }

    return decimalAmount;
  }
}

export const tripleAService = new TripleAService();