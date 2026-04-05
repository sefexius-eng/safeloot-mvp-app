import { PrismaClient } from "@prisma/client";

import { prisma } from "./prisma.service";
import { productService } from "./ProductService";

export class UserService {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getUserById(userId: string) {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new Error("userId is required.");
    }

    const user = await this.prismaClient.user.findUnique({
      where: {
        id: normalizedUserId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        rank: true,
        availableBalance: true,
        holdBalance: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error(`User with id ${normalizedUserId} was not found.`);
    }

    return {
      ...user,
      availableBalance: user.availableBalance.toFixed(8),
      holdBalance: user.holdBalance.toFixed(8),
    };
  }

  async listUserProducts(userId: string) {
    return productService.listProductsBySeller(userId);
  }
}

export const userService = new UserService();
