import type { LucideIcon } from "lucide-react";
import { Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";

export interface ProfileBadgeDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  className: string;
  iconWrapClassName: string;
  iconClassName: string;
}

const PROFILE_BADGE_DEFINITIONS: Record<string, Omit<ProfileBadgeDefinition, "id">> = {
  TOP_SELLER: {
    label: "Топ продавец",
    description: "Высокий рейтинг и стабильные продажи.",
    icon: Crown,
    className:
      "border-amber-300/30 bg-amber-300/14 text-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.18)]",
    iconWrapClassName: "bg-amber-200/18 text-amber-100",
    iconClassName: "text-amber-100",
  },
  FAST_DELIVERY: {
    label: "Быстрая доставка",
    description: "Продавец быстро обрабатывает и передает заказы.",
    icon: Zap,
    className:
      "border-sky-300/30 bg-sky-400/12 text-sky-50 shadow-[0_18px_40px_rgba(56,189,248,0.16)]",
    iconWrapClassName: "bg-sky-300/16 text-sky-100",
    iconClassName: "text-sky-100",
  },
  VERIFIED_VENDOR: {
    label: "Проверенный продавец",
    description: "Профиль прошел дополнительную верификацию площадки.",
    icon: ShieldCheck,
    className:
      "border-emerald-300/30 bg-emerald-400/12 text-emerald-50 shadow-[0_18px_40px_rgba(52,211,153,0.16)]",
    iconWrapClassName: "bg-emerald-300/16 text-emerald-100",
    iconClassName: "text-emerald-100",
  },
};

export const MANAGEABLE_PROFILE_BADGE_IDS = Object.freeze(
  Object.keys(PROFILE_BADGE_DEFINITIONS),
);

export const PROFILE_BADGE_OPTIONS = MANAGEABLE_PROFILE_BADGE_IDS.map((badgeId) => ({
  id: badgeId,
  label: PROFILE_BADGE_DEFINITIONS[badgeId].label,
  description: PROFILE_BADGE_DEFINITIONS[badgeId].description,
}));

function normalizeProfileBadgeId(rawBadgeId: string) {
  return rawBadgeId.trim().toUpperCase();
}

export function normalizeProfileBadgeIds(badges: string[] | null | undefined) {
  const normalizedBadgeIds: string[] = [];
  const seenBadgeIds = new Set<string>();

  for (const badgeId of badges ?? []) {
    const normalizedBadgeId = normalizeProfileBadgeId(badgeId);

    if (!normalizedBadgeId || seenBadgeIds.has(normalizedBadgeId)) {
      continue;
    }

    seenBadgeIds.add(normalizedBadgeId);
    normalizedBadgeIds.push(normalizedBadgeId);
  }

  return normalizedBadgeIds;
}

export function mergeProfileBadgeIds(...badgeLists: Array<string[] | null | undefined>) {
  return normalizeProfileBadgeIds(badgeLists.flatMap((badgeList) => badgeList ?? []));
}

export function isManageableProfileBadgeId(rawBadgeId: string) {
  return MANAGEABLE_PROFILE_BADGE_IDS.includes(normalizeProfileBadgeId(rawBadgeId));
}

export function getInvalidManageableProfileBadgeIds(
  badges: string[] | null | undefined,
) {
  const invalidBadgeIds = new Set<string>();

  for (const badgeId of badges ?? []) {
    const normalizedBadgeId = normalizeProfileBadgeId(badgeId);

    if (!normalizedBadgeId || isManageableProfileBadgeId(normalizedBadgeId)) {
      continue;
    }

    invalidBadgeIds.add(normalizedBadgeId);
  }

  return [...invalidBadgeIds];
}

export function normalizeManageableProfileBadgeIds(
  badges: string[] | null | undefined,
) {
  const selectedBadgeIds = new Set(
    normalizeProfileBadgeIds(badges).filter((badgeId) => isManageableProfileBadgeId(badgeId)),
  );

  return MANAGEABLE_PROFILE_BADGE_IDS.filter((badgeId) => selectedBadgeIds.has(badgeId));
}

function formatFallbackBadgeLabel(id: string) {
  const parts = id
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "Достижение продавца";
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getProfileBadgeDefinition(rawBadgeId: string): ProfileBadgeDefinition | null {
  const normalizedBadgeId = normalizeProfileBadgeId(rawBadgeId);

  if (!normalizedBadgeId) {
    return null;
  }

  const knownBadge = PROFILE_BADGE_DEFINITIONS[normalizedBadgeId];

  if (knownBadge) {
    return {
      id: normalizedBadgeId,
      ...knownBadge,
    };
  }

  return {
    id: normalizedBadgeId,
    label: formatFallbackBadgeLabel(normalizedBadgeId),
    description: "Достижение продавца",
    icon: Sparkles,
    className:
      "border-violet-300/25 bg-violet-400/12 text-violet-50 shadow-[0_18px_40px_rgba(167,139,250,0.15)]",
    iconWrapClassName: "bg-violet-300/16 text-violet-100",
    iconClassName: "text-violet-100",
  };
}

export function getProfileBadgeDefinitions(badges: string[] | null | undefined) {
  return normalizeProfileBadgeIds(badges).flatMap((badgeId) => {
    const badge = getProfileBadgeDefinition(badgeId);

    if (!badge) {
      return [];
    }

    return [badge];
  });
}