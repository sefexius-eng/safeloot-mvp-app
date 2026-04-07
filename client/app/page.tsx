import Image from "next/image";
import Link from "next/link";

import {
  MarketplaceProductCard,
  type MarketplaceProductCardData,
} from "@/components/product/marketplace-product-card";
import catalogSeedData from "@/lib/catalog-seed-data.json";
import { listProducts } from "@/lib/marketplace";
import { prisma } from "@/lib/prisma";

interface GameDirectoryItem {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
}

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?q=80&w=1200&auto=format&fit=crop";
const POPULAR_GAME_SLUGS = catalogSeedData.popularGames.map((game) => game.slug);
const GAME_POSTER_BACKGROUNDS = [
  "linear-gradient(165deg, rgba(249,115,22,0.84), rgba(244,63,94,0.32) 44%, rgba(9,9,11,0.96))",
  "linear-gradient(165deg, rgba(14,165,233,0.84), rgba(37,99,235,0.30) 46%, rgba(2,6,23,0.96))",
  "linear-gradient(165deg, rgba(168,85,247,0.78), rgba(236,72,153,0.30) 44%, rgba(9,9,11,0.96))",
  "linear-gradient(165deg, rgba(16,185,129,0.82), rgba(6,182,212,0.28) 46%, rgba(3,7,18,0.96))",
  "linear-gradient(165deg, rgba(250,204,21,0.78), rgba(234,88,12,0.30) 42%, rgba(17,24,39,0.96))",
];

async function getProducts(): Promise<MarketplaceProductCardData[]> {
  try {
    return await listProducts();
  } catch (error) {
    console.error("[HOME_PRODUCTS_ERROR]", error);
    return [];
  }
}

async function getGames(): Promise<GameDirectoryItem[]> {
  try {
    const games = await prisma.game.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return games.map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      imageUrl: game.imageUrl,
      productCount: game._count.products,
    }));
  } catch (error) {
    console.error("[HOME_GAMES_ERROR]", error);
    return [];
  }
}

function groupGamesByInitial(games: GameDirectoryItem[]) {
  return games.reduce<Record<string, GameDirectoryItem[]>>((accumulator, game) => {
    const initial = game.name.slice(0, 1).toUpperCase() || "#";

    if (!accumulator[initial]) {
      accumulator[initial] = [];
    }

    accumulator[initial].push(game);
    return accumulator;
  }, {});
}

function getPopularGames(games: GameDirectoryItem[]) {
  const popularGamesOrder = new Map(
    POPULAR_GAME_SLUGS.map((slug, index) => [slug, index]),
  );

  return [...games]
    .sort((left, right) => {
      const leftOrder = popularGamesOrder.get(left.slug);
      const rightOrder = popularGamesOrder.get(right.slug);

      if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
      }

      if (leftOrder !== undefined) {
        return -1;
      }

      if (rightOrder !== undefined) {
        return 1;
      }

      if (right.productCount !== left.productCount) {
        return right.productCount - left.productCount;
      }

      return left.name.localeCompare(right.name, "ru-RU");
    })
    .slice(0, 8);
}

function getGamePosterBackground(slug: string) {
  const hash = Array.from(slug).reduce(
    (accumulator, symbol) => accumulator + symbol.charCodeAt(0),
    0,
  );

  return GAME_POSTER_BACKGROUNDS[hash % GAME_POSTER_BACKGROUNDS.length];
}

