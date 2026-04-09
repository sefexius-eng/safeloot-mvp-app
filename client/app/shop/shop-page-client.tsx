"use client";

import Link from "next/link";
import { useState } from "react";
import type { CosmeticType, Role } from "@prisma/client";

import { CosmeticsShop } from "@/components/shop/cosmetics-shop";
import { FormattedBalance } from "@/components/ui/formatted-balance";
import { CosmeticName } from "@/components/ui/cosmetic-name";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  COSMETIC_TYPE_LABELS,
  type CosmeticCatalogItem,
  type CosmeticsShopState,
  type CosmeticsViewerState,
  type UserAppearanceData,
} from "@/lib/cosmetics";

type TemporaryShopStyles = {
  color: string | null;
  font: string | null;
  decoration: string | null;
};

interface ShopPageClientProps {
  initialState: CosmeticsShopState;
  currentUserRole: Role | null;
}

function getTemporaryShopStyles(viewer: CosmeticsViewerState | null): TemporaryShopStyles {
  return {
    color: viewer?.activeColor ?? null,
    font: viewer?.activeFont ?? null,
    decoration: viewer?.activeDecoration ?? null,
  };
}

function getPreviewAppearance(tempStyles: TemporaryShopStyles): UserAppearanceData {
  return {
    activeColor: tempStyles.color,
    activeFont: tempStyles.font,
    activeDecoration: tempStyles.decoration,
  };
}

function getPreviewSelectionLabel(
  cosmetics: CosmeticCatalogItem[],
  type: CosmeticType,
  value: string | null,
) {
  if (!value) {
    return "По умолчанию";
  }

  return (
    cosmetics.find((cosmetic) => cosmetic.type === type && cosmetic.value === value)?.name ??
    "Кастомный стиль"
  );
}

export function ShopPageClient({
  initialState,
  currentUserRole,
}: ShopPageClientProps) {
  const [viewer, setViewer] = useState(initialState.viewer);
  const [tempStyles, setTempStyles] = useState<TemporaryShopStyles>(() =>
    getTemporaryShopStyles(initialState.viewer),
  );

  const previewAppearance = getPreviewAppearance(tempStyles);
  const previewDisplayName = viewer?.name ?? "SafeLoot Player";
  const previewEmail = viewer?.email ?? "player@safeloot.net";
  const hasPreviewChanges =
    previewAppearance.activeColor !== (viewer?.activeColor ?? null) ||
    previewAppearance.activeFont !== (viewer?.activeFont ?? null) ||
    previewAppearance.activeDecoration !== (viewer?.activeDecoration ?? null);
  const previewSelections = [
    {
      type: "COLOR" as const,
      label: COSMETIC_TYPE_LABELS.COLOR,
      value: tempStyles.color,
    },
    {
      type: "FONT" as const,
      label: COSMETIC_TYPE_LABELS.FONT,
      value: tempStyles.font,
    },
    {
      type: "DECORATION" as const,
      label: COSMETIC_TYPE_LABELS.DECORATION,
      value: tempStyles.decoration,
    },
  ];

  function updatePreview(type: CosmeticType, value: string | null) {
    setTempStyles((currentStyles) => {
      switch (type) {
        case "COLOR":
          return {
            ...currentStyles,
            color: value,
          };
        case "FONT":
          return {
            ...currentStyles,
            font: value,
          };
        case "DECORATION":
          return {
            ...currentStyles,
            decoration: value,
          };
        default:
          return currentStyles;
      }
    });
  }

  function handleResetPreview() {
    setTempStyles(getTemporaryShopStyles(viewer));
  }

  function handleViewerChange(nextViewer: CosmeticsViewerState) {
    setViewer(nextViewer);
    setTempStyles(getTemporaryShopStyles(nextViewer));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="rounded-[2.35rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(15,23,42,0.94))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)] md:px-10 md:py-10 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200/80">
              SafeLoot Cosmetics
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.04]">
              Магазин косметики для ников, шрифтов и рамок аватаров.
            </h1>
            <p className="mt-4 text-sm leading-7 text-zinc-300 md:text-base">
              Покупайте персональные стили за баланс площадки, примеряйте их перед покупкой и сразу переносите лучший образ в шапку сайта, профиль, сделки и чаты.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {viewer ? (
              <div className="inline-flex h-11 items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100">
                Баланс магазина: <FormattedBalance amount={viewer.availableBalance} className="ml-2" />
              </div>
            ) : (
              <Link
                href="/login?callbackUrl=/shop"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Войти для покупок
              </Link>
            )}

            <Link
              href="/profile"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            >
              Вернуться в профиль
            </Link>
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-white/10 bg-[#0B0E14]/80 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar
              src={viewer?.image ?? null}
              name={previewDisplayName}
              email={previewEmail}
              decoration={previewAppearance.activeDecoration}
              className="h-16 w-16 shrink-0 border-white/10 bg-zinc-900/90 text-zinc-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              imageClassName="rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Примерочная
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <CosmeticName
                  text={previewDisplayName}
                  appearance={previewAppearance}
                  className="block max-w-full truncate text-xl font-semibold text-white"
                />
                {hasPreviewChanges ? (
                  <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                    Preview
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-zinc-400">{previewEmail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {previewSelections.map((selection) => (
                  <span
                    key={selection.type}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                  >
                    <span className="mr-1 text-zinc-500">{selection.label}:</span>
                    <span className="font-semibold text-white">
                      {getPreviewSelectionLabel(
                        initialState.cosmetics,
                        selection.type,
                        selection.value,
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResetPreview}
              disabled={!hasPreviewChanges}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Сбросить
            </button>
          </div>
        </div>
      </section>

      <CosmeticsShop
        initialState={initialState}
        currentUserRole={currentUserRole}
        previewAppearance={previewAppearance}
        onPreview={updatePreview}
        onViewerChange={handleViewerChange}
      />
    </main>
  );
}
