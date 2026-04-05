"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripleAService = exports.TripleAService = void 0;
const client_1 = require("@prisma/client");
const prisma_service_1 = require("./prisma.service");
const DEFAULT_TRIPLEA_PAYMENT_URL = "https://api.triple-a.io/api/v2/payment";
const DEFAULT_APP_URL = "http://localhost:3000";
class TripleAService {
    prismaClient;
    paymentUrl;
    constructor(prismaClient = prisma_service_1.prisma, paymentUrl = process.env.TRIPLEA_PAYMENT_URL ?? DEFAULT_TRIPLEA_PAYMENT_URL) {
        this.prismaClient = prismaClient;
        this.paymentUrl = paymentUrl;
    }
    async createPaymentRequest(orderId, amount, currency = "USDT") {
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
        const responseBody = await this.parseJsonResponse(response);
        if (!response.ok) {
            throw new Error(`Triple-A payment request failed with status ${response.status}: ${this.stringifyError(responseBody)}`);
        }
        const hostedUrl = responseBody.hosted_url ?? responseBody.data?.hosted_url;
        const paymentReference = responseBody.payment_reference ?? responseBody.data?.payment_reference;
        if (!hostedUrl || !paymentReference) {
            throw new Error("Triple-A response did not include hosted_url or payment_reference.");
        }
        await this.prismaClient.transaction.create({
            data: {
                userId: existingOrder.buyerId,
                orderId: normalizedOrderId,
                amount: new client_1.Prisma.Decimal(normalizedAmount.dbAmount),
                currency: normalizedCurrency,
                type: client_1.TransactionType.ESCROW_HOLD,
                status: client_1.TransactionStatus.PENDING,
                externalId: paymentReference,
            },
        });
        return { hosted_url: hostedUrl };
    }
    normalizeAmount(amount) {
        const dbAmount = amount.toFixed(8);
        return {
            dbAmount,
            apiAmount: Number(dbAmount),
        };
    }
    getNotifyUrl() {
        return `${this.getAppUrl()}/api/webhooks/triplea`;
    }
    async handleWebhook(payload) {
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
        return this.prismaClient.$transaction(async (transactionClient) => {
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
                throw new Error(`Transaction with externalId ${paymentReference} was not found.`);
            }
            if (existingTransaction.status === client_1.TransactionStatus.COMPLETED) {
                return {
                    processed: false,
                    transactionId: existingTransaction.id,
                };
            }
            const updatedTransaction = await transactionClient.transaction.updateMany({
                where: {
                    id: existingTransaction.id,
                    status: client_1.TransactionStatus.PENDING,
                },
                data: {
                    status: client_1.TransactionStatus.COMPLETED,
                },
            });
            if (updatedTransaction.count !== 1) {
                throw new Error(`Transaction ${existingTransaction.id} cannot be completed from status ${existingTransaction.status}.`);
            }
            if (existingTransaction.type === client_1.TransactionType.ESCROW_HOLD &&
                existingTransaction.orderId) {
                if (existingTransaction.order?.status === client_1.OrderStatus.CANCELLED) {
                    throw new Error(`Order ${existingTransaction.orderId} is cancelled and cannot be paid.`);
                }
                if (existingTransaction.order?.status === client_1.OrderStatus.PENDING) {
                    await transactionClient.order.update({
                        where: {
                            id: existingTransaction.orderId,
                        },
                        data: {
                            status: client_1.OrderStatus.PAID,
                        },
                    });
                }
            }
            else {
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
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
    }
    getSuccessUrl(orderId) {
        return `${this.getAppUrl()}/order/${orderId}`;
    }
    getCancelUrl(productId) {
        return `${this.getAppUrl()}/product/${productId}`;
    }
    getAppUrl() {
        return process.env.APP_URL?.trim() ?? DEFAULT_APP_URL;
    }
    getRequiredEnv(name) {
        const value = process.env[name]?.trim();
        if (!value) {
            throw new Error(`${name} is not configured.`);
        }
        return value;
    }
    async parseJsonResponse(response) {
        const responseText = await response.text();
        if (!responseText) {
            return {};
        }
        try {
            return JSON.parse(responseText);
        }
        catch {
            throw new Error(`Triple-A returned a non-JSON response: ${responseText.slice(0, 300)}`);
        }
    }
    stringifyError(payload) {
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
    parseWebhookAmount(amount) {
        if (amount === undefined || amount === null || amount === "") {
            throw new Error("receive_amount is required for a payment webhook.");
        }
        const decimalAmount = new client_1.Prisma.Decimal(amount);
        if (decimalAmount.lte(0)) {
            throw new Error("receive_amount must be greater than zero.");
        }
        return decimalAmount;
    }
}
exports.TripleAService = TripleAService;
exports.tripleAService = new TripleAService();
