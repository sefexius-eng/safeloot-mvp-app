"use server";

import { revalidatePath } from "next/cache";
import type { CosmeticType } from "@prisma/client";

import { BANNED_USER_MESSAGE, getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import {
  buyCosmetic as buyCosmeticRecord,
  clearActiveCosmetics as clearActiveCosmeticsRecord,
  equipCosmetic as equipCosmeticRecord,
  unequipCosmetic as unequipCosmeticRecord,
} from "@/lib/domain/cosmetics";
import { prisma } from "@/lib/prisma";
import type { CosmeticsViewerState } from "@/lib/cosmetics";

function getUnequipMessage(cosmeticType: CosmeticType) {
  switch (cosmeticType) {
    case "COLOR":
      return "Цвет ника снят.";
    case "FONT":
      return "Шрифт ника снят.";
    case "DECORATION":
      return "Рамка аватара снята.";
    default:
      return "Косметика снята.";
  }
}

interface CosmeticMutationResult {
  ok: boolean;
  message?: string;
  viewer?: CosmeticsViewerState;
  cosmeticId?: string;
  cosmeticType?: CosmeticType;
}

async function requireActiveCosmeticsUser() {
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

async function requireAdminCosmeticsUser() {
  const session = await getAuthSession();
  const currentUser = await getCurrentSessionUser(session);

  if (!currentUser) {
    throw new Error("Unauthorized");
  }

  if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  return currentUser;
}

function normalizeCosmeticPriceValue(value: number, fieldName: string) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return normalizedValue;
}

function revalidateCosmeticViews(userId: string) {
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  revalidatePath("/shop");
  revalidatePath(`/user/${userId}`);
}

export async function buyCosmetic(
  cosmeticId: string,
): Promise<CosmeticMutationResult> {
  try {
    const currentUser = await requireActiveCosmeticsUser();
    const result = await buyCosmeticRecord({
      userId: currentUser.id,
      cosmeticId,
    });

    revalidateCosmeticViews(currentUser.id);

    return {
      ok: true,
      message: `Косметика ${result.cosmetic.name} успешно куплена.`,
      viewer: result.viewer,
      cosmeticId: result.cosmetic.id,
      cosmeticType: result.cosmetic.type,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось купить косметику.",
    };
  }
}

export async function equipCosmetic(
  cosmeticId: string,
): Promise<CosmeticMutationResult> {
  try {
    const currentUser = await requireActiveCosmeticsUser();
    const result = await equipCosmeticRecord({
      userId: currentUser.id,
      cosmeticId,
    });

    revalidateCosmeticViews(currentUser.id);

    return {
      ok: true,
      message: `Косметика ${result.cosmetic.name} экипирована.`,
      viewer: result.viewer,
      cosmeticId: result.cosmetic.id,
      cosmeticType: result.cosmetic.type,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось экипировать косметику.",
    };
  }
}

export async function unequipCosmetic(
  cosmeticType: CosmeticType,
): Promise<CosmeticMutationResult> {
  try {
    const currentUser = await requireActiveCosmeticsUser();
    const result = await unequipCosmeticRecord({
      userId: currentUser.id,
      cosmeticType,
    });

    revalidateCosmeticViews(currentUser.id);

    return {
      ok: true,
      message: getUnequipMessage(cosmeticType),
      viewer: result.viewer,
      cosmeticType: result.cosmeticType,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось снять косметику.",
    };
  }
}

export async function clearActiveCosmetics(): Promise<CosmeticMutationResult> {
  try {
    const currentUser = await requireActiveCosmeticsUser();
    const result = await clearActiveCosmeticsRecord({
      userId: currentUser.id,
    });

    revalidateCosmeticViews(currentUser.id);

    return {
      ok: true,
      message: "Активный косметический образ сброшен.",
      viewer: result.viewer,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сбросить активную косметику.",
    };
  }
}

export async function updateCosmeticPrice(
  id: string,
  newPrice: number,
  oldPrice?: number | null,
) {
  await requireAdminCosmeticsUser();

  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new Error("Cosmetic id is required.");
  }

  const normalizedPrice = normalizeCosmeticPriceValue(newPrice, "newPrice");
  const normalizedOldPrice =
    oldPrice === null || oldPrice === undefined
      ? null
      : normalizeCosmeticPriceValue(oldPrice, "oldPrice");

  const updatedCosmetic = await prisma.cosmetic.update({
    where: {
      id: normalizedId,
    },
    data: {
      price: normalizedPrice,
      oldPrice: normalizedOldPrice,
    },
    select: {
      id: true,
      name: true,
      type: true,
      price: true,
      oldPrice: true,
      value: true,
    },
  });

  revalidatePath("/shop");

  return updatedCosmetic;
}