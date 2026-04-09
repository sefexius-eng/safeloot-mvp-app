"use client";

import { useMemo } from "react";

import { useRealtimePresence } from "@/components/providers/realtime-presence-provider";
import {
  getUserPresenceMeta,
  getUserPresenceMetaForState,
} from "@/lib/user-presence";
import { cn } from "@/lib/utils";

interface PresenceMetaOptions {
  subjectLabel?: string;
  onlineLabel?: string;
  recentLabel?: string;
  offlineLabel?: string;
  onlineLongLabel?: string;
  recentLongLabel?: string;
  offlineLongLabel?: string;
}

interface UserPresenceBaseProps extends PresenceMetaOptions {
  userId?: string | null;
  lastSeen?: Date | string | null;
}

interface UserPresenceDotProps extends UserPresenceBaseProps {
  className?: string;
}

interface UserPresenceInlineStatusProps extends UserPresenceBaseProps {
  className?: string;
  textClassName?: string;
  dotClassName?: string;
  label?: "short" | "long";
  showDot?: boolean;
}

interface UserPresencePillProps extends UserPresenceBaseProps {
  className?: string;
  label?: "short" | "long";
}

function useResolvedPresenceMeta({
  userId,
  lastSeen,
  ...options
}: UserPresenceBaseProps) {
  const { onlineUserIds } = useRealtimePresence();
  const normalizedUserId = userId?.trim() ?? "";

  return useMemo(() => {
    if (normalizedUserId && onlineUserIds.has(normalizedUserId)) {
      return getUserPresenceMetaForState("online", options);
    }

    return getUserPresenceMeta(lastSeen, options);
  }, [lastSeen, normalizedUserId, onlineUserIds, options]);
}

export function UserPresenceDot({ className, ...props }: UserPresenceDotProps) {
  const presence = useResolvedPresenceMeta(props);

  return (
    <span
      aria-label={presence.ariaLabel}
      title={presence.title}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-950 text-[10px] shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
        presence.isOnline
          ? "bg-emerald-500 text-emerald-950 shadow-[0_8px_20px_rgba(16,185,129,0.4)]"
          : "bg-gray-500 text-gray-100",
        className,
      )}
    >
      ●
    </span>
  );
}

export function UserPresenceInlineStatus({
  className,
  dotClassName,
  label = "short",
  showDot = true,
  textClassName,
  ...props
}: UserPresenceInlineStatusProps) {
  const presence = useResolvedPresenceMeta(props);

  return (
    <span
      aria-label={presence.ariaLabel}
      title={presence.title}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      {showDot ? (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            presence.isOnline ? "bg-emerald-400" : "bg-gray-500",
            dotClassName,
          )}
        />
      ) : null}
      <span
        className={cn(
          presence.isOnline ? "text-emerald-200" : "text-zinc-400",
          textClassName,
        )}
      >
        {label === "long" ? presence.longLabel : presence.shortLabel}
      </span>
    </span>
  );
}

export function UserPresencePill({
  className,
  label = "short",
  ...props
}: UserPresencePillProps) {
  const presence = useResolvedPresenceMeta(props);

  return (
    <span
      aria-label={presence.ariaLabel}
      title={presence.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        presence.isOnline
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-zinc-300",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          presence.isOnline ? "bg-emerald-400" : "bg-gray-500",
        )}
      />
      {label === "long" ? presence.longLabel : presence.shortLabel}
    </span>
  );
}