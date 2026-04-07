import { cn } from "@/lib/utils";

const SELLER_STAR_SLOTS = Array(5).fill(0);

interface SellerStarIconProps {
  filled: boolean;
  className?: string;
}

function SellerStarIcon({ filled, className }: SellerStarIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={cn(
        "shrink-0 transition-colors",
        filled ? "fill-yellow-400 text-yellow-400" : "fill-border text-border",
        className,
      )}
    >
      <path d="M12 2.75l2.84 5.75 6.35.92-4.6 4.48 1.09 6.32L12 17.25 6.32 20.22l1.09-6.32-4.6-4.48 6.35-.92L12 2.75z" />
    </svg>
  );
}

export function formatSellerAverageRating(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSellerReviewCount(count: number) {
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

interface SellerStarScaleProps {
  rating: number;
  size?: "sm" | "md";
  className?: string;
  starClassName?: string;
}

export function SellerStarScale({
  rating,
  size = "md",
  className,
  starClassName,
}: SellerStarScaleProps) {
  const normalizedRating = Number.isFinite(rating) ? rating : 0;
  const roundedRating = Math.max(
    0,
    Math.min(SELLER_STAR_SLOTS.length, Math.round(normalizedRating)),
  );
  const starSizeClassName = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {SELLER_STAR_SLOTS.map((_, index) => (
        <SellerStarIcon
          key={index}
          filled={index < roundedRating}
          className={cn(starSizeClassName, starClassName)}
        />
      ))}
    </div>
  );
}