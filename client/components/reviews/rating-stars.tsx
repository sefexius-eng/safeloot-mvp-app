import { cn } from "@/lib/utils";

interface StarIconProps {
  filled: boolean;
  className?: string;
}

function StarIcon({ filled, className }: StarIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        "transition-colors",
        filled ? "text-amber-300" : "text-zinc-600",
        className,
      )}
      fill="currentColor"
    >
      <path d="M12 2.75l2.84 5.75 6.35.92-4.6 4.48 1.09 6.32L12 17.25 6.32 20.22l1.09-6.32-4.6-4.48 6.35-.92L12 2.75z" />
    </svg>
  );
}

interface RatingStarsProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  onChange?: (value: number) => void;
  disabled?: boolean;
}

export function RatingStars({
  value,
  max = 5,
  size = "md",
  className,
  onChange,
  disabled = false,
}: RatingStarsProps) {
  const starSizeClassName =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const star = (
          <StarIcon
            filled={starValue <= value}
            className={starSizeClassName}
          />
        );

        if (!onChange) {
          return <span key={starValue}>{star}</span>;
        }

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange(starValue)}
            disabled={disabled}
            aria-label={`Оценка ${starValue} из ${max}`}
            title={`Оценка ${starValue} из ${max}`}
            className="rounded-full p-0.5 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}