export default async function Home() {
  const [products, games] = await Promise.all([getProducts(), getGames()]);
  const groupedGames = groupGamesByInitial(games);
  const gameInitials = Object.keys(groupedGames).sort((left, right) =>
    left.localeCompare(right, "ru-RU"),
  );
  const popularGames = getPopularGames(games);
  const featuredCatalogHref = popularGames[0]
    ? `/games/${popularGames[0].slug}`
    : "#popular-games";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:gap-16 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_36%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(15,23,42,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur">
        <div className="grid gap-10 px-6 py-8 md:grid-cols-2 md:items-center md:px-10 md:py-12 lg:px-14 lg:py-16">
          <div>
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.02]">
                Покупайте и продавайте игровые товары без риска потерять деньги.
              </h1>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={featuredCatalogHref}
                className="inline-flex rounded-2xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 hover:bg-orange-500"
              >
                Смотреть каталог
              </Link>
              <Link
                href="/sell"
                className="inline-flex rounded-2xl border border-white/10 bg-white/6 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Разместить товар
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:rounded-[1.5rem] md:p-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 md:text-xs md:tracking-[0.24em]">
                  Сделки
                </p>
                <p className="mt-2 text-base font-semibold text-white md:mt-3 md:text-2xl">24/7</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:rounded-[1.5rem] md:p-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 md:text-xs md:tracking-[0.24em]">
                  Баланс
                </p>
                <p className="mt-2 text-base font-semibold text-white md:mt-3 md:text-2xl">USDT</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:rounded-[1.5rem] md:p-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 md:text-xs md:tracking-[0.24em]">
                  Защита
                </p>
                <p className="mt-2 text-base font-semibold text-white md:mt-3 md:text-2xl">Escrow</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -right-6 top-6 h-36 w-36 rounded-full bg-orange-500/25 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -left-6 bottom-10 h-28 w-28 rounded-full bg-sky-400/20 blur-3xl animate-pulse" />

            <div className="group relative mx-auto min-h-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 shadow-[0_26px_90px_rgba(0,0,0,0.34)] transition-all duration-500 hover:-translate-y-2">
              <Image
                src={HERO_IMAGE_URL}
                alt="Неоновый геймпад и игровое рабочее место"
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.12),rgba(9,9,11,0.22)_45%,rgba(9,9,11,0.86))]" />

              <div className="absolute right-4 top-4 rounded-[1.35rem] border border-white/10 bg-black/35 px-4 py-3 text-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Каталог</p>
                <p className="mt-2 text-2xl font-semibold">{games.length}</p>
              </div>

              <div className="absolute bottom-4 left-4 rounded-[1.35rem] border border-white/10 bg-black/35 px-4 py-3 text-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Escrow Shield</p>
                <p className="mt-2 text-lg font-semibold">Защищённая оплата</p>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                <div className="max-w-lg rounded-[1.75rem] border border-white/10 bg-black/35 p-5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/90">
                    Gaming Marketplace
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="popular-games" className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Постеры игровых витрин
        </h2>

        {popularGames.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            Пока нет игр для витрины популярных разделов.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {popularGames.map((game) => {
              const fallbackLetter = game.name.slice(0, 1).toUpperCase() || "G";

              return (
                <Link
                  key={game.id}
                  href={`/games/${game.slug}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-900/80 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:scale-[1.03]"
                >
                  {game.imageUrl?.trim() ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                      style={{
                        backgroundImage: `url(${game.imageUrl})`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 transition duration-500 group-hover:scale-105"
                      style={{
                        background: getGamePosterBackground(game.slug),
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.1),rgba(9,9,11,0.3)_45%,rgba(9,9,11,0.92))]" />

                  <div className="relative flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur">
                        {game.productCount > 0 ? `${game.productCount} офферов` : "Каталог"}
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur">
                        {fallbackLetter}
                      </span>
                    </div>

                    <div>
                      <p className="text-xl font-bold tracking-tight text-white md:text-2xl">
                        {game.name}
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-200/85">
                        Перейти к товарам и категориям
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Каталог по алфавиту
        </h2>

        {games.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            Каталог игр ещё не заполнен. Выполните seed через /api/seed или npm run seed:catalog.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gameInitials.map((initial) => (
              <section
                key={initial}
                className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <span className="text-lg font-semibold text-white">{initial}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {groupedGames[initial].length} игр
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {groupedGames[initial].map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.slug}`}
                      className="truncate rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/10 hover:bg-white/6 hover:text-white"
                    >
                      {game.name}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Актуальные товары маркетплейса
        </h2>

        {products.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-12 text-center shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Каталог пока пуст
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Пока нет активных предложений. Станьте первым продавцом!
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              Разместите первый товар через форму публикации, и он сразу появится на главной странице в этой витрине.
            </p>
            <div className="mt-6">
              <Link
                href="/sell"
                className="inline-flex rounded-2xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Добавить первый товар
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
