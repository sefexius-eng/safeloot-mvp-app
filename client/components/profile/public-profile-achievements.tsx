import Image from "next/image";

import type { ProfileAchievementItem } from "@/components/profile/profile-achievement-grid";
import { cn } from "@/lib/utils";

interface PublicProfileAchievementsProps {
  achievements: ProfileAchievementItem[];
  className?: string;
}

function getAchievementRarityMeta(rarity: ProfileAchievementItem["rarity"]) {
  switch (rarity) {
    case "COMMON":
      return {
        label: "Common",
        frameClassName:
          "border-white/12 bg-white/6 shadow-[0_16px_35px_rgba(255,255,255,0.08)]",
        glowClassName: "from-white/12 via-white/6 to-transparent",
        badgeClassName: "border-white/14 bg-zinc-950/90 text-zinc-300",
        tooltipClassName: "border-white/12 bg-zinc-950/96",
      };
    case "RARE":
      return {
        label: "Rare",
        frameClassName:
          "border-sky-400/30 bg-sky-500/10 shadow-[0_18px_40px_rgba(56,189,248,0.22)]",
        glowClassName: "from-sky-400/30 via-sky-400/12 to-transparent",
        badgeClassName: "border-sky-400/30 bg-sky-950/90 text-sky-200",
        tooltipClassName: "border-sky-400/25 bg-sky-950/92",
      };
    case "EPIC":
      return {
        label: "Epic",
        frameClassName:
          "border-fuchsia-400/32 bg-fuchsia-500/10 shadow-[0_18px_40px_rgba(217,70,239,0.24)]",
        glowClassName: "from-fuchsia-400/30 via-fuchsia-400/12 to-transparent",
        badgeClassName: "border-fuchsia-400/30 bg-fuchsia-950/92 text-fuchsia-200",
        tooltipClassName: "border-fuchsia-400/25 bg-fuchsia-950/92",
      };
    case "LEGENDARY":
      return {
        label: "Legendary",
        frameClassName:
          "border-amber-400/38 bg-amber-400/12 shadow-[0_18px_44px_rgba(245,158,11,0.26)]",
        glowClassName: "from-amber-300/30 via-amber-300/14 to-transparent",
        badgeClassName: "border-amber-300/30 bg-amber-950/92 text-amber-100",
        tooltipClassName: "border-amber-300/24 bg-amber-950/92",
      };
    default:
      return {
        label: rarity,
        frameClassName:
          "border-white/12 bg-white/6 shadow-[0_16px_35px_rgba(255,255,255,0.08)]",
        glowClassName: "from-white/12 via-white/6 to-transparent",
        badgeClassName: "border-white/14 bg-zinc-950/90 text-zinc-300",
        tooltipClassName: "border-white/12 bg-zinc-950/96",
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

export function PublicProfileAchievements({
  achievements,
  className,
}: PublicProfileAchievementsProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Коллекция
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Достижения
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-zinc-400">
          Редкие награды, которые показывают путь продавца на SafeLoot: от первых шагов до заметных побед и репутации.
        </p>
      </div>

      {achievements.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/5 px-5 py-6 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
          <p className="text-sm leading-7 text-zinc-400">
            Пользователь пока не получил достижений.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {achievements.map((achievement) => {
            const rarityMeta = getAchievementRarityMeta(achievement.rarity);

            return (
              <li key={achievement.id} className="group relative list-none">
                <button
                  type="button"
                  aria-label={`${achievement.title}: ${achievement.description}`}
                  title={achievement.title}
                  className="flex w-full flex-col items-center gap-2 rounded-[1.5rem] border border-white/8 bg-white/[0.035] px-3 py-4 text-center transition duration-300 hover:-translate-y-1 hover:border-white/14 hover:bg-white/[0.055] focus-visible:-translate-y-1 focus-visible:border-white/20 focus-visible:bg-white/[0.06] focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "relative flex h-18 w-18 items-center justify-center overflow-hidden rounded-[1.35rem] border backdrop-blur-sm transition duration-300 group-hover:scale-[1.04] group-focus-within:scale-[1.04]",
                      rarityMeta.frameClassName,
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                        rarityMeta.glowClassName,
                      )}
                    />
                    <Image
                      src={achievement.iconUrl}
                      alt={achievement.title}
                      width={72}
                      height={72}
                      className="relative z-10 h-12 w-12 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                    />
                  </span>

                  <span className="line-clamp-2 text-xs font-semibold leading-5 text-zinc-200">
                    {achievement.title}
                  </span>
                </button>

                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 translate-y-2 rounded-[1.35rem] border p-4 opacity-0 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
                    rarityMeta.tooltipClassName,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {achievement.title}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        rarityMeta.badgeClassName,
                      )}
                    >
                      {rarityMeta.label}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-zinc-200/92">
                    {achievement.description}
                  </p>

                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Получено {formatEarnedAt(achievement.earnedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}