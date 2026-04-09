import Image from "next/image";

import { cn } from "@/lib/utils";

export interface ProfileAchievementItem {
  id: string;
  code: string;
  title: string;
  description: string;
  iconUrl: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  earnedAt: string;
}

interface ProfileAchievementGridProps {
  eyebrow: string;
  title: string;
  description: string;
  achievements: ProfileAchievementItem[];
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}

function getAchievementRarityMeta(rarity: ProfileAchievementItem["rarity"]) {
  switch (rarity) {
    case "COMMON":
      return {
        label: "Обычная",
        className: "border-white/10 bg-white/5 text-zinc-300",
      };
    case "RARE":
      return {
        label: "Редкая",
        className: "border-sky-500/20 bg-sky-500/10 text-sky-200",
      };
    case "EPIC":
      return {
        label: "Эпическая",
        className: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200",
      };
    case "LEGENDARY":
      return {
        label: "Легендарная",
        className: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      };
    default:
      return {
        label: rarity,
        className: "border-white/10 bg-white/5 text-zinc-300",
      };
  }
}

function formatEarnedAt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileAchievementGrid({
  eyebrow,
  title,
  description,
  achievements,
  emptyTitle,
  emptyDescription,
  className,
}: ProfileAchievementGridProps) {
  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-zinc-400">{description}</p>
      </div>

      {achievements.length === 0 ? (
        <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
          <p className="text-base font-medium text-zinc-200">{emptyTitle}</p>
          <p className="mt-2">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map((achievement) => {
            const rarityMeta = getAchievementRarityMeta(achievement.rarity);

            return (
              <article
                key={achievement.id}
                className="flex min-h-[180px] gap-4 rounded-[1.75rem] border border-white/10 bg-zinc-900/75 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                  <Image
                    src={achievement.iconUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {achievement.title}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        rarityMeta.className,
                      )}
                    >
                      {rarityMeta.label}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    {achievement.description}
                  </p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Получено {formatEarnedAt(achievement.earnedAt)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}