import { OrderStatus, Prisma, Role } from "@prisma/client";

import { USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import { prisma } from "@/lib/prisma";
import {
  getSellerReviewSummary,
  getSellerReviewSummaryMap,
} from "@/lib/review-summary";

import {
  ensureProductManagementAccess,
  formatMoney,
  normalizeText,
  validateCatalogSelection,
  validateProductImages,
  validateProductTextFields,
} from "@/lib/domain/shared";

async function mapProductsWithSellerReviewSummary<
  T extends {
    price: Prisma.Decimal;
    seller: {
      id: string;
      lastSeen?: Date | string | null;
    };
  },
>(products: T[]) {
  const reviewSummaryMap = await getSellerReviewSummaryMap(
    products.map((product) => product.seller.id),
  );

  return products.map((product) => ({
    ...product,
    price: formatMoney(product.price),
    seller: {
      ...product.seller,
      ...("lastSeen" in product.seller
        ? {
            lastSeen:
              product.seller.lastSeen instanceof Date
                ? product.seller.lastSeen.toISOString()
                : (product.seller.lastSeen ?? null),
          }
        : {}),
      reviewSummary: getSellerReviewSummary(reviewSummaryMap, product.seller.id),
    },
  }));
}

function normalizeMappedProductsSellerLastSeen<
  T extends {
    seller: {
      lastSeen: Date | string | null;
    };
  },
>(products: T[]) {
  return products.map((product) => ({
    ...product,
    seller: {
      ...product.seller,
      lastSeen:
        product.seller.lastSeen instanceof Date
          ? product.seller.lastSeen.toISOString()
          : (product.seller.lastSeen ?? null),
    },
  }));
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const mappedProducts = await mapProductsWithSellerReviewSummary(products);

  return normalizeMappedProductsSellerLastSeen(mappedProducts);
}

export async function listCatalogGamesForProductForms() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const categories = await prisma.category.findMany({
    where: {
      gameId: {
        in: games.map((game) => game.id),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      gameId: true,
    },
    orderBy: [
      {
        gameId: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const categoriesByGameId = categories.reduce<
    Record<
      string,
      Array<{
        id: string;
        name: string;
        slug: string;
      }>
    >
  >((accumulator, category) => {
    if (!accumulator[category.gameId]) {
      accumulator[category.gameId] = [];
    }

    accumulator[category.gameId].push({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });

    return accumulator;
  }, {});

  return games.map((game) => ({
    ...game,
    categories: categoriesByGameId[game.id] ?? [],
  }));
}

export async function getProductById(
  productId: string,
  options?: {
    viewerId?: string | null;
    viewerRole?: Role | string | null;
  },
) {
  const normalizedProductId = normalizeText(productId);

  if (!normalizedProductId) {
    throw new Error("productId is required.");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          ...USER_APPEARANCE_SELECT,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  if (
    !product.isActive &&
    product.sellerId !== normalizeText(options?.viewerId ?? "") &&
    !ensureViewerCanAccessInactiveProduct(options?.viewerRole)
  ) {
    return null;
  }

  const [mappedProduct] = normalizeMappedProductsSellerLastSeen(
    await mapProductsWithSellerReviewSummary([product]),
  );

  return mappedProduct ?? null;
}

function ensureViewerCanAccessInactiveProduct(role?: Role | string | null) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export async function createProduct(input: {
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  gameId?: string;
  categoryId?: string;
  sellerId?: string;
}) {
  const { title, description } = validateProductTextFields(input);
  const images = validateProductImages(input.images);
  const gameId = normalizeText(input.gameId);
  const categoryId = normalizeText(input.categoryId);
  const sellerId = normalizeText(input.sellerId);
  const price = Number(input.price);

  if (!gameId) {
    throw new Error("gameId is required.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required.");
  }

  if (!sellerId) {
    throw new Error("sellerId is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("price must be a positive number.");
  }

  const [seller] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: sellerId,
      },
      select: {
        id: true,
      },
    }),
    validateCatalogSelection(gameId, categoryId),
  ]);

  if (!seller) {
    throw new Error(`Seller with id ${sellerId} was not found.`);
  }

  const product = await prisma.product.create({
    data: {
      title,
      description,
      images,
      gameId,
      categoryId,
      sellerId,
      price: new Prisma.Decimal(price.toFixed(2)),
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
  });

  return {
    ...product,
    price: formatMoney(product.price),
  };
}

export async function updateProductByActor(input: {
  productId?: string;
  userId: string;
  role?: Role;
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  gameId?: string;
  categoryId?: string;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);
  const gameId = normalizeText(input.gameId);
  const categoryId = normalizeText(input.categoryId);
  const price = Number(input.price);
  const { title, description } = validateProductTextFields(input);
  const images = validateProductImages(input.images);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!gameId) {
    throw new Error("gameId is required.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("price must be a positive number.");
  }

  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      sellerId: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!existingProduct) {
    throw new Error(`Product with id ${productId} was not found.`);
  }

  ensureProductManagementAccess(userId, input.role, existingProduct);

  await validateCatalogSelection(gameId, categoryId);

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      title,
      description,
      images,
      price: new Prisma.Decimal(price.toFixed(2)),
      gameId,
      categoryId,
    },
    select: {
      id: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  return {
    productId: updatedProduct.id,
    currentGameSlug: updatedProduct.game.slug,
    previousGameSlug: existingProduct.game.slug,
  };
}

export async function deleteProductByActor(input: {
  productId?: string;
  userId: string;
  role?: Role;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const product = await transactionClient.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          id: true,
          sellerId: true,
          game: {
            select: {
              slug: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
          orders: {
            where: {
              status: {
                notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

      if (!product) {
        throw new Error("Товар не найден.");
      }

      ensureProductManagementAccess(userId, input.role, product);

      if (product.orders.length > 0) {
        throw new Error("Нельзя удалить товар, пока у него есть активные сделки.");
      }

      if (product._count.orders > 0) {
        throw new Error("Нельзя удалить товар с историей сделок.");
      }

      await transactionClient.product.delete({
        where: {
          id: productId,
        },
      });

      return {
        productId: product.id,
        gameSlug: product.game.slug,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}

export async function toggleProductVisibilityBySeller(input: {
  productId?: string;
  userId: string;
}) {
  const productId = normalizeText(input.productId);
  const userId = normalizeText(input.userId);

  if (!productId) {
    throw new Error("productId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      sellerId: true,
      isActive: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error("Товар не найден.");
  }

  if (product.sellerId !== userId) {
    throw new Error("Только продавец может менять видимость своего товара.");
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isActive: !product.isActive,
    },
    select: {
      id: true,
      sellerId: true,
      isActive: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  return {
    productId: updatedProduct.id,
    sellerId: updatedProduct.sellerId,
    isActive: updatedProduct.isActive,
    gameSlug: updatedProduct.game.slug,
  };
}

export async function toggleAllProductsVisibilityBySeller(input: {
  userId: string;
  isActive: boolean;
}) {
  const userId = normalizeText(input.userId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  const seller = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!seller) {
    throw new Error(`User with id ${userId} was not found.`);
  }

  const products = await prisma.product.findMany({
    where: {
      sellerId: userId,
    },
    select: {
      id: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  const result = await prisma.product.updateMany({
    where: {
      sellerId: userId,
    },
    data: {
      isActive: input.isActive,
    },
  });

  return {
    updatedCount: result.count,
    sellerId: userId,
    productIds: products.map((product) => product.id),
    gameSlugs: [...new Set(products.map((product) => product.game.slug))],
  };
}

export async function listProductsBySeller(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const products = await prisma.product.findMany({
    where: {
      sellerId: normalizedUserId,
    },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          gameId: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          rank: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return mapProductsWithSellerReviewSummary(products);
}