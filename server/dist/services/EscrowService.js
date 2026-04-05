"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escrowService = exports.EscrowService = void 0;
const client_1 = require("@prisma/client");
const prisma_service_1 = require("./prisma.service");
const MONEY_SCALE = 8;
class EscrowService {
    prismaClient;
    constructor(prismaClient = prisma_service_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async createOrder(buyerId, productId) {
        if (!buyerId.trim()) {
            throw new Error("buyerId is required.");
        }
        if (!productId.trim()) {
            throw new Error("productId is required.");
        }
        return this.prismaClient.$transaction(async (transactionClient) => {
            const [buyer, product] = await Promise.all([
                transactionClient.user.findUnique({
                    where: { id: buyerId },
                    select: {
                        id: true,
                        availableBalance: true,
                    },
                }),
                transactionClient.product.findUnique({
                    where: { id: productId },
                    select: {
                        id: true,
                        price: true,
                        sellerId: true,
                    },
                }),
            ]);
            if (!buyer) {
                throw new Error(`Buyer with id ${buyerId} was not found.`);
            }
            if (!product) {
                throw new Error(`Product with id ${productId} was not found.`);
            }
            const balanceUpdate = await transactionClient.user.updateMany({
                where: {
                    id: buyer.id,
                    availableBalance: {
                        gte: product.price,
                    },
                },
                data: {
                    availableBalance: {
                        decrement: product.price,
                    },
                },
            });
            if (balanceUpdate.count !== 1) {
                throw new Error("Insufficient available balance for this purchase.");
            }
            const order = await transactionClient.order.create({
                data: {
                    buyerId: buyer.id,
                    sellerId: product.sellerId,
                    productId: product.id,
                    price: product.price,
                    status: client_1.OrderStatus.PAID,
                },
                select: {
                    id: true,
                    status: true,
                },
            });
            const transaction = await transactionClient.transaction.create({
                data: {
                    userId: buyer.id,
                    orderId: order.id,
                    amount: product.price,
                    type: client_1.TransactionType.ESCROW_HOLD,
                    status: client_1.TransactionStatus.COMPLETED,
                },
                select: {
                    id: true,
                },
            });
            return {
                orderId: order.id,
                transactionId: transaction.id,
                status: order.status,
            };
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
    }
    async completeOrder(orderId, buyerId) {
        if (!orderId.trim()) {
            throw new Error("orderId is required.");
        }
        if (!buyerId.trim()) {
            throw new Error("buyerId is required.");
        }
        return this.prismaClient.$transaction(async (transactionClient) => {
            const order = await transactionClient.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    buyerId: true,
                    sellerId: true,
                    price: true,
                    status: true,
                    seller: {
                        select: {
                            rank: true,
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
            if (order.status !== client_1.OrderStatus.PAID) {
                throw new Error("Only orders with PAID status can be completed.");
            }
            const platformFeeRate = this.getSellerFeeRate(order.seller.rank);
            const platformFee = order.price
                .mul(platformFeeRate)
                .toDecimalPlaces(MONEY_SCALE, client_1.Prisma.Decimal.ROUND_HALF_UP);
            const sellerHoldAmount = order.price
                .sub(platformFee)
                .toDecimalPlaces(MONEY_SCALE, client_1.Prisma.Decimal.ROUND_HALF_UP);
            const orderUpdate = await transactionClient.order.updateMany({
                where: {
                    id: order.id,
                    buyerId,
                    status: client_1.OrderStatus.PAID,
                },
                data: {
                    status: client_1.OrderStatus.COMPLETED,
                    platformFee,
                },
            });
            if (orderUpdate.count !== 1) {
                throw new Error(`Order ${order.id} could not be completed.`);
            }
            await transactionClient.user.update({
                where: {
                    id: order.sellerId,
                },
                data: {
                    holdBalance: {
                        increment: sellerHoldAmount,
                    },
                },
            });
            const transaction = await transactionClient.transaction.create({
                data: {
                    userId: order.sellerId,
                    orderId: order.id,
                    amount: sellerHoldAmount,
                    type: client_1.TransactionType.ESCROW_RELEASE,
                    status: client_1.TransactionStatus.COMPLETED,
                },
                select: {
                    id: true,
                },
            });
            return {
                orderId: order.id,
                transactionId: transaction.id,
                status: client_1.OrderStatus.COMPLETED,
                platformFee: platformFee.toFixed(MONEY_SCALE),
                sellerHoldAmount: sellerHoldAmount.toFixed(MONEY_SCALE),
            };
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
    }
    getSellerFeeRate(rank) {
        switch (rank) {
            case client_1.SellerRank.BRONZE:
                return new client_1.Prisma.Decimal("0.07");
            case client_1.SellerRank.SILVER:
                return new client_1.Prisma.Decimal("0.05");
            case client_1.SellerRank.GOLD:
                return new client_1.Prisma.Decimal("0.03");
            default:
                return new client_1.Prisma.Decimal("0.07");
        }
    }
}
exports.EscrowService = EscrowService;
exports.escrowService = new EscrowService();
