import {
  OrderStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

import { prisma } from "./prisma.service";

const MONEY_SCALE = 8;
const TEST_PLATFORM_FEE_RATE = new Prisma.Decimal("0.05");

export interface CreateOrderInput {
  productId: string;
  buyerId: string;
}

export interface GetOrderInput {
  orderId: string;
}

export interface ConfirmOrderInput {
  orderId: string;
  buyerId: string;
}

export interface CompleteOrderInput {
  orderId: string;
  buyerId: string;
}

export interface CreateOrderResult {
  orderId: string;
  hosted_url: string;
}

export interface GetOrderResult {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  price: string;
  platformFee: string;
  status: OrderStatus;
  chatRoomId: string | null;
  product: {
    id: string;
    title: string;
  };
}

export interface ConfirmOrderResult {
  orderId: string;
  status: OrderStatus;
}

export interface CompleteOrderResult {
  orderId: string;
  transactionId: string;
  status: OrderStatus;
  platformFee: string;
  sellerHoldAmount: string;
}

export class OrderService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getOrder(input: GetOrderInput): Promise<GetOrderResult> {
    const orderId = input.orderId.trim();

    if (!orderId) {
      throw new Error("orderId is required.");
    }

    const order = await this.prismaClient.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        productId: true,
        price: true,
        platformFee: true,
        status: true,
        chatRoom: {
          select: {
            id: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error(`Order with id ${orderId} was not found.`);
    }

    return {
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      productId: order.productId,
      price: order.price.toFixed(MONEY_SCALE),
      platformFee: order.platformFee.toFixed(MONEY_SCALE),
      status: order.status,
      chatRoomId: order.chatRoom?.id ?? null,
      product: order.product,
    };
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const productId = input.productId.trim();
    const buyerId = input.buyerId.trim();

    if (!productId) {
      throw new Error("productId is required.");
    }

    if (!buyerId) {
      throw new Error("buyerId is required.");
    }

    const [buyer, product] = await Promise.all([
      this.prismaClient.user.findUnique({
        where: { id: buyerId },
        select: { id: true },
      }),
      this.prismaClient.product.findUnique({
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

    const order = await this.prismaClient.order.create({
      data: {
        buyerId,
        sellerId: product.sellerId,
        productId: product.id,
        price: product.price,
        status: OrderStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    return {
      orderId: order.id,
      hosted_url: `/payment-mock?orderId=${order.id}`,
    };
  }

  async confirmOrder(input: ConfirmOrderInput): Promise<ConfirmOrderResult> {
    const orderId = input.orderId.trim();
    const buyerId = input.buyerId.trim();

    if (!orderId) {
      throw new Error("orderId is required.");
    }

    if (!buyerId) {
      throw new Error("buyerId is required.");
    }

    return this.prismaClient.$transaction(
      async (transactionClient) => {
        const existingOrder = await transactionClient.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            status: true,
          },
        });

        if (!existingOrder) {
          throw new Error(`Order with id ${orderId} was not found.`);
        }

        if (existingOrder.buyerId !== buyerId) {
          throw new Error("Only the buyer can confirm this order.");
        }

        if (existingOrder.status !== OrderStatus.PENDING) {
          throw new Error(
            `Order ${orderId} cannot be confirmed from status ${existingOrder.status}.`,
          );
        }

        const updatedOrder = await transactionClient.order.updateMany({
          where: {
            id: orderId,
            status: OrderStatus.PENDING,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });

        if (updatedOrder.count !== 1) {
          throw new Error(`Order ${orderId} could not be confirmed.`);
        }

        await transactionClient.chatRoom.upsert({
          where: {
            orderId: existingOrder.id,
          },
          update: {
            buyerId: existingOrder.buyerId,
            sellerId: existingOrder.sellerId,
          },
          create: {
            orderId: existingOrder.id,
            buyerId: existingOrder.buyerId,
            sellerId: existingOrder.sellerId,
          },
        });

        return {
          orderId: existingOrder.id,
          status: OrderStatus.PAID,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async completeOrder(
    input: CompleteOrderInput,
  ): Promise<CompleteOrderResult> {
    const orderId = input.orderId.trim();
    const buyerId = input.buyerId.trim();

    if (!orderId) {
      throw new Error("orderId is required.");
    }

    if (!buyerId) {
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
          },
        });

        if (!order) {
          throw new Error(`Order with id ${orderId} was not found.`);
        }

        if (order.buyerId !== buyerId) {
          throw new Error("Only the buyer can complete this order.");
        }

        if (order.status !== OrderStatus.PAID) {
          throw new Error(
            `Order ${orderId} cannot be completed from status ${order.status}.`,
          );
        }

        const platformFee = order.price
          .mul(TEST_PLATFORM_FEE_RATE)
          .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
        const sellerHoldAmount = order.price
          .sub(platformFee)
          .toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);

        const updatedOrder = await transactionClient.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PAID,
          },
          data: {
            status: OrderStatus.COMPLETED,
            platformFee,
          },
        });

        if (updatedOrder.count !== 1) {
          throw new Error(`Order ${orderId} could not be completed.`);
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
}

export const orderService = new OrderService();
