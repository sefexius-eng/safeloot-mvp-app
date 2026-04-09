import type { CosmeticType } from "@prisma/client";
import type { CSSProperties } from "react";

export interface UserAppearanceData {
  activeColor: string | null;
  activeFont: string | null;
  activeDecoration: string | null;
}

export interface CosmeticCatalogItem {
  id: string;
  name: string;
  type: CosmeticType;
  price: number;
  oldPrice: number | null;
  value: string;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface CosmeticsViewerState extends UserAppearanceData {
  id: string;
  email: string;
  name: string;
  image: string | null;
  availableBalance: string;
  ownedCosmeticIds: string[];
}

export interface CosmeticsShopState {
  viewer: CosmeticsViewerState | null;
  cosmetics: CosmeticCatalogItem[];
}

export type CosmeticRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export const USER_APPEARANCE_SELECT = {
  activeColor: true,
  activeFont: true,
  activeDecoration: true,
} as const;

export const COSMETIC_TYPE_ORDER: CosmeticType[] = [
  "COLOR",
  "FONT",
  "DECORATION",
];

export const COSMETIC_TYPE_LABELS: Record<CosmeticType, string> = {
  COLOR: "Цвета ников",
  FONT: "Шрифты",
  DECORATION: "Рамки",
};

export const COSMETIC_RARITY_ORDER: CosmeticRarity[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

export const COSMETIC_RARITY_LABELS: Record<CosmeticRarity, string> = {
  COMMON: "Обычная",
  RARE: "Редкая",
  EPIC: "Эпическая",
  LEGENDARY: "Легендарная",
};

export const COSMETIC_RARITY_DESCRIPTIONS: Record<CosmeticRarity, string> = {
  COMMON: "Лёгкий косметический акцент без перегруза образа.",
  RARE: "Заметный стиль для витрины, чатов и отзывов.",
  EPIC: "Сильный визуальный образ для узнаваемого профиля.",
  LEGENDARY: "Максимально выразительная косметика для ключевых поверхностей.",
};

// Keep these literal utility strings in source so Tailwind v4 includes them
// even though the active cosmetic values are loaded dynamically from the database.
export const COSMETIC_TAILWIND_VALUE_SAFELIST = [
  "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]",
  "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]",
  "text-red-600 font-bold drop-shadow-[0_0_5px_rgba(220,38,38,0.9)]",
  "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]",
  "bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 animate-pulse",
  "bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 animate-pulse",
  "font-mono",
  "font-serif",
  "font-black tracking-widest",
  "ring-4 ring-yellow-400 ring-offset-2 ring-offset-[#0B0E14]",
  "ring-2 ring-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.8)]",
  "ring-4 ring-red-600 border-dashed",
] as const;

type CosmeticAppearanceField = keyof UserAppearanceData;

const COSMETIC_APPEARANCE_FIELDS: Record<CosmeticType, CosmeticAppearanceField> = {
  COLOR: "activeColor",
  FONT: "activeFont",
  DECORATION: "activeDecoration",
};

export function extractUserAppearance<T extends Partial<UserAppearanceData>>(
  user: T | null | undefined,
): UserAppearanceData {
  return {
    activeColor: user?.activeColor ?? null,
    activeFont: user?.activeFont ?? null,
    activeDecoration: user?.activeDecoration ?? null,
  };
}

export function getAppearanceFieldByCosmeticType(type: CosmeticType) {
  return COSMETIC_APPEARANCE_FIELDS[type];
}

export function getActiveAppearanceValue(
  appearance: Partial<UserAppearanceData> | null | undefined,
  cosmeticType: CosmeticType,
) {
  return appearance?.[getAppearanceFieldByCosmeticType(cosmeticType)] ?? null;
}

export function getCosmeticRarity(price: number): CosmeticRarity {
  if (price >= 85) {
    return "LEGENDARY";
  }

  if (price >= 55) {
    return "EPIC";
  }

  if (price >= 35) {
    return "RARE";
  }

  return "COMMON";
}

function isCssColorValue(value: string) {
  return /^(#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|oklab\(|lab\(|lch\(|var\()/.test(
    value,
  );
}

function normalizeAppearanceClassValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isCosmeticAssetUrl(value: string) {
  return /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/|blob:)/i.test(value);
}

export function getNicknameAppearanceClassName(
  appearance: Partial<UserAppearanceData> | null | undefined,
) {
  const activeFont = normalizeAppearanceClassValue(appearance?.activeFont);
  const activeColor = normalizeAppearanceClassValue(appearance?.activeColor);

  return [
    activeFont,
    activeColor && !isCssColorValue(activeColor) ? activeColor : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getNicknameAppearanceStyle(
  appearance: Partial<UserAppearanceData> | null | undefined,
): CSSProperties | undefined {
  const activeColor = normalizeAppearanceClassValue(appearance?.activeColor);

  if (!activeColor || !isCssColorValue(activeColor)) {
    return undefined;
  }

  return {
    color: activeColor,
  };
}

export function getAvatarDecorationClassName(
  decoration: string | null | undefined,
) {
  const normalizedDecoration = normalizeAppearanceClassValue(decoration);

  if (!normalizedDecoration || isCosmeticAssetUrl(normalizedDecoration)) {
    return "";
  }

  return normalizedDecoration;
}

export function getAvatarDecorationImageSrc(
  decoration: string | null | undefined,
) {
  const normalizedDecoration = normalizeAppearanceClassValue(decoration);

  if (!normalizedDecoration || !isCosmeticAssetUrl(normalizedDecoration)) {
    return null;
  }

  return normalizedDecoration;
}