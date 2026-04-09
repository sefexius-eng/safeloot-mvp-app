import { Prisma, type CosmeticType } from "@prisma/client";

import {
  extractUserAppearance,
  getActiveAppearanceValue,
  getAppearanceFieldByCosmeticType,
  type CosmeticCatalogItem,
  type CosmeticsShopState,
  type CosmeticsViewerState,
  USER_APPEARANCE_SELECT,
  COSMETIC_TYPE_ORDER,
} from "@/lib/cosmetics";
import {
  ensureSufficientUserBalance,
  formatMoney,
  getPlatformAdminAccount,
  normalizeText,
  roundMoney,
} from "@/lib/domain/shared";
import {
  ACHIEVEMENT_CODES,
  grantAchievementToUserIfExists,
  runAchievementAutomation,
} from "@/lib/domain/achievements";
import { prisma } from "@/lib/prisma";

type CosmeticRecord = {
  id: string;
  name: string;
  type: "COLOR" | "FONT" | "DECORATION";
  price: number;
  oldPrice: number | null;
  value: string;
};

type ViewerRecord = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  availableBalance: Prisma.Decimal;
  activeColor: string | null;
  activeFont: string | null;
  activeDecoration: string | null;
  ownedCosmetics: Array<{
    cosmeticId: string;
  }>;
};

function getViewerSelect() {
  return {
    id: true,
    email: true,
    name: true,
    image: true,
    availableBalance: true,
    ...USER_APPEARANCE_SELECT,
    ownedCosmetics: {
      select: {
        cosmeticId: true,
      },
    },
  } as const;
}

function sortCosmetics(left: CosmeticRecord, right: CosmeticRecord) {
  const leftTypeIndex = COSMETIC_TYPE_ORDER.indexOf(left.type);
  const rightTypeIndex = COSMETIC_TYPE_ORDER.indexOf(right.type);

  if (leftTypeIndex !== rightTypeIndex) {
    return leftTypeIndex - rightTypeIndex;
  }

  if (left.price !== right.price) {
    return left.price - right.price;
  }

  return left.name.localeCompare(right.name, "ru-RU");
}

function mapViewerRecord(viewer: ViewerRecord): CosmeticsViewerState {
  return {
    id: viewer.id,
    email: viewer.email,
    name: viewer.name?.trim() || viewer.email.split("@")[0],
    image: viewer.image,
    availableBalance: formatMoney(viewer.availableBalance),
    ownedCosmeticIds: viewer.ownedCosmetics.map((ownership) => ownership.cosmeticId),
    ...extractUserAppearance(viewer),
  };
}

function mapCosmeticRecord(
  cosmetic: CosmeticRecord,
  viewer: CosmeticsViewerState | null,
): CosmeticCatalogItem {
  const ownedCosmeticIds = new Set(viewer?.ownedCosmeticIds ?? []);

  return {
    id: cosmetic.id,
    name: cosmetic.name,
    type: cosmetic.type,
    price: Number(cosmetic.price.toFixed(2)),
    oldPrice:
      cosmetic.oldPrice === null ? null : Number(cosmetic.oldPrice.toFixed(2)),
    value: cosmetic.value,
    isOwned: ownedCosmeticIds.has(cosmetic.id),
    isEquipped:
      getActiveAppearanceValue(viewer, cosmetic.type) === cosmetic.value,
  };
}

async function getViewerById(
  userId: string,
  transactionClient: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return transactionClient.user.findUnique({
    where: {
      id: userId,
    },
    select: getViewerSelect(),
  });
}

