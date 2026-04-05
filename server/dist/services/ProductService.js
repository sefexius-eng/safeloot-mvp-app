"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productService = exports.ProductService = void 0;
const client_1 = require("@prisma/client");
const prisma_service_1 = require("./prisma.service");
class ProductService {
    prismaClient;
    constructor(prismaClient = prisma_service_1.prisma) {
        this.prismaClient = prismaClient;
    }
    async listProductsBySeller(sellerId) {
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
    async getProductById(productId) {
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
    async createProduct(input) {
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
                price: new client_1.Prisma.Decimal(input.price.toFixed(8)),
                gameId,
                type,
                sellerId,
            },
        });
    }
    parseProductType(type) {
        if (type === client_1.ProductType.ITEM) {
            return client_1.ProductType.ITEM;
        }
        if (type === client_1.ProductType.ACCOUNT) {
            return client_1.ProductType.ACCOUNT;
        }
        if (type === client_1.ProductType.SERVICE) {
            return client_1.ProductType.SERVICE;
        }
        throw new Error("type must be one of ITEM, ACCOUNT, SERVICE.");
    }
}
exports.ProductService = ProductService;
exports.productService = new ProductService();
