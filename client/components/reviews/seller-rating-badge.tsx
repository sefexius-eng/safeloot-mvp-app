import { RatingStars } from "@/components/reviews/rating-stars";
import type { SellerReviewSummary } from "@/lib/review-summary";
import { cn } from "@/lib/utils";

function formatAverageRating(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatReviewCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${count} отзыв`;
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return `${count} отзыва`;
  }

  return `${count} отзывов`;
}

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
          <RatingStars
            value={Math.round(averageRating)}
            size={size === "sm" ? "sm" : "md"}
          />
          <span className="font-semibold text-white">
            {formatAverageRating(averageRating)} / 5
          </span>
          <span className="text-amber-100/80">{formatReviewCount(summary.reviewCount)}</span>
        </>
      )}
    </div>
  );
}