async function getCosmeticById(
  cosmeticId: string,
  transactionClient: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return transactionClient.cosmetic.findUnique({
    where: {
      id: cosmeticId,
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
}

export async function getCosmeticsShopState(
  userId?: string | null,
): Promise<CosmeticsShopState> {
  const normalizedUserId = normalizeText(userId ?? undefined);

  const [cosmetics, viewerRecord] = await Promise.all([
    prisma.cosmetic.findMany({
      orderBy: [
        {
          type: "asc",
        },
        {
          price: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        type: true,
        price: true,
        oldPrice: true,
        value: true,
      },
    }),
    normalizedUserId ? getViewerById(normalizedUserId) : Promise.resolve(null),
  ]);

  const viewer = viewerRecord ? mapViewerRecord(viewerRecord) : null;

  return {
    viewer,
    cosmetics: [...cosmetics].sort(sortCosmetics).map((cosmetic) => mapCosmeticRecord(cosmetic, viewer)),
  };
}

export async function buyCosmetic(input: {
  userId: string;
  cosmeticId: string;
}) {
  const userId = normalizeText(input.userId);
  const cosmeticId = normalizeText(input.cosmeticId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!cosmeticId) {
    throw new Error("cosmeticId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const [viewer, cosmetic] = await Promise.all([
        getViewerById(userId, transactionClient),
        getCosmeticById(cosmeticId, transactionClient),
      ]);

      if (!viewer) {
        throw new Error(`User with id ${userId} was not found.`);
      }

      if (!cosmetic) {
        throw new Error(`Cosmetic with id ${cosmeticId} was not found.`);
      }

      const existingOwnership = await transactionClient.userCosmetic.findUnique({
        where: {
          userId_cosmeticId: {
            userId,
            cosmeticId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingOwnership) {
        throw new Error("Эта косметика уже куплена.");
      }

      const cosmeticPrice = roundMoney(cosmetic.price);
      const cosmeticPriceNumber = Number(cosmeticPrice.toFixed(2));

      await ensureSufficientUserBalance(transactionClient, {
        userId,
        balanceField: "availableBalance",
        requiredAmount: cosmeticPrice,
        errorMessage: "Недостаточно средств для покупки косметики.",
      });

      const debitedViewer = await transactionClient.user.updateMany({
        where: {
          id: userId,
          availableBalance: {
            gte: cosmeticPrice,
          },
        },
        data: {
          availableBalance: {
            decrement: cosmeticPrice,
          },
        },
      });

      if (debitedViewer.count !== 1) {
        throw new Error("Недостаточно средств для покупки косметики.");
      }

      await transactionClient.userCosmetic.create({
        data: {
          userId,
          cosmeticId,
        },
      });

      const platformAdmin = await getPlatformAdminAccount(transactionClient);

      await transactionClient.user.update({
        where: {
          id: platformAdmin.id,
        },
        data: {
          platformRevenue: {
            increment: cosmeticPriceNumber,
          },
        },
      });

      const updatedViewer = await getViewerById(userId, transactionClient);

      if (!updatedViewer) {
        throw new Error(`User with id ${userId} was not found after purchase.`);
      }

      return {
        viewer: mapViewerRecord(updatedViewer),
        cosmetic: mapCosmeticRecord(cosmetic, mapViewerRecord(updatedViewer)),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await runAchievementAutomation("buy-cosmetic", [
    {
      label: "shopaholic-achievement",
      run: () =>
        grantAchievementToUserIfExists({
          userId,
          achievementCode: ACHIEVEMENT_CODES.SHOPAHOLIC,
          notifyUser: true,
        }),
    },
  ]);

  return result;
}

export async function equipCosmetic(input: {
  userId: string;
  cosmeticId: string;
}) {
  const userId = normalizeText(input.userId);
  const cosmeticId = normalizeText(input.cosmeticId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!cosmeticId) {
    throw new Error("cosmeticId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const [viewer, cosmetic, ownership] = await Promise.all([
        getViewerById(userId, transactionClient),
        getCosmeticById(cosmeticId, transactionClient),
        transactionClient.userCosmetic.findUnique({
          where: {
            userId_cosmeticId: {
              userId,
              cosmeticId,
            },
          },
          select: {
            id: true,
          },
        }),
      ]);

      if (!viewer) {
        throw new Error(`User with id ${userId} was not found.`);
      }

      if (!cosmetic) {
        throw new Error(`Cosmetic with id ${cosmeticId} was not found.`);
      }

      if (!ownership) {
        throw new Error("Сначала купите эту косметику, чтобы экипировать ее.");
      }

      const appearanceField = getAppearanceFieldByCosmeticType(cosmetic.type);

      await transactionClient.user.update({
        where: {
          id: userId,
        },
        data: {
          [appearanceField]: cosmetic.value,
        },
      });

      const updatedViewer = await getViewerById(userId, transactionClient);

      if (!updatedViewer) {
        throw new Error(`User with id ${userId} was not found after equip.`);
      }

      return {
        viewer: mapViewerRecord(updatedViewer),
        cosmetic: mapCosmeticRecord(cosmetic, mapViewerRecord(updatedViewer)),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}

export async function unequipCosmetic(input: {
  userId: string;
  cosmeticType: CosmeticType;
}) {
  const userId = normalizeText(input.userId);
  const cosmeticType = input.cosmeticType;

  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const viewer = await getViewerById(userId, transactionClient);

      if (!viewer) {
        throw new Error(`User with id ${userId} was not found.`);
      }

      const appearanceField = getAppearanceFieldByCosmeticType(cosmeticType);

      await transactionClient.user.update({
        where: {
          id: userId,
        },
        data: {
          [appearanceField]: null,
        },
      });

      const updatedViewer = await getViewerById(userId, transactionClient);

      if (!updatedViewer) {
        throw new Error(`User with id ${userId} was not found after unequip.`);
      }

      return {
        viewer: mapViewerRecord(updatedViewer),
        cosmeticType,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}

export async function clearActiveCosmetics(input: {
  userId: string;
}) {
  const userId = normalizeText(input.userId);

  if (!userId) {
    throw new Error("userId is required.");
  }

  const result = await prisma.$transaction(
    async (transactionClient) => {
      const viewer = await getViewerById(userId, transactionClient);

      if (!viewer) {
        throw new Error(`User with id ${userId} was not found.`);
      }

      await transactionClient.user.update({
        where: {
          id: userId,
        },
        data: {
          activeColor: null,
          activeFont: null,
          activeDecoration: null,
        },
      });

      const updatedViewer = await getViewerById(userId, transactionClient);

      if (!updatedViewer) {
        throw new Error(`User with id ${userId} was not found after clearing cosmetics.`);
      }

      return {
        viewer: mapViewerRecord(updatedViewer),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return result;
}