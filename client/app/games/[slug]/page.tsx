import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogFilters } from "@/components/catalog-filters";
import {
  MarketplaceProductCard,
  type MarketplaceProductCardData,
} from "@/components/product/marketplace-product-card";
import { prisma } from "@/lib/prisma";
import {
  getSellerReviewSummary,
  getSellerReviewSummaryMap,
} from "@/lib/review-summary";

interface GameCatalogPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    category?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    online?: string;
  }>;
}

const SELLER_ONLINE_WINDOW_MS = 5 * 60 * 1000;

function normalizeSearchText(value?: string) {
  return value?.trim() ?? "";
}

function parsePriceFilter(value?: string) {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return new Prisma.Decimal(numericValue.toString());
}

function getProductOrderBy(sort?: string) {
  if (sort === "price_asc") {
    return {
      price: "asc" as const,
    };
  }

  if (sort === "price_desc") {
    return {
      price: "desc" as const,
    };
  }

  return {
    createdAt: "desc" as const,
  };
}

async function getGameCatalog(
  slug: string,
  search: {
    category?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    online?: string;
  },
) {
  const game = await prisma.game.findUnique({
    where: {
      slug,
    },
    include: {
      categories: {
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!game) {
    return null;
  }

  const activeCategory =
    game.categories.find((category) => category.slug === search.category) ?? null;

  const minPrice = parsePriceFilter(search.minPrice);
  const maxPrice = parsePriceFilter(search.maxPrice);
  const isOnlineOnly = search.online === "true";

  const products = await prisma.product.findMany({
    where: {
      gameId: game.id,
      ...(activeCategory
        ? {
            categoryId: activeCategory.id,
          }
        : {}),
      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice ? { gte: minPrice } : {}),
              ...(maxPrice ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(isOnlineOnly
        ? {
            seller: {
              lastSeen: {
                gte: new Date(Date.now() - SELLER_ONLINE_WINDOW_MS),
              },
            },
          }
        : {}),
    },
    include: {
      game: true,
      category: true,
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          lastSeen: true,
          role: true,
          rank: true,
        },
      },
    },
    orderBy: getProductOrderBy(search.sort),
  });

  const reviewSummaryMap = await getSellerReviewSummaryMap(
    products.map((product) => product.seller.id),
  );

  return {
    game,
    activeCategorySlug: activeCategory?.slug ?? null,
    products: products.map((product) => ({
      ...product,
      price: product.price.toFixed(8),
      seller: {
        ...product.seller,
        lastSeen: product.seller.lastSeen.toISOString(),
        reviewSummary: getSellerReviewSummary(reviewSummaryMap, product.seller.id),
      },
    })) satisfies MarketplaceProductCardData[],
  };
}

export async function generateMetadata({ params }: GameCatalogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await prisma.game.findUnique({
    where: {
      slug,
    },
    select: {
      name: true,
    },
  });

  if (!game) {
    return {
      title: "Игра не найдена | SafeLoot",
    };
  }

  return {
    title: `${game.name} | SafeLoot`,
    description: `Каталог товаров и услуг по игре ${game.name}.`,
  };
}

export default async function GameCatalogPage({
  params,
  searchParams,
}: GameCatalogPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const catalog = await getGameCatalog(slug, resolvedSearchParams);

  if (!catalog) {
    notFound();
  }

  const gameSlug = catalog.game.slug;

  function buildCategoryHref(categorySlug?: string) {
    const nextParams = new URLSearchParams();

    if (categorySlug) {
      nextParams.set("category", categorySlug);
    }

    if (resolvedSearchParams.sort && resolvedSearchParams.sort !== "newest") {
      nextParams.set("sort", resolvedSearchParams.sort);
    }

    if (resolvedSearchParams.minPrice) {
      nextParams.set("minPrice", resolvedSearchParams.minPrice);
    }

    if (resolvedSearchParams.maxPrice) {
      nextParams.set("maxPrice", resolvedSearchParams.maxPrice);
    }

    if (resolvedSearchParams.online === "true") {
      nextParams.set("online", "true");
    }

    const nextQuery = nextParams.toString();

    return nextQuery ? `/games/${gameSlug}?${nextQuery}` : `/games/${gameSlug}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_34%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          Game Catalog
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          {catalog.game.name}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
          Витрина в стиле FunPay: выберите нужную категорию и просматривайте актуальные предложения по этой игре.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 overflow-x-auto pb-1">
          <Link
            href={buildCategoryHref()}
            className={[
              "inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition",
              !catalog.activeCategorySlug
                ? "border-orange-500/30 bg-orange-500/12 text-orange-100"
                : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
            ].join(" ")}
          >
            Все категории
          </Link>

          {catalog.game.categories.map((categoryItem) => (
            <Link
              key={categoryItem.id}
              href={buildCategoryHref(categoryItem.slug)}
              className={[
                "inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition",
                catalog.activeCategorySlug === categoryItem.slug
                  ? "border-orange-500/30 bg-orange-500/12 text-orange-100"
                  : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
              ].join(" ")}
            >
              {categoryItem.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <CatalogFilters />

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Каталог игры
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {catalog.activeCategorySlug
                ? `Предложения: ${catalog.game.categories.find((item) => item.slug === catalog.activeCategorySlug)?.name ?? catalog.game.name}`
                : `Все предложения по ${catalog.game.name}`}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Всего найдено товаров: {catalog.products.length}
          </p>
        </div>

        {catalog.products.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-12 text-center shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Предложений пока нет
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Для этой категории товары ещё не опубликованы.
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              Вы можете стать первым продавцом и разместить своё предложение в этой игре.
            </p>
            <div className="mt-6">
              <Link
                href="/sell"
                className="inline-flex rounded-2xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Разместить товар
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.products.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}