import {
  OrderStatus,
  Prisma,
  PrismaClient,
  SellerRank,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "./prisma.service";

const MONEY_SCALE = 8;

export interface CreateOrderResult {
  orderId: string;
  transactionId: string;
  status: OrderStatus;
}

export interface CompleteOrderResult {
  orderId: string;
  transactionId: string;
  status: OrderStatus;
  platformFee: string;
  sellerHoldAmount: string;
}

export class EscrowService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async createOrder(
    buyerId: string,
    productId: string,
  ): Promise<CreateOrderResult> {
    if (!buyerId.trim()) {
      throw new Error("buyerId is required.");
    }

    if (!productId.trim()) {
      throw new Error("productId is required.");
    }

    return this.prismaClient.$transaction(
      async (transactionClient) => {
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
            status: OrderStatus.PAID,
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
            type: TransactionType.ESCROW_HOLD,
            status: TransactionStatus.COMPLETED,
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async completeOrder(
    orderId: string,
    buyerId: string,
  ): Promise<CompleteOrderResult> {
    if (!orderId.trim()) {
      throw new Error("orderId is required.");
    }

    if (!buyerId.trim()) {
      throw new Error("buyerId is required.");
    }

    return this.prismaClient.$transaction(
      async (transactionClient) => {
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

        if (order.status !== OrderStatus.PAID) {
          throw new Error("Only orders with PAID status can be completed.");
        }

        const platformFeeRate = this.getSellerFeeRate(order.seller.rank);
        const platformFee = order.price
          .mul(platformFeeRate)
          .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
        const sellerHoldAmount = order.price
          .sub(platformFee)
          .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

        const orderUpdate = await transactionClient.order.updateMany({
          where: {
            id: order.id,
            buyerId,
            status: OrderStatus.PAID,
          },
          data: {
            status: OrderStatus.COMPLETED,
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
            type: TransactionType.ESCROW_RELEASE,
            status: TransactionStatus.COMPLETED,
          },
          select: {
            id: true,
          },
        });

        return {
          orderId: order.id,
          transactionId: transaction.id,
          status: OrderStatus.COMPLETED,
          platformFee: platformFee.toFixed(MONEY_SCALE),
          sellerHoldAmount: sellerHoldAmount.toFixed(MONEY_SCALE),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private getSellerFeeRate(rank: SellerRank) {
    switch (rank) {
      case SellerRank.BRONZE:
        return new Prisma.Decimal("0.07");
      case SellerRank.SILVER:
        return new Prisma.Decimal("0.05");
      case SellerRank.GOLD:
        return new Prisma.Decimal("0.03");
      default:
        return new Prisma.Decimal("0.07");
    }
  }
}

export const escrowService = new EscrowService();