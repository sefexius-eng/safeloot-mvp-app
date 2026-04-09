import { OrderStatus, Prisma, Rarity } from "@prisma/client";

import { normalizeText } from "@/lib/domain/shared";
import {
  createUserNotification,
  sendNotificationRealtimeEvents,
  type NotificationRealtimeDeliveryInput,
} from "@/lib/domain/notifications-service";
import { publishUserAchievementUnlockedEvent } from "@/lib/pusher";
import { prisma } from "@/lib/prisma";

export interface AchievementGrantResult {
  alreadyEarned: boolean;
  achievement: {
    id: string;
    code: string;
    title: string;
    description: string;
    iconUrl: string;
    rarity: Rarity;
  };
  userAchievement: {
    id: string;
    userId: string;
    achievementId: string;
    earnedAt: string;
  };
}

export const ACHIEVEMENT_CODES = Object.freeze({
  REGISTRATION: "REGISTRATION",
  CHESS_MASTER: "CHESS_MASTER",
  SHOPAHOLIC: "SHOPAHOLIC",
  FIRST_TRADE: "FIRST_TRADE",
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
    code: ACHIEVEMENT_CODES.FIRST_SALE,
  },
  {
    count: 10,
    code: ACHIEVEMENT_CODES.TEN_SALES,
  },
  {
    count: 50,
    code: ACHIEVEMENT_CODES.FIFTY_SALES,
  },
] as const;

type AchievementRecord = NonNullable<Awaited<ReturnType<typeof getAchievementByCode>>>;

interface AchievementAutomationTask {
  label: string;
  run: () => Promise<unknown>;
}

function isAchievementGrantResult(value: unknown): value is AchievementGrantResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AchievementGrantResult>;

  return Boolean(
    typeof candidate.alreadyEarned === "boolean" &&
      candidate.achievement &&
      typeof candidate.achievement === "object" &&
      typeof candidate.achievement.code === "string" &&
      candidate.userAchievement &&
      typeof candidate.userAchievement === "object" &&
      typeof candidate.userAchievement.userId === "string",
  );
}

function collectAchievementGrantResults(value: unknown): AchievementGrantResult[] {
  if (isAchievementGrantResult(value)) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectAchievementGrantResults(entry));
  }

  return [];
}

function logAchievementAutomationGrant(input: {
  scope: string;
  task: string;
  result: AchievementGrantResult;
}) {
  console.info("[ACHIEVEMENT_AUTOMATION_GRANTED]", {
    scope: input.scope,
    task: input.task,
    userId: input.result.userAchievement.userId,
    achievementId: input.result.achievement.id,
    achievementCode: input.result.achievement.code,
    rarity: input.result.achievement.rarity,
    earnedAt: input.result.userAchievement.earnedAt,
  });
}

function normalizeAchievementCode(value?: string) {
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

async function getAchievementByCode(code: string) {
  return prisma.achievement.findUnique({
    where: {
      code,
    },
    select: {
      id: true,
      code: true,
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
  options?: {
    notifyUser?: boolean;
  },
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

    const result: AchievementGrantResult = {
      alreadyEarned: false,
      achievement,
      userAchievement: {
        ...createdUserAchievement,
        earnedAt: createdUserAchievement.earnedAt.toISOString(),
      },
    };

    if (options?.notifyUser) {
      await notifyUserAboutAchievementGrant({
        userId,
        achievement: result.achievement,
      });
    }

    return result;
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
  achievementCode: string;
  notifyUser?: boolean;
}) {
  const userId = normalizeText(input.userId);
  const achievementCode = normalizeAchievementCode(input.achievementCode);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!achievementCode) {
    throw new Error("achievementCode is required.");
  }

  const [achievement] = await Promise.all([
    getAchievementByCode(achievementCode),
    assertUserExists(userId),
  ]);

  if (!achievement) {
    return null;
  }

  return grantAchievementRecordToUser(userId, achievement, {
    notifyUser: input.notifyUser,
  });
}

async function notifyUserAboutAchievementGrant(input: {
  userId: string;
  achievement: AchievementGrantResult["achievement"];
}) {
  const realtimeDeliveryQueue: NotificationRealtimeDeliveryInput[] = [];

  try {
    await prisma.$transaction(async (transactionClient) => {
      await createUserNotification(
        transactionClient,
        {
          userId: input.userId,
          title: "Новое достижение",
          message: `Вы получили достижение «${input.achievement.title}».`,
          link: "/profile",
        },
        undefined,
        realtimeDeliveryQueue,
      );
    });

    await sendNotificationRealtimeEvents(realtimeDeliveryQueue);
    await publishUserAchievementUnlockedEvent(input.userId, {
      achievement: {
        id: input.achievement.id,
        code: input.achievement.code,
        title: input.achievement.title,
        description: input.achievement.description,
        iconUrl: input.achievement.iconUrl,
        rarity: input.achievement.rarity,
      },
    });
  } catch (error) {
    console.error("[ACHIEVEMENT_NOTIFICATION_ERROR]", {
      userId: input.userId,
      achievementCode: input.achievement.code,
      error,
    });
  }
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
    achievementCode: ACHIEVEMENT_CODES.FIRST_PURCHASE,
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
    achievementCode: ACHIEVEMENT_CODES.FIRST_REVIEW,
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
    ).map(({ code }) =>
      grantAchievementToUserIfExists({
        userId: normalizedUserId,
        achievementCode: code,
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
      const grants = collectAchievementGrantResults(result.value).filter(
        (grant) => !grant.alreadyEarned,
      );

      grants.forEach((grant) => {
        logAchievementAutomationGrant({
          scope,
          task: tasks[index]?.label ?? "unknown",
          result: grant,
        });
      });

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
  achievementCode: string;
  notifyUser?: boolean;
}): Promise<AchievementGrantResult> {
  const userId = normalizeText(input.userId);
  const achievementCode = normalizeAchievementCode(input.achievementCode);

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!achievementCode) {
    throw new Error("achievementCode is required.");
  }

  const [achievement] = await Promise.all([
    getAchievementByCode(achievementCode),
    assertUserExists(userId),
  ]);

  if (!achievement) {
    throw new Error("Достижение не найдено.");
  }

  return grantAchievementRecordToUser(userId, achievement, {
    notifyUser: input.notifyUser,
  });
}