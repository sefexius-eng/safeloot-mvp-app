"use server";

import { OrderStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getCurrentSessionUser,
  hasActiveAdminAccess,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  getInvalidManageableProfileBadgeIds,
  normalizeManageableProfileBadgeIds,
} from "@/lib/profile-badges";
import { prisma } from "@/lib/prisma";
import {
  canManageForeignProducts,
  isSuperAdminRole,
  isTeamRole,
  ROLE_OPTIONS,
} from "@/lib/roles";
import { generateSlug } from "@/lib/generate-slug";

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

export interface AdminBadgesActionResult extends AdminActionResult {
  badges?: string[];
}

export interface CatalogGameSummary {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
  categoryCount: number;
  categories: CatalogCategorySummary[];
}

export interface CatalogGameActionResult extends AdminActionResult {
  game?: CatalogGameSummary;
}

export interface CatalogCategorySummary {
  id: string;
  gameId: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface CatalogCategoryActionResult extends AdminActionResult {
  category?: CatalogCategorySummary;
  game?: CatalogGameSummary;
}

const CATALOG_EDITOR_ROLES: Role[] = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];
const MAX_CATALOG_GAME_IMAGE_BASE64_LENGTH = 1_600_000;

function normalizeCatalogGameImage(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("data:image/")) {
    if (!trimmedValue.startsWith("data:image/webp;base64,")) {
      throw new Error("Обложка игры должна быть в формате WebP.");
    }

    if (trimmedValue.length > MAX_CATALOG_GAME_IMAGE_BASE64_LENGTH) {
      throw new Error("Обложка игры получилась слишком большой. Попробуйте другое изображение.");
    }

    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return trimmedValue;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error("Выберите корректное изображение для обложки игры.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("URL изображения должен начинаться с http:// или https://.");
  }

  return parsedUrl.toString();
}

function mapCatalogCategorySummary(category: {
  id: string;
  gameId: string;
  name: string;
  slug: string;
  _count: {
    products: number;
  };
}): CatalogCategorySummary {
  return {
    id: category.id,
    gameId: category.gameId,
    name: category.name,
    slug: category.slug,
    productCount: category._count.products,
  };
}

function mapCatalogGameSummary(game: {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  categories: Array<{
    id: string;
    gameId: string;
    name: string;
    slug: string;
    _count: {
      products: number;
    };
  }>;
  _count: {
    products: number;
    categories: number;
  };
}): CatalogGameSummary {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    imageUrl: game.imageUrl,
    productCount: game._count.products,
    categoryCount: game._count.categories,
    categories: game.categories.map(mapCatalogCategorySummary),
  };
}

async function getCatalogGameSummaryById(gameId: string) {
  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      categories: {
        select: {
          id: true,
          gameId: true,
          name: true,
          slug: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      },
      _count: {
        select: {
          products: true,
          categories: true,
        },
      },
    },
  });

  return game ? mapCatalogGameSummary(game) : null;
}

async function requireAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    redirect("/");
  }

  if (!hasActiveAdminAccess(currentUser)) {
    redirect("/");
  }

  return currentUser;
}

async function requireSuperAdminAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser || currentUser.isBanned || !isSuperAdminRole(currentUser.role)) {
    throw new Error("Нет прав");
  }

  return currentUser;
}

async function requireCatalogWriteAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (
    !currentUser ||
    currentUser.isBanned ||
    !CATALOG_EDITOR_ROLES.includes(currentUser.role)
  ) {
    throw new Error("Access Denied");
  }

  return currentUser;
}

async function requireCatalogDeleteAccess() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser || currentUser.isBanned || currentUser.role !== "SUPER_ADMIN") {
    throw new Error("Access Denied: Only SUPER_ADMIN can delete content");
  }

  return currentUser;
}

function revalidateCatalogPaths(gameSlug?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/sell");
  revalidatePath("/games/[slug]", "page");

  if (gameSlug) {
    revalidatePath(`/games/${gameSlug}`);
  }
}

