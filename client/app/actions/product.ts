"use server";

import { revalidatePath } from "next/cache";

import {
  BANNED_USER_MESSAGE,
  getCurrentSessionUser,
} from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  deleteProductByActor,
  updateProductByActor,
} from "@/lib/marketplace";

interface ProductActionResult {
  ok: boolean;
  message?: string;
  productId?: string;
}

interface UpdateProductPayload {
  title: string;
  description: string;
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