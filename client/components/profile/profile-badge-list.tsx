import type { ReactNode } from "react";

import { getProfileBadgeDefinitions } from "@/lib/profile-badges";
import { cn } from "@/lib/utils";

interface ProfileBadgeListProps {
  badges?: string[] | null;
  className?: string;
  emptyState?: ReactNode;
}

export function ProfileBadgeList({
  badges,
  className,
  emptyState,
}: ProfileBadgeListProps) {
  const badgeDefinitions = getProfileBadgeDefinitions(badges);

  if (badgeDefinitions.length === 0) {
    return emptyState ? <div className={className}>{emptyState}</div> : null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {badgeDefinitions.map((badge) => {
        const Icon = badge.icon;

        return (
          <div
            key={badge.id}
            title={badge.description}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:-translate-y-0.5",
              badge.className,
            )}
          >
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full",
                badge.iconWrapClassName,
              )}
            >
              <Icon className={cn("h-4 w-4", badge.iconClassName)} strokeWidth={2.2} />
            </span>
            <span className="leading-none">{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
}