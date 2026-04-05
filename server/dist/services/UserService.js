"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const prisma_service_1 = require("./prisma.service");
const ProductService_1 = require("./ProductService");
class UserService {
    prismaClient;
    constructor(prismaClient = prisma_service_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async getUserById(userId) {
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
    async listUserProducts(userId) {
        return ProductService_1.productService.listProductsBySeller(userId);
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
