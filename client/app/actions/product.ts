"use server";

import { revalidatePath } from "next/cache";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  deleteProductByActor,
  toggleAllProductsVisibilityBySeller,
  toggleProductVisibilityBySeller,
  updateProductByActor,
} from "@/lib/domain/products";

interface ProductActionResult {
  ok: boolean;
  message?: string;
  productId?: string;
  isActive?: boolean;
}

interface BulkProductVisibilityActionResult {
  ok: boolean;
  message?: string;
  updatedCount?: number;
  isActive?: boolean;
}

interface UpdateProductPayload {
  title: string;
  description: string;
  autoDeliveryContent?: string | null;
  images: string[];
  price: number;
  gameId: string;
  categoryId: string;
}

async function requireActiveProductUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.isBanned) {
    throw new Error(BANNED_USER_MESSAGE);
  }

  return currentUser;
}

function revalidateManagedProductPaths(productId: string) {
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/sell");
  revalidatePath("/admin");
  revalidatePath(`/product/${productId}`);
  revalidatePath(`/product/${productId}/edit`);
}

function revalidateVisibilityPaths(input: {
  productId: string;
  sellerId: string;
  gameSlug: string;
}) {
  revalidateManagedProductPaths(input.productId);
  revalidatePath(`/games/${input.gameSlug}`);
  revalidatePath(`/user/${input.sellerId}`);
}

export async function deleteProduct(
  productId: string,
): Promise<ProductActionResult> {
  try {
    const currentUser = await requireActiveProductUser();
    const result = await deleteProductByActor({
      productId,
      userId: currentUser.id,
      role: currentUser.role,
    });

    revalidateManagedProductPaths(result.productId);
    revalidatePath(`/games/${result.gameSlug}`);

    return {
      ok: true,
      productId: result.productId,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось удалить товар.",
    };
  }
}

export async function updateProduct(
  productId: string,
  data: UpdateProductPayload,
): Promise<ProductActionResult> {
  try {
    const currentUser = await requireActiveProductUser();
    const result = await updateProductByActor({
      productId,
      userId: currentUser.id,
      role: currentUser.role,
      ...data,
    });

    revalidateManagedProductPaths(result.productId);
    revalidatePath(`/games/${result.currentGameSlug}`);

    if (result.previousGameSlug !== result.currentGameSlug) {
      revalidatePath(`/games/${result.previousGameSlug}`);
    }

    return {
      ok: true,
      productId: result.productId,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обновить товар.",
    };
  }
}

export async function toggleProductVisibility(
  productId: string,
): Promise<ProductActionResult> {
  try {
    const currentUser = await requireActiveProductUser();
    const result = await toggleProductVisibilityBySeller({
      productId,
      userId: currentUser.id,
    });

    revalidateVisibilityPaths({
      productId: result.productId,
      sellerId: result.sellerId,
      gameSlug: result.gameSlug,
    });

    return {
      ok: true,
      productId: result.productId,
      isActive: result.isActive,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось изменить видимость товара.",
    };
  }
}

export async function toggleAllProductsVisibility(
  isActive: boolean,
): Promise<BulkProductVisibilityActionResult> {
  try {
    const currentUser = await requireActiveProductUser();
    const result = await toggleAllProductsVisibilityBySeller({
      userId: currentUser.id,
      isActive,
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/sell");
    revalidatePath("/admin");
    revalidatePath(`/user/${result.sellerId}`);

    for (const gameSlug of result.gameSlugs) {
      revalidatePath(`/games/${gameSlug}`);
    }

    for (const productId of result.productIds) {
      revalidateManagedProductPaths(productId);
    }

    return {
      ok: true,
      updatedCount: result.updatedCount,
      isActive,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось изменить видимость всех товаров.",
    };
  }
}