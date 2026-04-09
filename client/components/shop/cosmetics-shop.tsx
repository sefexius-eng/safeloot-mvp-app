"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CosmeticType } from "@prisma/client";

import {
  buyCosmetic as buyCosmeticAction,
  clearActiveCosmetics as clearActiveCosmeticsAction,
  equipCosmetic as equipCosmeticAction,
  unequipCosmetic as unequipCosmeticAction,
} from "@/app/actions/cosmetics";
import { useCurrency } from "@/components/providers/currency-provider";
import { CosmeticName } from "@/components/ui/cosmetic-name";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  COSMETIC_RARITY_DESCRIPTIONS,
  COSMETIC_RARITY_LABELS,
  COSMETIC_RARITY_ORDER,
  COSMETIC_TYPE_LABELS,
  COSMETIC_TYPE_ORDER,
  extractUserAppearance,
  getActiveAppearanceValue,
  getCosmeticRarity,
  type CosmeticRarity,
  type CosmeticCatalogItem,
  type CosmeticsShopState,
  type CosmeticsViewerState,
} from "@/lib/cosmetics";
import { cn } from "@/lib/utils";
import { ProfileHero } from "@/components/profile/profile-hero";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";

const cosmeticNameCollator = new Intl.Collator("ru-RU");

type ShopMessageState = {
  tone: "success" | "error";
  text: string;
} | null;

type ShopSortMode = "recommended" | "price-asc" | "price-desc" | "name";

type RarityRecommendation = {
  rarity: CosmeticRarity;
  cosmetic: CosmeticCatalogItem;
};

const SHOP_ACTION_BUTTON_BASE_CLASS_NAME =
  "flex h-10 w-full items-center justify-center rounded-2xl text-sm font-semibold transition disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

const SHOP_BUY_BUTTON_CLASS_NAME =
  "border border-orange-400/30 bg-orange-500 px-5 text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:-translate-y-0.5 hover:bg-orange-600";

const SHOP_SECONDARY_BUTTON_CLASS_NAME =
  "border border-white/20 bg-white/5 px-5 text-white hover:-translate-y-0.5 hover:bg-white/10";

const SHOP_SECONDARY_WIDE_BUTTON_CLASS_NAME =
  "border border-white/20 bg-white/5 px-4 text-white hover:-translate-y-0.5 hover:bg-white/10";

function getTypeAccent(type: CosmeticType) {
  switch (type) {
    case "COLOR":
      return {
        pill: "border-orange-500/20 bg-orange-500/10 text-orange-100",
        button: "bg-orange-600 text-white hover:bg-orange-500",
        tab: "border-orange-500/30 bg-orange-500/12 text-orange-100",
      };
    case "FONT":
      return {
        pill: "border-sky-500/20 bg-sky-500/10 text-sky-100",
        button: "bg-sky-600 text-white hover:bg-sky-500",
        tab: "border-sky-500/30 bg-sky-500/12 text-sky-100",
      };
    case "DECORATION":
      return {
        pill: "border-amber-500/20 bg-amber-500/10 text-amber-100",
        button: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
        tab: "border-amber-500/30 bg-amber-500/12 text-amber-100",
      };
    default:
      return {
        pill: "border-white/10 bg-white/5 text-zinc-100",
        button: "bg-zinc-800 text-white hover:bg-zinc-700",
        tab: "border-white/10 bg-white/5 text-white",
      };
  }
}

function getRarityAccent(rarity: CosmeticRarity) {
  switch (rarity) {
    case "COMMON":
      return {
        pill: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
        card: "border-zinc-500/20 bg-zinc-500/5",
      };
    case "RARE":
      return {
        pill: "border-sky-500/20 bg-sky-500/10 text-sky-100",
        card: "border-sky-500/20 bg-sky-500/5",
      };
    case "EPIC":
      return {
        pill: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-100",
        card: "border-fuchsia-500/20 bg-fuchsia-500/5",
      };
    case "LEGENDARY":
      return {
        pill: "border-amber-500/20 bg-amber-500/10 text-amber-100",
        card: "border-amber-500/20 bg-amber-500/5",
      };
    default:
      return {
        pill: "border-white/10 bg-white/5 text-zinc-100",
        card: "border-white/10 bg-white/5",
      };
  }
}

