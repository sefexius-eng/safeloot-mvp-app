import { prisma } from "@/lib/prisma";
import { getSellerReviewSummaryBySellerId } from "@/lib/review-summary";

import { formatMoney, normalizeText } from "@/lib/domain/shared";

export async function getUserById(userId: string) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      emailNotifications: true,
      pushNotifications: true,
      role: true,
      rank: true,
      lastSeen: true,
      platformRevenue: true,
      availableBalance: true,
      holdBalance: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error(`User with id ${normalizedUserId} was not found.`);
  }

  const reviewSummary = await getSellerReviewSummaryBySellerId(normalizedUserId);

  return {
    ...user,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    name: user.name ?? user.email.split("@")[0],
    lastSeen: user.lastSeen.toISOString(),
    platformRevenue: user.platformRevenue,
    availableBalance: formatMoney(user.availableBalance),
    holdBalance: formatMoney(user.holdBalance),
    reviewSummary,
  };
}