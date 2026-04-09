import type { ReactNode } from "react";

import { ProfileBadgeList } from "@/components/profile/profile-badge-list";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getNicknameAppearanceClassName,
  getNicknameAppearanceStyle,
  type UserAppearanceData,
} from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

interface ProfileHeroProps {
  eyebrow: string;
  displayName: ReactNode;
  avatarName: string;
  avatarSrc?: string | null;
  bannerUrl?: string | null;
  appearance?: UserAppearanceData | null;
  roleBadge?: ReactNode;
  badges?: string[] | null;
  details?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  avatarStatus?: ReactNode;
  className?: string;
}

export function ProfileHero({
  eyebrow,
  displayName,
  avatarName,
  avatarSrc,
  bannerUrl,
  appearance,
  roleBadge,
  badges,
  details,
  actions,
  aside,
  avatarStatus,
  className,
}: ProfileHeroProps) {
  return (
    <section
      className={cn(
        "rounded-[2.25rem] border border-white/10 bg-zinc-950/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-5",
        className,
      )}
    >
      <div className="relative mb-16 md:mb-20">
        <div className="relative h-48 w-full overflow-hidden rounded-xl bg-muted md:h-64">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.34),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.24),transparent_28%),linear-gradient(135deg,rgba(24,24,27,0.36)_0%,rgba(15,23,42,0.66)_48%,rgba(9,9,11,0.96)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.26)_45%,rgba(9,9,11,0.9)_100%)]" />
        </div>

        <div className="absolute -bottom-12 left-6 z-10 md:-bottom-16 md:left-8">
          <div className="relative">
            <UserAvatar
              src={avatarSrc}
              name={avatarName}
              decoration={appearance?.activeDecoration}
              className="h-24 w-24 border-4 border-background bg-zinc-900/90 text-zinc-100 shadow-[0_22px_50px_rgba(0,0,0,0.34)] md:h-32 md:w-32"
              imageClassName="rounded-full object-cover"
            />
            {avatarStatus ? (
              <div className="absolute bottom-1 right-1 z-20 md:bottom-2 md:right-2">
                {avatarStatus}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-6 pb-6 md:px-8 md:pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            {eyebrow}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.02]">
              <span
                className={getNicknameAppearanceClassName(appearance)}
                style={getNicknameAppearanceStyle(appearance)}
              >
                {displayName}
              </span>
            </h1>
            {roleBadge}
          </div>

          <ProfileBadgeList badges={badges} className="mt-4" />

          {details ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              {details}
            </div>
          ) : null}

          {actions ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>

        {aside ? <div className="w-full xl:w-auto xl:max-w-sm">{aside}</div> : null}
      </div>
    </section>
  );
}