function updateCosmeticsForViewer(
  cosmetics: CosmeticCatalogItem[],
  viewer: CosmeticsViewerState,
) {
  return cosmetics.map((cosmetic) => ({
    ...cosmetic,
    isOwned: viewer.ownedCosmeticIds.includes(cosmetic.id),
    isEquipped: getActiveAppearanceValue(viewer, cosmetic.type) === cosmetic.value,
  }));
}

function getCosmeticPreviewAppearance(
  cosmetic: CosmeticCatalogItem,
  viewer: CosmeticsViewerState | null,
) {
  return {
    activeColor:
      cosmetic.type === "COLOR"
        ? cosmetic.value
        : viewer?.activeColor ?? "#F4F4F5",
    activeFont:
      cosmetic.type === "FONT"
        ? cosmetic.value
        : viewer?.activeFont ?? null,
    activeDecoration:
      cosmetic.type === "DECORATION"
        ? cosmetic.value
        : viewer?.activeDecoration ?? null,
  };
}

function getRecommendationPriority(
  cosmetic: CosmeticCatalogItem,
  viewerBalance: number,
) {
  if (cosmetic.isEquipped) {
    return 0;
  }

  if (cosmetic.isOwned) {
    return 1;
  }

  if (cosmetic.price <= viewerBalance) {
    return 2;
  }

  return 3;
}

function sortVisibleCosmetics(
  cosmetics: CosmeticCatalogItem[],
  sortMode: ShopSortMode,
  viewerBalance: number,
) {
  return [...cosmetics].sort((left, right) => {
    if (sortMode === "recommended") {
      const leftPriority = getRecommendationPriority(left, viewerBalance);
      const rightPriority = getRecommendationPriority(right, viewerBalance);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
    }

    if (sortMode === "price-asc") {
      if (left.price !== right.price) {
        return left.price - right.price;
      }
    }

    if (sortMode === "price-desc") {
      if (left.price !== right.price) {
        return right.price - left.price;
      }
    }

    if (sortMode === "name") {
      return cosmeticNameCollator.compare(left.name, right.name);
    }

    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return cosmeticNameCollator.compare(left.name, right.name);
  });
}

