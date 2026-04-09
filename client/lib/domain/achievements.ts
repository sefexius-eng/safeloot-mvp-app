import { AchievementRarity, OrderStatus, Prisma } from "@prisma/client";

import { normalizeText } from "@/lib/domain/shared";
import { prisma } from "@/lib/prisma";

export interface AchievementGrantResult {
  alreadyEarned: boolean;
  achievement: {
    id: string;
    key: string;
    title: string;
    description: string;
    iconUrl: string;
    rarity: AchievementRarity;
  };
  userAchievement: {
    id: string;
    userId: string;
    achievementId: string;
    earnedAt: string;
  };
}

export const ACHIEVEMENT_KEYS = Object.freeze({
  FIRST_PURCHASE: "FIRST_PURCHASE",
  FIRST_REVIEW: "FIRST_REVIEW",
  FIRST_SALE: "FIRST_SALE",
  TEN_SALES: "TEN_SALES",
  FIFTY_SALES: "FIFTY_SALES",
});

const PURCHASE_ELIGIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.DISPUTED,
  OrderStatus.REFUNDED,
];

const SELLER_SALE_ACHIEVEMENT_THRESHOLDS = [
  {
    count: 1,
    key: ACHIEVEMENT_KEYS.FIRST_SALE,
  },
  {
    count: 10,
    key: ACHIEVEMENT_KEYS.TEN_SALES,
  },
  {
    count: 50,
    key: ACHIEVEMENT_KEYS.FIFTY_SALES,
  },
] as const;

type AchievementRecord = NonNullable<Awaited<ReturnType<typeof getAchievementByKey>>>;

interface AchievementAutomationTask {
  label: string;
  run: () => Promise<unknown>;
}

function normalizeAchievementKey(value?: string) {
  return normalizeText(value).toUpperCase();
}

async function assertUserExists(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("Пользователь не найден.");
  }
}

async function getAchievementByKey(key: string) {
  return prisma.achievement.findUnique({
    where: {
      key,
    },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      iconUrl: true,
      rarity: true,
    },
  });
}

async function getExistingUserAchievement(userId: string, achievementId: string) {
  return prisma.userAchievement.findUnique({
    where: {
      userId_achievementId: {
        userId,
        achievementId,
      },
    },
    select: {
      id: true,
      userId: true,
      achievementId: true,
      earnedAt: true,
    },
  });
}

async function grantAchievementRecordToUser(
  userId: string,
  achievement: AchievementRecord,
): Promise<AchievementGrantResult> {
  const existingUserAchievement = await getExistingUserAchievement(userId, achievement.id);

  if (existingUserAchievement) {
    return {
      alreadyEarned: true,
      achievement,
      userAchievement: {
        ...existingUserAchievement,
        earnedAt: existingUserAchievement.earnedAt.toISOString(),
      },
    };
  }

  try {
    const createdUserAchievement = await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
      select: {
        id: true,
        userId: true,
        achievementId: true,
        earnedAt: true,
      },
    });

    return {
      alreadyEarned: false,
      achievement,
      userAchievement: {
        ...createdUserAchievement,
        earnedAt: createdUserAchievement.earnedAt.toISOString(),
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentUserAchievement = await getExistingUserAchievement(
        userId,
        achievement.id,
      );

      if (concurrentUserAchievement) {
        return {
          alreadyEarned: true,
          achievement,
          userAchievement: {
            ...concurrentUserAchievement,
            earnedAt: concurrentUserAchievement.earnedAt.toISOString(),
          },
        };
      }
    }

    throw error;
  }
}

export async function grantAchievementToUserIfExists(input: {
  userId: string;
  achievementKey: string;
}) {
  const userId = normalizeText(input.userId);
  const achievementKey = normalizeAchievementKey(input.achievementKey);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!achievementKey) {
    throw new Error("achievementKey is required.");
  }

  const [achievement] = await Promise.all([
    getAchievementByKey(achievementKey),
    assertUserExists(userId),
  ]);

  if (!achievement) {
    return null;
  }

  return grantAchievementRecordToUser(userId, achievement);
}

async function countEligibleBuyerPurchases(userId: string) {
  return prisma.order.count({
    where: {
      buyerId: userId,
      status: {
        in: PURCHASE_ELIGIBLE_STATUSES,
      },
    },
  });
}

async function countCompletedSellerSales(userId: string) {
  return prisma.order.count({
    where: {
      sellerId: userId,
      status: OrderStatus.COMPLETED,
    },
  });
}

async function countWrittenReviews(userId: string) {
  return prisma.review.count({
    where: {
      authorId: userId,
    },
  });
}

export async function maybeGrantBuyerPurchaseAchievements(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const purchaseCount = await countEligibleBuyerPurchases(normalizedUserId);

  if (purchaseCount < 1) {
    return [];
  }

  const result = await grantAchievementToUserIfExists({
    userId: normalizedUserId,
    achievementKey: ACHIEVEMENT_KEYS.FIRST_PURCHASE,
  });

  return result ? [result] : [];
}

export async function maybeGrantReviewAuthorAchievements(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const reviewCount = await countWrittenReviews(normalizedUserId);

  if (reviewCount < 1) {
    return [];
  }

  const result = await grantAchievementToUserIfExists({
    userId: normalizedUserId,
    achievementKey: ACHIEVEMENT_KEYS.FIRST_REVIEW,
  });

  return result ? [result] : [];
}

export async function maybeGrantSellerSaleAchievements(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const completedSalesCount = await countCompletedSellerSales(normalizedUserId);

  if (completedSalesCount < 1) {
    return [];
  }

  const achievementResults = await Promise.all(
    SELLER_SALE_ACHIEVEMENT_THRESHOLDS.filter(
      ({ count }) => completedSalesCount >= count,
    ).map(({ key }) =>
      grantAchievementToUserIfExists({
        userId: normalizedUserId,
        achievementKey: key,
      }),
    ),
  );

  return achievementResults.filter(
    (result): result is AchievementGrantResult => result !== null,
  );
}

export async function runAchievementAutomation(
  scope: string,
  tasks: AchievementAutomationTask[],
) {
  if (tasks.length === 0) {
    return;
  }

  const settledResults = await Promise.allSettled(
    tasks.map((task) => task.run()),
  );

  settledResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      return;
    }

    console.error("[ACHIEVEMENT_AUTOMATION_ERROR]", {
      scope,
      task: tasks[index]?.label,
      error: result.reason,
    });
  });
}

export async function grantAchievementToUser(input: {
  userId: string;
  achievementKey: string;
}): Promise<AchievementGrantResult> {
  const userId = normalizeText(input.userId);
  const achievementKey = normalizeAchievementKey(input.achievementKey);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!achievementKey) {
    throw new Error("achievementKey is required.");
  }

  const [achievement] = await Promise.all([
    getAchievementByKey(achievementKey),
    assertUserExists(userId),
  ]);

  if (!achievement) {
    throw new Error("Достижение не найдено.");
  }

  return grantAchievementRecordToUser(userId, achievement);
}