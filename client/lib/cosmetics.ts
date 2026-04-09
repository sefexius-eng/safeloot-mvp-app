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

export function getNicknameAppearanceClassName(
  appearance: Partial<UserAppearanceData> | null | undefined,
) {
  return appearance?.activeFont?.trim() ?? "";
}

export function getNicknameAppearanceStyle(
  appearance: Partial<UserAppearanceData> | null | undefined,
): CSSProperties | undefined {
  const activeColor = appearance?.activeColor?.trim();

  if (!activeColor) {
    return undefined;
  }

  return {
    color: activeColor,
  };
}