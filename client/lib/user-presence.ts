export const USER_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const USER_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

import { formatLastSeen } from "@/lib/utils";

export type UserPresenceState = "online" | "recent" | "offline";

interface UserPresenceMetaOptions {
  subjectLabel?: string;
  onlineLabel?: string;
  recentLabel?: string;
  offlineLabel?: string;
  onlineLongLabel?: string;
  recentLongLabel?: string;
  offlineLongLabel?: string;
}

export function getUserPresenceMetaForState(
  state: UserPresenceState,
  options: UserPresenceMetaOptions = {},
) {
  const subjectLabel = options.subjectLabel ?? "Пользователь";
  const onlineLabel = options.onlineLabel ?? "🟢 Онлайн";
  const recentLabel = options.recentLabel ?? "Был(а) в сети";
  const offlineLabel = options.offlineLabel ?? "Был(а) в сети";

  switch (state) {
    case "online":
      return {
        state,
        isOnline: true,
        shortLabel: onlineLabel,
        longLabel: options.onlineLongLabel ?? onlineLabel,
        ariaLabel: `${subjectLabel}: онлайн`,
        title: `${subjectLabel}: онлайн`,
      };
    case "recent":
      return {
        state,
        isOnline: false,
        shortLabel: recentLabel,
        longLabel: options.recentLongLabel ?? recentLabel,
        ariaLabel: `${subjectLabel}: ${recentLabel}`,
        title: `${subjectLabel}: ${recentLabel}`,
      };
    default:
      return {
        state,
        isOnline: false,
        shortLabel: offlineLabel,
        longLabel: options.offlineLongLabel ?? offlineLabel,
        ariaLabel: `${subjectLabel}: ${offlineLabel}`,
        title: `${subjectLabel}: ${offlineLabel}`,
      };
  }
}

function getLastSeenTimestamp(lastSeen?: Date | string | null) {
  if (!lastSeen) {
    return null;
  }

  const timestamp = new Date(lastSeen).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getUserPresenceState(
  lastSeen?: Date | string | null,
  onlineWindowMs = USER_ONLINE_WINDOW_MS,
  recentWindowMs = USER_RECENT_WINDOW_MS,
): UserPresenceState {
  const lastSeenTimestamp = getLastSeenTimestamp(lastSeen);

  if (lastSeenTimestamp === null) {
    return "offline";
  }

  if (lastSeenTimestamp > Date.now() - onlineWindowMs) {
    return "online";
  }

  if (lastSeenTimestamp > Date.now() - recentWindowMs) {
    return "recent";
  }

  return "offline";
}

export function getUserPresenceMeta(
  lastSeen?: Date | string | null,
  options: UserPresenceMetaOptions = {},
) {
  const state = getUserPresenceState(lastSeen);

  if (state === "online") {
    return getUserPresenceMetaForState(state, options);
  }

  const subjectLabel = options.subjectLabel ?? "Пользователь";
  const formattedLastSeen = formatLastSeen(lastSeen);

  return {
    state,
    isOnline: false,
    shortLabel: formattedLastSeen,
    longLabel: formattedLastSeen,
    ariaLabel: `${subjectLabel}: ${formattedLastSeen}`,
    title: `${subjectLabel}: ${formattedLastSeen}`,
  };
}