export async function changeUserRole(
  userId: string,
  newRole: Role,
): Promise<AdminActionResult> {
  const currentUser = await requireSuperAdminAccess();
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  if (!ROLE_OPTIONS.includes(newRole)) {
    return {
      ok: false,
      message: "Недопустимая роль.",
    };
  }

  if (normalizedUserId === currentUser.id) {
    return {
      ok: false,
      message: "Нельзя изменить свою роль.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  if (user.role === newRole) {
    return {
      ok: true,
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      role: newRole,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/user/${normalizedUserId}`);

  return {
    ok: true,
  };
}

export async function toggleBanUser(
  userId: string,
  _currentStatus: boolean,
): Promise<AdminActionResult> {
  const currentUser = await requireAdminAccess();

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      role: true,
      isBanned: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  if (currentUser.role === "MODERATOR" && isTeamRole(user.role)) {
    return {
      ok: false,
      message: "Модератор не может банить сотрудников команды.",
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      isBanned: !user.isBanned,
    },
  });

  revalidatePath("/admin");

  return {
    ok: true,
  };
}

export async function updateUserBadges(
  userId: string,
  badgeIds: string[],
): Promise<AdminBadgesActionResult> {
  await requireAdminAccess();

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  const invalidBadgeIds = getInvalidManageableProfileBadgeIds(badgeIds);

  if (invalidBadgeIds.length > 0) {
    return {
      ok: false,
      message: "Передан недопустимый бейдж.",
    };
  }

  const normalizedBadgeIds = normalizeManageableProfileBadgeIds(badgeIds);

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  await prisma.user.update({
    where: {
      id: normalizedUserId,
    },
    data: {
      badges: normalizedBadgeIds,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  revalidatePath(`/user/${normalizedUserId}`);

  return {
    ok: true,
    badges: normalizedBadgeIds,
  };
}

export async function deleteProductAdmin(
  productId: string,
): Promise<AdminActionResult> {
  const currentUser = await requireAdminAccess();

  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    return {
      ok: false,
      message: "Не удалось определить товар.",
    };
  }

  const product = await prisma.product.findUnique({
    where: {
      id: normalizedProductId,
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
    return {
      ok: false,
      message: "Товар не найден.",
    };
  }

  if (
    !canManageForeignProducts(currentUser.role) &&
    product.sellerId !== currentUser.id
  ) {
    return {
      ok: false,
      message: "Модератор может удалять только свои товары.",
    };
  }

  const canForceDelete = currentUser.role === "SUPER_ADMIN";

  if (!canForceDelete && product.orders.length > 0) {
    return {
      ok: false,
      message: "Нельзя удалить товар, пока у него есть активные сделки.",
    };
  }

  if (!canForceDelete && product._count.orders > 0) {
    return {
      ok: false,
      message: "Нельзя удалить товар с историей сделок.",
    };
  }

  await prisma.product.delete({
    where: {
      id: normalizedProductId,
    },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/games/[slug]", "page");
  revalidatePath(`/games/${product.game.slug}`);
  revalidatePath(`/product/${product.id}`);
  revalidatePath(`/product/${product.id}/edit`);

  return {
    ok: true,
  };
}

export async function deleteOrderAdmin(
  orderId: string,
): Promise<AdminActionResult> {
  await requireSuperAdminAccess();

  const normalizedOrderId = orderId.trim();

  if (!normalizedOrderId) {
    return {
      ok: false,
      message: "Не удалось определить заказ.",
    };
  }

  const order = await prisma.order.findUnique({
    where: {
      id: normalizedOrderId,
    },
    select: {
      id: true,
      productId: true,
      buyerId: true,
      sellerId: true,
      product: {
        select: {
          game: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return {
      ok: false,
      message: "Заказ не найден.",
    };
  }

  await prisma.order.delete({
    where: {
      id: normalizedOrderId,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/chats");
  revalidatePath(`/order/${order.id}`);
  revalidatePath(`/orders/${order.id}`);
  revalidatePath(`/product/${order.productId}`);
  revalidatePath(`/user/${order.buyerId}`);
  revalidatePath(`/user/${order.sellerId}`);
  revalidatePath("/games/[slug]", "page");
  revalidatePath(`/games/${order.product.game.slug}`);

  return {
    ok: true,
  };
}

export async function deleteUserAdmin(
  userId: string,
): Promise<AdminActionResult> {
  const currentUser = await requireSuperAdminAccess();
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  if (normalizedUserId === currentUser.id) {
    return {
      ok: false,
      message: "Нельзя удалить текущего SUPER_ADMIN.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Пользователь не найден.",
    };
  }

  await prisma.user.delete({
    where: {
      id: normalizedUserId,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/sell");
  revalidatePath("/chats");
  revalidatePath("/games/[slug]", "page");
  revalidatePath("/product/[id]", "page");
  revalidatePath("/order/[orderId]", "page");
  revalidatePath("/orders/[orderId]", "page");
  revalidatePath("/user/[id]", "page");

  return {
    ok: true,
  };
}

export async function releaseUserHoldBalance(
  userId: string,
): Promise<AdminActionResult> {
  await requireAdminAccess();

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return {
      ok: false,
      message: "Не удалось определить пользователя.",
    };
  }

  try {
    await prisma.$transaction(
      async (transactionClient) => {
        const user = await transactionClient.user.findUnique({
          where: {
            id: normalizedUserId,
          },
          select: {
            id: true,
            holdBalance: true,
          },
        });

        if (!user) {
          throw new Error("Пользователь не найден.");
        }

        if (user.holdBalance.lte(new Prisma.Decimal(0))) {
          throw new Error("У пользователя нет средств в холде.");
        }

        await transactionClient.user.update({
          where: {
            id: normalizedUserId,
          },
          data: {
            availableBalance: {
              increment: user.holdBalance,
            },
            holdBalance: {
              decrement: user.holdBalance,
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/admin");
    revalidatePath("/profile");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось снять холд пользователя.",
    };
  }
}

export async function createCatalogGame(
  name: string,
  slug: string,
  imageUrl: string,
): Promise<CatalogGameActionResult> {
  await requireCatalogWriteAccess();

  const normalizedName = name.trim();
  const normalizedSlug = generateSlug(slug || name);

  if (!normalizedName) {
    return {
      ok: false,
      message: "Введите название игры.",
    };
  }

  if (!normalizedSlug) {
    return {
      ok: false,
      message: "Введите корректный slug латиницей.",
    };
  }

  let normalizedImageUrl: string | null;

  try {
    normalizedImageUrl = normalizeCatalogGameImage(imageUrl);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обработать изображение игры.",
    };
  }

  const existingGame = await prisma.game.findUnique({
    where: {
      slug: normalizedSlug,
    },
    select: {
      id: true,
    },
  });

  if (existingGame) {
    return {
      ok: false,
      message: "Игра с таким slug уже существует.",
    };
  }

  const game = await prisma.game.create({
    data: {
      name: normalizedName,
      slug: normalizedSlug,
      imageUrl: normalizedImageUrl,
    },
    select: {
      id: true,
    },
  });

  revalidateCatalogPaths();

  const gameSummary = await getCatalogGameSummaryById(game.id);

  if (!gameSummary) {
    return {
      ok: false,
      message: "Не удалось загрузить данные новой игры.",
    };
  }

  return {
    ok: true,
    message: "Игра добавлена в каталог.",
    game: gameSummary,
  };
}

export async function updateCatalogGameImage(
  gameId: string,
  imageUrl: string,
): Promise<CatalogGameActionResult> {
  await requireCatalogWriteAccess();

  const normalizedGameId = gameId.trim();

  if (!normalizedGameId) {
    return {
      ok: false,
      message: "Не удалось определить игру.",
    };
  }

  let normalizedImageUrl: string | null;

  try {
    normalizedImageUrl = normalizeCatalogGameImage(imageUrl);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обработать изображение игры.",
    };
  }

  const existingGame = await prisma.game.findUnique({
    where: {
      id: normalizedGameId,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!existingGame) {
    return {
      ok: false,
      message: "Игра не найдена.",
    };
  }

  const game = await prisma.game.update({
    where: {
      id: normalizedGameId,
    },
    data: {
      imageUrl: normalizedImageUrl,
    },
    select: {
      id: true,
    },
  });

  revalidateCatalogPaths(existingGame.slug);

  const gameSummary = await getCatalogGameSummaryById(game.id);

  if (!gameSummary) {
    return {
      ok: false,
      message: "Не удалось загрузить обновлённые данные игры.",
    };
  }

  return {
    ok: true,
    message: normalizedImageUrl
      ? "Обложка игры обновлена."
      : "Обложка очищена, теперь используется fallback-оформление.",
    game: gameSummary,
  };
}

export async function deleteCatalogGame(
  gameId: string,
): Promise<AdminActionResult> {
  await requireCatalogDeleteAccess();

  const normalizedGameId = gameId.trim();

  if (!normalizedGameId) {
    return {
      ok: false,
      message: "Не удалось определить игру.",
    };
  }

  const existingGame = await prisma.game.findUnique({
    where: {
      id: normalizedGameId,
    },
    select: {
      id: true,
      slug: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!existingGame) {
    return {
      ok: false,
      message: "Игра не найдена.",
    };
  }

  if (existingGame._count.products > 0) {
    return {
      ok: false,
      message: "Нельзя удалить игру, пока к ней привязаны товары.",
    };
  }

  await prisma.game.delete({
    where: {
      id: normalizedGameId,
    },
  });

  revalidateCatalogPaths(existingGame.slug);

  return {
    ok: true,
    message: "Игра удалена из каталога.",
  };
}

export async function createCategory(
  gameId: string,
  name: string,
  slug: string,
): Promise<CatalogCategoryActionResult> {
  await requireCatalogWriteAccess();

  const normalizedGameId = gameId.trim();
  const normalizedName = name.trim();
  const normalizedSlug = generateSlug(slug || name);

  if (!normalizedGameId) {
    return {
      ok: false,
      message: "Не удалось определить игру.",
    };
  }

  if (!normalizedName) {
    return {
      ok: false,
      message: "Введите название подкатегории.",
    };
  }

  if (!normalizedSlug) {
    return {
      ok: false,
      message: "Введите корректный slug подкатегории латиницей.",
    };
  }

  const game = await prisma.game.findUnique({
    where: {
      id: normalizedGameId,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!game) {
    return {
      ok: false,
      message: "Игра не найдена.",
    };
  }

  const existingCategory = await prisma.category.findUnique({
    where: {
      gameId_slug: {
        gameId: normalizedGameId,
        slug: normalizedSlug,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingCategory) {
    return {
      ok: false,
      message: "Подкатегория с таким slug уже существует для этой игры.",
    };
  }

  const category = await prisma.category.create({
    data: {
      gameId: normalizedGameId,
      name: normalizedName,
      slug: normalizedSlug,
    },
    select: {
      id: true,
      gameId: true,
      name: true,
      slug: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  revalidateCatalogPaths(game.slug);

  const gameSummary = await getCatalogGameSummaryById(normalizedGameId);

  return {
    ok: true,
    message: "Подкатегория добавлена.",
    category: mapCatalogCategorySummary(category),
    game: gameSummary ?? undefined,
  };
}

export async function updateCategory(
  id: string,
  name: string,
  slug: string,
): Promise<CatalogCategoryActionResult> {
  await requireCatalogWriteAccess();

  const normalizedCategoryId = id.trim();
  const normalizedName = name.trim();
  const normalizedSlug = generateSlug(slug || name);

  if (!normalizedCategoryId) {
    return {
      ok: false,
      message: "Не удалось определить подкатегорию.",
    };
  }

  if (!normalizedName) {
    return {
      ok: false,
      message: "Введите название подкатегории.",
    };
  }

  if (!normalizedSlug) {
    return {
      ok: false,
      message: "Введите корректный slug подкатегории латиницей.",
    };
  }

  const existingCategory = await prisma.category.findUnique({
    where: {
      id: normalizedCategoryId,
    },
    select: {
      id: true,
      gameId: true,
      game: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!existingCategory) {
    return {
      ok: false,
      message: "Подкатегория не найдена.",
    };
  }

  const duplicateCategory = await prisma.category.findFirst({
    where: {
      gameId: existingCategory.gameId,
      slug: normalizedSlug,
      NOT: {
        id: normalizedCategoryId,
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicateCategory) {
    return {
      ok: false,
      message: "Подкатегория с таким slug уже существует для этой игры.",
    };
  }

  const category = await prisma.category.update({
    where: {
      id: normalizedCategoryId,
    },
    data: {
      name: normalizedName,
      slug: normalizedSlug,
    },
    select: {
      id: true,
      gameId: true,
      name: true,
      slug: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  revalidateCatalogPaths(existingCategory.game.slug);

  const gameSummary = await getCatalogGameSummaryById(existingCategory.gameId);

  return {
    ok: true,
    message: "Подкатегория обновлена.",
    category: mapCatalogCategorySummary(category),
    game: gameSummary ?? undefined,
  };
}

export async function deleteCategory(
  id: string,
): Promise<CatalogCategoryActionResult> {
  await requireCatalogDeleteAccess();

  const normalizedCategoryId = id.trim();

  if (!normalizedCategoryId) {
    return {
      ok: false,
      message: "Не удалось определить подкатегорию.",
    };
  }

  const existingCategory = await prisma.category.findUnique({
    where: {
      id: normalizedCategoryId,
    },
    select: {
      id: true,
      gameId: true,
      name: true,
      slug: true,
      game: {
        select: {
          slug: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!existingCategory) {
    return {
      ok: false,
      message: "Подкатегория не найдена.",
    };
  }

  if (existingCategory._count.products > 0) {
    return {
      ok: false,
      message: "Нельзя удалить подкатегорию, пока к ней привязаны товары.",
    };
  }

  await prisma.category.delete({
    where: {
      id: normalizedCategoryId,
    },
  });

  revalidateCatalogPaths(existingCategory.game.slug);

  const gameSummary = await getCatalogGameSummaryById(existingCategory.gameId);

  return {
    ok: true,
    message: "Подкатегория удалена.",
    category: {
      id: existingCategory.id,
      gameId: existingCategory.gameId,
      name: existingCategory.name,
      slug: existingCategory.slug,
      productCount: existingCategory._count.products,
    },
    game: gameSummary ?? undefined,
  };
}