function getRarityRecommendation(
  cosmetics: CosmeticCatalogItem[],
  rarity: CosmeticRarity,
  viewerBalance: number,
) {
  const cosmeticsOfRarity = cosmetics.filter(
    (cosmetic) => getCosmeticRarity(cosmetic.price) === rarity,
  );

  if (cosmeticsOfRarity.length === 0) {
    return null;
  }

  return [...cosmeticsOfRarity].sort((left, right) => {
    const leftPriority = getRecommendationPriority(left, viewerBalance);
    const rightPriority = getRecommendationPriority(right, viewerBalance);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if (left.price !== right.price) {
      return right.price - left.price;
    }

    return cosmeticNameCollator.compare(left.name, right.name);
  })[0];
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function matchesCosmeticSearch(cosmetic: CosmeticCatalogItem, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  return [cosmetic.name, COSMETIC_TYPE_LABELS[cosmetic.type], cosmetic.value]
    .join(" ")
    .toLocaleLowerCase("ru-RU")
    .includes(searchQuery);
}

function getSlotEmptyLabel(type: CosmeticType) {
  switch (type) {
    case "COLOR":
      return "Цвет не выбран";
    case "FONT":
      return "Шрифт не выбран";
    case "DECORATION":
      return "Рамка не выбрана";
    default:
      return "Слот пуст";
  }
}

function getUnequipSuccessMessage(type: CosmeticType) {
  switch (type) {
    case "COLOR":
      return "Цвет ника снят.";
    case "FONT":
      return "Шрифт ника снят.";
    case "DECORATION":
      return "Рамка аватара снята.";
    default:
      return "Косметика снята.";
  }
}

function getShopHeadline(type: CosmeticType) {
  switch (type) {
    case "COLOR":
      return "Выбирайте оттенок, который сразу выделит имя в каталоге, профиле и чатах.";
    case "FONT":
      return "Подберите подачу: строгий, игровой или скоростной стиль отображения ника.";
    case "DECORATION":
      return "Добавьте рамку вокруг аватара, чтобы образ был заметен даже без текста.";
    default:
      return "Настройте внешний вид профиля.";
  }
}

function CosmeticPreview({
  cosmetic,
  viewer,
}: {
  cosmetic: CosmeticCatalogItem;
  viewer: CosmeticsViewerState | null;
}) {
  const previewAppearance = getCosmeticPreviewAppearance(cosmetic, viewer);
  const previewName = viewer?.name ?? "SafeLoot Player";
  const previewEmail = viewer?.email ?? "player@safeloot.net";

  return (
    <div className="grid gap-3">
      <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          В шапке и профиле
        </p>
        <div className="mt-4 flex items-center gap-3">
          <UserAvatar
            src={viewer?.image ?? null}
            name={previewName}
            email={previewEmail}
            decoration={previewAppearance.activeDecoration}
            className="h-14 w-14 border-white/10 bg-zinc-900/80 text-zinc-100"
            imageClassName="rounded-full object-cover"
          />
          <div className="min-w-0">
            <CosmeticName
              text={previewName}
              appearance={previewAppearance}
              className="block truncate text-lg font-semibold tracking-tight text-white"
            />
            <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-zinc-500">
              seller profile
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          В чате сделки
        </p>
        <div className="mt-3 rounded-[1rem] border border-white/10 bg-zinc-950/70 px-4 py-3">
          <CosmeticName
            text={previewName}
            appearance={previewAppearance}
            className="block text-xs font-semibold uppercase tracking-[0.18em]"
          />
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {cosmetic.type === "DECORATION"
              ? "Рамка усиливает узнаваемость в диалогах и уведомлениях без перегруза интерфейса."
              : "Этот стиль будет одинаково читаться в сделках, таверне, отзывах и карточках продавца."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CosmeticsShop({ initialState }: { initialState: CosmeticsShopState }) {
  const { formatBalance, formatPrice } = useCurrency();
  const router = useRouter();
  const [activeType, setActiveType] = useState<CosmeticType>("COLOR");
  const [sortMode, setSortMode] = useState<ShopSortMode>("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewCosmeticId, setPreviewCosmeticId] = useState<string | null>(null);
  const [viewer, setViewer] = useState(initialState.viewer);
  const [cosmetics, setCosmetics] = useState(initialState.cosmetics);
  const [feedback, setFeedback] = useState<ShopMessageState>(null);
  const [pendingCosmeticId, setPendingCosmeticId] = useState<string | null>(null);
  const [pendingUnequipType, setPendingUnequipType] = useState<CosmeticType | null>(null);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewerBalance = viewer ? Number(viewer.availableBalance) : 0;
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const typeCosmetics = cosmetics.filter((cosmetic) => cosmetic.type === activeType);
  const visibleCosmetics = sortVisibleCosmetics(
    typeCosmetics.filter(
      (cosmetic) =>
        matchesCosmeticSearch(cosmetic, normalizedSearchQuery),
    ),
    sortMode,
    viewerBalance,
  );
  const ownedCount = viewer?.ownedCosmeticIds.length ?? 0;
  const equippedColor = cosmetics.find(
    (cosmetic) => cosmetic.type === "COLOR" && cosmetic.isEquipped,
  );
  const equippedFont = cosmetics.find(
    (cosmetic) => cosmetic.type === "FONT" && cosmetic.isEquipped,
  );
  const equippedDecoration = cosmetics.find(
    (cosmetic) => cosmetic.type === "DECORATION" && cosmetic.isEquipped,
  );
  const slotItems: Record<CosmeticType, CosmeticCatalogItem | undefined> = {
    COLOR: equippedColor,
    FONT: equippedFont,
    DECORATION: equippedDecoration,
  };
  const hasAnyEquipped = Boolean(equippedColor || equippedFont || equippedDecoration);
  const rarityRecommendations: RarityRecommendation[] = COSMETIC_RARITY_ORDER.map((rarity) => {
    const cosmetic = getRarityRecommendation(typeCosmetics, rarity, viewerBalance);

    if (!cosmetic) {
      return null;
    }

    return {
      rarity,
      cosmetic,
    };
  }).filter((value): value is RarityRecommendation => value !== null);
  const previewCosmetic =
    typeCosmetics.find((cosmetic) => cosmetic.id === previewCosmeticId) ??
    slotItems[activeType] ??
    visibleCosmetics[0] ??
    typeCosmetics[0] ??
    null;
  const previewAppearance = previewCosmetic
    ? getCosmeticPreviewAppearance(previewCosmetic, viewer)
    : extractUserAppearance(viewer);
  const previewRarity = previewCosmetic ? getCosmeticRarity(previewCosmetic.price) : null;
  const previewRarityAccent = previewRarity ? getRarityAccent(previewRarity) : null;
  const previewDisplayName = viewer?.name ?? "SafeLoot Player";
  const previewEmail = viewer?.email ?? "player@safeloot.net";
  const previewCountBase = typeCosmetics.length;

  function applyViewerState(nextViewer: CosmeticsViewerState, message: ShopMessageState) {
    setViewer(nextViewer);
    setCosmetics((currentCosmetics) => updateCosmeticsForViewer(currentCosmetics, nextViewer));
    setFeedback(message);
    window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
    router.refresh();
  }

  function handleBuy(cosmeticId: string) {
    setPendingCosmeticId(cosmeticId);
    setFeedback(null);

    startTransition(() => {
      void buyCosmeticAction(cosmeticId)
        .then((result) => {
          if (!result.ok || !result.viewer) {
            setFeedback({
              tone: "error",
              text: result.message ?? "Не удалось купить косметику.",
            });
            return;
          }

          applyViewerState(result.viewer, {
            tone: "success",
            text: result.message ?? "Косметика куплена.",
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Не удалось купить косметику.",
          });
        })
        .finally(() => {
          setPendingCosmeticId(null);
        });
    });
  }

  function handleEquip(cosmeticId: string) {
    setPendingCosmeticId(cosmeticId);
    setFeedback(null);

    startTransition(() => {
      void equipCosmeticAction(cosmeticId)
        .then((result) => {
          if (!result.ok || !result.viewer) {
            setFeedback({
              tone: "error",
              text: result.message ?? "Не удалось экипировать косметику.",
            });
            return;
          }

          applyViewerState(result.viewer, {
            tone: "success",
            text: result.message ?? "Косметика экипирована.",
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Не удалось экипировать косметику.",
          });
        })
        .finally(() => {
          setPendingCosmeticId(null);
        });
    });
  }

  function handleUnequip(cosmeticType: CosmeticType) {
    setPendingUnequipType(cosmeticType);
    setFeedback(null);

    startTransition(() => {
      void unequipCosmeticAction(cosmeticType)
        .then((result) => {
          if (!result.ok || !result.viewer) {
            setFeedback({
              tone: "error",
              text: result.message ?? "Не удалось снять косметику.",
            });
            return;
          }

          applyViewerState(result.viewer, {
            tone: "success",
            text: result.message ?? getUnequipSuccessMessage(cosmeticType),
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Не удалось снять косметику.",
          });
        })
        .finally(() => {
          setPendingUnequipType(null);
        });
    });
  }

  function handleResetAll() {
    setIsResettingAll(true);
    setFeedback(null);

    startTransition(() => {
      void clearActiveCosmeticsAction()
        .then((result) => {
          if (!result.ok || !result.viewer) {
            setFeedback({
              tone: "error",
              text: result.message ?? "Не удалось сбросить активную косметику.",
            });
            return;
          }

          applyViewerState(result.viewer, {
            tone: "success",
            text: result.message ?? "Активный косметический образ сброшен.",
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Не удалось сбросить активную косметику.",
          });
        })
        .finally(() => {
          setIsResettingAll(false);
        });
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(15,23,42,0.96))] p-6 shadow-[0_22px_64px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Текущий образ
        </p>

        {viewer ? (
          <>
            <div className="mt-5 flex items-center gap-4 rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
              <UserAvatar
                src={viewer.image}
                name={viewer.name}
                email={viewer.email}
                decoration={viewer.activeDecoration}
                className="h-[72px] w-[72px] shrink-0 border-white/10 bg-zinc-900/80 text-zinc-100"
                imageClassName="rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <CosmeticName
                  text={viewer.name}
                  appearance={viewer}
                  className="block truncate text-xl font-semibold text-white"
                />
                <p className="mt-1 truncate text-sm text-zinc-400">{viewer.email}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.4rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
                  Баланс
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatBalance(viewer.availableBalance)}
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4 text-sm text-zinc-300">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Владение
                </p>
                <p className="mt-2">Куплено предметов: <span className="font-semibold text-white">{ownedCount}</span></p>
                <p className="mt-2">Цвет: <span className="font-semibold text-white">{equippedColor?.name ?? "Не выбран"}</span></p>
                <p className="mt-2">Шрифт: <span className="font-semibold text-white">{equippedFont?.name ?? "Не выбран"}</span></p>
                <p className="mt-2">Рамка: <span className="font-semibold text-white">{equippedDecoration?.name ?? "Не выбрана"}</span></p>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4 text-sm text-zinc-300">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Быстрые слоты
                </p>
                {hasAnyEquipped ? (
                  <Button
                    type="button"
                    onClick={handleResetAll}
                    disabled={isPending || isResettingAll}
                    className="mt-3 h-10 w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold text-red-100 hover:bg-red-500/15"
                  >
                    {isResettingAll ? "Сбрасываем образ..." : "Снять всё сразу"}
                  </Button>
                ) : null}
                <div className="mt-3 grid gap-3">
                  {COSMETIC_TYPE_ORDER.map((type) => {
                    const slotItem = slotItems[type];
                    const isClearing = isPending && pendingUnequipType === type;

                    return (
                      <div
                        key={type}
                        className="rounded-[1.1rem] border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {COSMETIC_TYPE_LABELS[type]}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveType(type);
                              setPreviewCosmeticId(null);
                            }}
                            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200 transition hover:text-sky-100"
                          >
                            Открыть
                          </button>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-white">
                          {slotItem?.name ?? getSlotEmptyLabel(type)}
                        </p>

                        {slotItem ? (
                          <button
                            type="button"
                            onClick={() => handleUnequip(type)}
                            disabled={isPending || isClearing}
                            className={cn(
                              SHOP_ACTION_BUTTON_BASE_CLASS_NAME,
                              SHOP_SECONDARY_WIDE_BUTTON_CLASS_NAME,
                              "mt-3",
                            )}
                          >
                            {isClearing ? "Снимаем..." : "Снять"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-white/10 bg-white/5 p-5 text-sm leading-7 text-zinc-400">
            Каталог открыт всем, но покупать и экипировать косметику можно только после авторизации.
            <div className="mt-4">
              <Link
                href="/login?callbackUrl=/shop"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Войти и открыть магазин
              </Link>
            </div>
          </div>
        )}

        {feedback ? (
          <div
            className={cn(
              "mt-5 rounded-[1.35rem] border p-4 text-sm leading-7",
              feedback.tone === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/20 bg-red-500/10 text-red-100",
            )}
          >
            {feedback.text}
          </div>
        ) : null}
      </aside>

      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
        <div className="border-b border-white/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Каталог магазина
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {COSMETIC_TYPE_LABELS[activeType]}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                {getShopHeadline(activeType)}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-[520px] lg:items-end">
              <label className="w-full">
                <span className="sr-only">Поиск по косметике</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по названию, типу или значению"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-white/10"
                />
              </label>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {([
                  ["recommended", "Сначала нужное"],
                  ["price-asc", "Дешевле"],
                  ["price-desc", "Дороже"],
                  ["name", "По имени"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortMode(mode)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition",
                      sortMode === mode
                        ? "border-white/20 bg-white/12 text-white"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {COSMETIC_TYPE_ORDER.map((type) => {
              const isActive = type === activeType;
              const accent = getTypeAccent(type);
              const count = cosmetics.filter((cosmetic) => cosmetic.type === type).length;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setActiveType(type);
                    setPreviewCosmeticId(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? accent.tab
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span>{COSMETIC_TYPE_LABELS[type]}</span>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs text-inherit">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {rarityRecommendations.length > 0 ? (
          <section className="mt-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Подборка по редкости
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Быстрые рекомендации внутри текущей категории: от мягкого акцента до самых выразительных предметов.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Нажмите или наведите на карточку, чтобы обновить большой preview ниже.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {rarityRecommendations.map(({ rarity, cosmetic }) => {
                const rarityAccent = getRarityAccent(rarity);
                const isPreviewActive = previewCosmetic?.id === cosmetic.id;

                return (
                  <button
                    key={`${rarity}-${cosmetic.id}`}
                    type="button"
                    onClick={() => setPreviewCosmeticId(cosmetic.id)}
                    className={cn(
                      "rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5",
                      rarityAccent.card,
                      isPreviewActive
                        ? "ring-1 ring-white/20"
                        : "hover:border-white/20",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                        rarityAccent.pill,
                      )}
                    >
                      {COSMETIC_RARITY_LABELS[rarity]}
                    </span>
                    <p className="mt-3 text-base font-semibold text-white">{cosmetic.name}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {COSMETIC_RARITY_DESCRIPTIONS[rarity]}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="text-zinc-400">{COSMETIC_TYPE_LABELS[cosmetic.type]}</span>
                      <span className="font-semibold text-white">
                        {formatPrice(cosmetic.price)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Полный preview профиля
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Большой блок ниже показывает, как текущая карточка будет выглядеть на полноценной витрине продавца.
              </p>
            </div>
            {previewCosmeticId ? (
              <button
                type="button"
                onClick={() => setPreviewCosmeticId(null)}
                className="text-sm font-semibold text-sky-200 transition hover:text-sky-100"
              >
                Вернуть текущий образ
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            <ProfileHero
              eyebrow="Preview в магазине"
              displayName={previewDisplayName}
              avatarName={previewDisplayName}
              avatarSrc={viewer?.image ?? null}
              appearance={previewAppearance}
              roleBadge={
                <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-100">
                  SELLER VIEW
                </span>
              }
              details={
                <>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                    {previewEmail}
                  </span>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                    Витрина и отзывы SafeLoot
                  </span>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                    Видно в каталоге, чатах и профиле
                  </span>
                </>
              }
              aside={
                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Сейчас в фокусе
                  </p>
                  <p className="mt-3 text-xl font-semibold text-white">
                    {previewCosmetic?.name ?? "Текущий образ"}
                  </p>
                  {previewRarity && previewRarityAccent ? (
                    <span
                      className={cn(
                        "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                        previewRarityAccent.pill,
                      )}
                    >
                      {COSMETIC_RARITY_LABELS[previewRarity]}
                    </span>
                  ) : null}
                  <p className="mt-3 leading-6 text-zinc-300">
                    {previewRarity
                      ? COSMETIC_RARITY_DESCRIPTIONS[previewRarity]
                      : "Сейчас показан ваш текущий косметический образ без усиления карточкой магазина."}
                  </p>
                  {previewCosmetic ? (
                    <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Цена preview</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatPrice(previewCosmetic.price)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">
                        В preview подмешивается текущий образ пользователя и эффект выделенной карточки.
                      </p>
                    </div>
                  ) : null}
                </div>
              }
            />
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-zinc-400">
          <p>
            Найдено предметов: <span className="font-semibold text-white">{visibleCosmetics.length}</span>
            <span className="text-zinc-500"> / {previewCountBase}</span>
          </p>
          {normalizedSearchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="font-semibold text-sky-200 transition hover:text-sky-100"
            >
              Сбросить поиск
            </button>
          ) : null}
        </div>

        {visibleCosmetics.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleCosmetics.map((cosmetic) => {
              const accent = getTypeAccent(cosmetic.type);
              const rarity = getCosmeticRarity(cosmetic.price);
              const rarityAccent = getRarityAccent(rarity);
              const isMutating = isPending && pendingCosmeticId === cosmetic.id;
              const isAffordable = viewer ? cosmetic.price <= viewerBalance : false;

              return (
                <article
                  key={cosmetic.id}
                  onMouseEnter={() => setPreviewCosmeticId(cosmetic.id)}
                  onFocusCapture={() => setPreviewCosmeticId(cosmetic.id)}
                  className={cn(
                    "flex h-full flex-col rounded-[1.65rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition",
                    cosmetic.isEquipped
                      ? "border-sky-400/30"
                      : cosmetic.isOwned
                        ? "border-emerald-400/20"
                        : "border-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", accent.pill)}>
                          {COSMETIC_TYPE_LABELS[cosmetic.type]}
                        </span>
                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", rarityAccent.pill)}>
                          {COSMETIC_RARITY_LABELS[rarity]}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">
                        {cosmetic.name}
                      </h3>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/10 bg-black/20 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Цена</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {formatPrice(cosmetic.price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <CosmeticPreview cosmetic={cosmetic} viewer={viewer} />
                  </div>

                  <div className="mt-auto flex flex-col gap-3 pt-5">
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {cosmetic.isOwned ? (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                          Куплено
                        </span>
                      ) : null}
                      {cosmetic.isEquipped ? (
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-100">
                          Экипировано
                        </span>
                      ) : null}
                      {viewer && !cosmetic.isOwned && isAffordable ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-200">
                          Доступно сейчас
                        </span>
                      ) : null}
                      {viewer && !cosmetic.isOwned && !isAffordable ? (
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-100">
                          Не хватает баланса
                        </span>
                      ) : null}
                    </div>

                    {viewer ? (
                      cosmetic.isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleEquip(cosmetic.id)}
                          disabled={cosmetic.isEquipped || isPending || isMutating}
                          className={cn(
                            SHOP_ACTION_BUTTON_BASE_CLASS_NAME,
                            SHOP_SECONDARY_BUTTON_CLASS_NAME,
                          )}
                        >
                          {cosmetic.isEquipped
                            ? "Уже надето"
                            : isMutating
                              ? "Экипируем..."
                              : "Экипировать"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBuy(cosmetic.id)}
                          disabled={isPending || isMutating || !isAffordable}
                          className={cn(
                            SHOP_ACTION_BUTTON_BASE_CLASS_NAME,
                            SHOP_BUY_BUTTON_CLASS_NAME,
                          )}
                        >
                          {isMutating
                            ? "Покупаем..."
                            : isAffordable
                              ? "Купить"
                              : "Недостаточно"}
                        </button>
                      )
                    ) : (
                      <Link
                        href="/login?callbackUrl=/shop"
                        className={cn(
                          SHOP_ACTION_BUTTON_BASE_CLASS_NAME,
                          SHOP_SECONDARY_BUTTON_CLASS_NAME,
                        )}
                      >
                        Войти
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.04] px-6 py-10 text-center">
            <p className="text-lg font-semibold text-white">Ничего не найдено</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Попробуйте другой запрос или откройте соседний тип косметики, чтобы расширить выбор.
            </p>
            {normalizedSearchQuery ? (
              <Button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-5 rounded-2xl bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Очистить поиск
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}