"use client";

import { useEffect, useState, useTransition } from "react";

import { updateUserBadges } from "@/app/admin/actions";
import {
  PROFILE_BADGE_OPTIONS,
  getProfileBadgeDefinition,
  normalizeManageableProfileBadgeIds,
  normalizeProfileBadgeIds,
} from "@/lib/profile-badges";
import { cn } from "@/lib/utils";

interface AdminUserBadgeManagerProps {
  automaticBadges?: string[];
  userId: string;
  currentBadges: string[];
}

export function AdminUserBadgeManager({
  automaticBadges = [],
  userId,
  currentBadges,
}: AdminUserBadgeManagerProps) {
  const [selectedBadges, setSelectedBadges] = useState<string[]>(
    normalizeManageableProfileBadgeIds(currentBadges),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const automaticBadgeIds = normalizeProfileBadgeIds(automaticBadges);

  useEffect(() => {
    setSelectedBadges(normalizeManageableProfileBadgeIds(currentBadges));
  }, [currentBadges]);

  function renderBadgeChips(badgeIds: string[], emptyLabel: string) {
    if (badgeIds.length === 0) {
      return (
        <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">
          {emptyLabel}
        </span>
      );
    }

    return badgeIds.map((badgeId) => {
      const badge = getProfileBadgeDefinition(badgeId);

      if (!badge) {
        return null;
      }

      const Icon = badge.icon;

      return (
        <span
          key={badge.id}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold text-white",
            badge.className,
          )}
          title={badge.description}
        >
          <Icon className={cn("h-3.5 w-3.5", badge.iconClassName)} strokeWidth={2.2} />
          {badge.label}
        </span>
      );
    });
  }

  function handleToggle(badgeId: string) {
    const previousBadges = selectedBadges;
    const nextBadges = selectedBadges.includes(badgeId)
      ? selectedBadges.filter((selectedBadgeId) => selectedBadgeId !== badgeId)
      : normalizeManageableProfileBadgeIds([...selectedBadges, badgeId]);

    setSelectedBadges(nextBadges);
    setError(null);

    startTransition(() => {
      void updateUserBadges(userId, nextBadges)
        .then((result) => {
          if (!result.ok) {
            setSelectedBadges(previousBadges);
            setError(result.message ?? "Не удалось обновить бейджи продавца.");
            return;
          }

          setSelectedBadges(result.badges ?? nextBadges);
        })
        .catch((updateError) => {
          setSelectedBadges(previousBadges);
          setError(
            updateError instanceof Error
              ? updateError.message
              : "Не удалось обновить бейджи продавца.",
          );
        });
    });
  }

  return (
    <div className="flex min-w-[310px] flex-col gap-3">
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
            Автоматически
          </p>
          <div className="flex flex-wrap gap-2">
            {renderBadgeChips(automaticBadgeIds, "Нет автонаград")}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
            Вручную
          </p>
          <div className="flex flex-wrap gap-2">
            {renderBadgeChips(selectedBadges, "Нет ручных бейджей")}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROFILE_BADGE_OPTIONS.map((badgeOption) => {
          const badge = getProfileBadgeDefinition(badgeOption.id);

          if (!badge) {
            return null;
          }

          const isSelected = selectedBadges.includes(badgeOption.id);
          const Icon = badge.icon;

          return (
            <button
              key={badgeOption.id}
              type="button"
              onClick={() => handleToggle(badgeOption.id)}
              disabled={isPending}
              title={badgeOption.description}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? badge.className
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  isSelected ? badge.iconClassName : "text-zinc-400",
                )}
                strokeWidth={2.2}
              />
              {badgeOption.label}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <p className="text-xs text-zinc-500">Сохраняем достижения...</p>
      ) : null}
      {error ? <p className="max-w-[300px] text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}