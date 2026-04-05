import { Prisma, PrismaClient, ProductType } from "@prisma/client";

import { prisma } from "./prisma.service";

export interface CreateProductInput {
  title: string;
  description: string;
  price: number;
  gameId: string;
  type: string;
  sellerId: string;
}

export class ProductService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async listProductsBySeller(sellerId: string) {
    const normalizedSellerId = sellerId.trim();

    if (!normalizedSellerId) {
      throw new Error("sellerId is required.");
    }

    return this.prismaClient.product.findMany({
      where: {
        sellerId: normalizedSellerId,
      },
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            rank: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async listProducts() {
    return this.prismaClient.product.findMany({
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            rank: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getProductById(productId: string) {
    return this.prismaClient.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            rank: true,
          },
        },
      },
    });
  }

  async createProduct(input: CreateProductInput) {
    const title = input.title.trim();
    const description = input.description.trim();
    const gameId = input.gameId.trim();
    const sellerId = input.sellerId.trim();
    const normalizedType = input.type.trim().toUpperCase();

    if (!title) {
      throw new Error("title is required.");
    }

    if (!description) {
      throw new Error("description is required.");
    }

    if (!gameId) {
      throw new Error("gameId is required.");
    }

    if (!sellerId) {
      throw new Error("sellerId is required.");
    }

    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new Error("price must be a positive number.");
    }

    const type = this.parseProductType(normalizedType);

    const seller = await this.prismaClient.user.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });

    if (!seller) {
      throw new Error(`Seller with id ${sellerId} was not found.`);
    }

    return this.prismaClient.product.create({
      data: {
        title,
        description,
        price: new Prisma.Decimal(input.price.toFixed(8)),
        gameId,
        type,
        sellerId,
      },
    });
  }

  private parseProductType(type: string): ProductType {
    if (type === ProductType.ITEM) {
      return ProductType.ITEM;
    }

    if (type === ProductType.ACCOUNT) {
      return ProductType.ACCOUNT;
    }

    if (type === ProductType.SERVICE) {
      return ProductType.SERVICE;
    }

    throw new Error("type must be one of ITEM, ACCOUNT, SERVICE.");
  }
}

export const productService = new ProductService();