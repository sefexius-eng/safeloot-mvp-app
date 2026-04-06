import { prisma } from "@/lib/prisma";

export interface SellerReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

function createEmptySellerReviewSummary(): SellerReviewSummary {
  return {
    averageRating: null,
    reviewCount: 0,
  };
}

function normalizeAverageRating(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

export function getSellerReviewSummary(
  reviewSummaryMap: Map<string, SellerReviewSummary>,
  sellerId: string,
) {
  return reviewSummaryMap.get(sellerId) ?? createEmptySellerReviewSummary();
}

export async function getSellerReviewSummaryMap(sellerIds: string[]) {
  const uniqueSellerIds = Array.from(
    new Set(sellerIds.map((sellerId) => sellerId.trim()).filter(Boolean)),
  );
  const reviewSummaryMap = new Map<string, SellerReviewSummary>();

  for (const sellerId of uniqueSellerIds) {
    reviewSummaryMap.set(sellerId, createEmptySellerReviewSummary());
  }

  if (uniqueSellerIds.length === 0) {
    return reviewSummaryMap;
  }

  const summaries = await prisma.review.groupBy({
    by: ["sellerId"],
    where: {
      sellerId: {
        in: uniqueSellerIds,
      },
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  for (const summary of summaries) {
    reviewSummaryMap.set(summary.sellerId, {
      averageRating: normalizeAverageRating(summary._avg.rating),
      reviewCount: summary._count._all,
    });
  }

  return reviewSummaryMap;
}

export async function getSellerReviewSummaryBySellerId(sellerId: string) {
  const reviewSummaryMap = await getSellerReviewSummaryMap([sellerId]);

  return getSellerReviewSummary(reviewSummaryMap, sellerId);
}