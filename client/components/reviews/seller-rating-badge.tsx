import {
  SellerStarScale,
  formatSellerAverageRating,
  formatSellerReviewCount,
} from "@/components/reviews/seller-star-scale";
import type { SellerReviewSummary } from "@/lib/review-summary";
import { cn } from "@/lib/utils";

interface SellerRatingBadgeProps {
  summary: SellerReviewSummary;
  className?: string;
  size?: "sm" | "md";
}

export function SellerRatingBadge({
  summary,
  className,
  size = "md",
}: SellerRatingBadgeProps) {
  const isEmpty = summary.reviewCount === 0 || summary.averageRating === null;
  const averageRating = summary.averageRating ?? 0;

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-full border",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        isEmpty
          ? "border-white/10 bg-white/5 text-zinc-400"
          : "border-amber-500/20 bg-amber-500/10 text-amber-100",
        className,
      )}
    >
      {isEmpty ? (
        <span className="font-medium">Нет отзывов</span>
      ) : (
        <>
          <span className="font-semibold text-white">
            {formatSellerAverageRating(averageRating)}
          </span>
          <SellerStarScale rating={averageRating} size={size === "sm" ? "sm" : "md"} />
          <span className="text-amber-100/80">
            {formatSellerReviewCount(summary.reviewCount)}
          </span>
        </>
      )}
    </div>
  );
}