import { OrderStatus } from "@prisma/client";

import { mergeProfileBadgeIds } from "@/lib/profile-badges";
import { prisma } from "@/lib/prisma";
import {
  getSellerReviewSummary,
  getSellerReviewSummaryMap,
  type SellerReviewSummary,
} from "@/lib/review-summary";

const TOP_SELLER_MIN_COMPLETED_ORDERS = 12;
const TOP_SELLER_MIN_REVIEWS = 5;
const TOP_SELLER_MIN_AVERAGE_RATING = 4.8;

const FAST_DELIVERY_MIN_COMPLETED_ORDERS = 6;
const FAST_DELIVERY_MAX_AVERAGE_COMPLETION_HOURS = 12;
const FAST_DELIVERY_MIN_AVERAGE_RATING = 4.6;

export interface SellerAchievementMetrics extends SellerReviewSummary {
  completedOrdersCount: number;
  averageCompletionHours: number | null;
}

export interface SellerAutomaticBadgeData {
  automaticBadgeIds: string[];
  effectiveBadgeIds: string[];
  metrics: SellerAchievementMetrics;
}

interface SellerCompletionSummary {
  completedOrdersCount: number;
  totalCompletionMs: number;
}

function createEmptySellerAchievementMetrics(): SellerAchievementMetrics {
  return {
    averageRating: null,
    reviewCount: 0,
    completedOrdersCount: 0,
    averageCompletionHours: null,
  };
}

function createEmptySellerCompletionSummary(): SellerCompletionSummary {
  return {
    completedOrdersCount: 0,
    totalCompletionMs: 0,
  };
}

function normalizeCompletionHours(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function getUniqueSellerIds(sellerIds: string[]) {
  return Array.from(
    new Set(sellerIds.map((sellerId) => sellerId.trim()).filter(Boolean)),
  );
}

function getAutomaticProfileBadgeIds(metrics: SellerAchievementMetrics) {
  const automaticBadgeIds: string[] = [];

  if (
    metrics.completedOrdersCount >= TOP_SELLER_MIN_COMPLETED_ORDERS &&
    metrics.reviewCount >= TOP_SELLER_MIN_REVIEWS &&
    (metrics.averageRating ?? 0) >= TOP_SELLER_MIN_AVERAGE_RATING
  ) {
    automaticBadgeIds.push("TOP_SELLER");
  }

  if (
    metrics.completedOrdersCount >= FAST_DELIVERY_MIN_COMPLETED_ORDERS &&
    metrics.averageCompletionHours !== null &&
    metrics.averageCompletionHours <= FAST_DELIVERY_MAX_AVERAGE_COMPLETION_HOURS &&
    (metrics.averageRating ?? 0) >= FAST_DELIVERY_MIN_AVERAGE_RATING
  ) {
    automaticBadgeIds.push("FAST_DELIVERY");
  }

  return automaticBadgeIds;
}

export function getSellerAutomaticBadgeData(
  automaticBadgeDataMap: Map<string, SellerAutomaticBadgeData>,
  sellerId: string,
) {
  return (
    automaticBadgeDataMap.get(sellerId) ?? {
      automaticBadgeIds: [],
      effectiveBadgeIds: [],
      metrics: createEmptySellerAchievementMetrics(),
    }
  );
}

export async function getSellerAutomaticBadgeDataMap(
  sellerIds: string[],
  manualBadgesBySellerId?: Map<string, string[]>,
) {
  const uniqueSellerIds = getUniqueSellerIds(sellerIds);
  const automaticBadgeDataMap = new Map<string, SellerAutomaticBadgeData>();

  for (const sellerId of uniqueSellerIds) {
    automaticBadgeDataMap.set(sellerId, {
      automaticBadgeIds: [],
      effectiveBadgeIds: mergeProfileBadgeIds(
        manualBadgesBySellerId?.get(sellerId) ?? [],
      ),
      metrics: createEmptySellerAchievementMetrics(),
    });
  }

  if (uniqueSellerIds.length === 0) {
    return automaticBadgeDataMap;
  }

  const [reviewSummaryMap, completedOrders] = await Promise.all([
    getSellerReviewSummaryMap(uniqueSellerIds),
    prisma.order.findMany({
      where: {
        sellerId: {
          in: uniqueSellerIds,
        },
        status: OrderStatus.COMPLETED,
      },
      select: {
        sellerId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const completionSummaryMap = new Map<string, SellerCompletionSummary>();

  for (const sellerId of uniqueSellerIds) {
    completionSummaryMap.set(sellerId, createEmptySellerCompletionSummary());
  }

  for (const order of completedOrders) {
    const completionSummary = completionSummaryMap.get(order.sellerId);

    if (!completionSummary) {
      continue;
    }

    completionSummary.completedOrdersCount += 1;
    completionSummary.totalCompletionMs += Math.max(
      0,
      order.updatedAt.getTime() - order.createdAt.getTime(),
    );
  }

  for (const sellerId of uniqueSellerIds) {
    const reviewSummary = getSellerReviewSummary(reviewSummaryMap, sellerId);
    const completionSummary =
      completionSummaryMap.get(sellerId) ?? createEmptySellerCompletionSummary();
    const averageCompletionHours =
      completionSummary.completedOrdersCount > 0
        ? normalizeCompletionHours(
            completionSummary.totalCompletionMs /
              completionSummary.completedOrdersCount /
              (1000 * 60 * 60),
          )
        : null;
    const metrics: SellerAchievementMetrics = {
      averageRating: reviewSummary.averageRating,
      reviewCount: reviewSummary.reviewCount,
      completedOrdersCount: completionSummary.completedOrdersCount,
      averageCompletionHours,
    };
    const automaticBadgeIds = getAutomaticProfileBadgeIds(metrics);

    automaticBadgeDataMap.set(sellerId, {
      automaticBadgeIds,
      effectiveBadgeIds: mergeProfileBadgeIds(
        manualBadgesBySellerId?.get(sellerId) ?? [],
        automaticBadgeIds,
      ),
      metrics,
    });
  }

  return automaticBadgeDataMap;
}

export async function getSellerAutomaticBadgeDataBySellerId(
  sellerId: string,
  manualBadges: string[] = [],
) {
  const automaticBadgeDataMap = await getSellerAutomaticBadgeDataMap(
    [sellerId],
    new Map([[sellerId, manualBadges]]),
  );

  return getSellerAutomaticBadgeData(automaticBadgeDataMap, sellerId);
}