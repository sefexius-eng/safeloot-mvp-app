import { Prisma } from "@prisma/client";

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
    rarity: string;
  };
  userAchievement: {
    id: string;
    userId: string;
    achievementId: string;
    earnedAt: string;
  };
}

function normalizeAchievementKey(value?: string) {
  return normalizeText(value).toUpperCase();
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

  const [user, achievement] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    }),
    getAchievementByKey(achievementKey),
  ]);

  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  if (!achievement) {
    throw new Error("Достижение не найдено.");
  }

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