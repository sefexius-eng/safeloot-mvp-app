import Link from "next/link";

import {
  MarketplaceProductCard,
  type MarketplaceProductCardData,
} from "@/components/product/marketplace-product-card";
import { listProducts } from "@/lib/marketplace";
import { prisma } from "@/lib/prisma";

interface GameDirectoryItem {
  id: string;
  name: string;
  slug: string;
}

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
    return prisma.game.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
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

export default async function Home() {
  const [products, games] = await Promise.all([getProducts(), getGames()]);
  const groupedGames = groupGamesByInitial(games);
  const gameInitials = Object.keys(groupedGames).sort((left, right) =>
    left.localeCompare(right, "ru-RU"),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:gap-16 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(24,24,27,0.92),rgba(15,23,42,0.92))] shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur">
        <div className="grid gap-10 px-6 py-8 md:px-10 md:py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:px-14 lg:py-16">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-orange-700/15 bg-orange-700/8 px-4 py-2 text-xs font-semibold tracking-[0.3em] uppercase text-orange-800">
              Безопасные сделки для игровых товаров
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl md:leading-[1.02]">
                Покупайте и продавайте игровые товары без риска потерять деньги.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-zinc-300 md:text-lg">
                Escrow удерживает средства до подтверждения заказа. Продавец получает выплату только после завершения сделки, а покупатель сохраняет контроль на каждом этапе.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 hover:bg-orange-500">
                Начать покупать
              </button>
              <Link
                href="/sell"
                className="inline-flex rounded-2xl border border-white/10 bg-white/6 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Разместить товар
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                  Сделки
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">24/7</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Контроль статусов, чаты по заказу и прозрачное движение средств.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                  Баланс
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">USDT</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Разделение на доступный баланс и hold для безопасного клиринга.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                  Защита
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">Escrow</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Платформа удерживает оплату до успешного завершения заказа.
                </p>
              </div>
            </div>
          </div>

          <div className="relative rounded-[1.75rem] border border-white/10 bg-black/25 p-6 text-white shadow-[0_20px_65px_rgba(0,0,0,0.3)]">
            <div className="absolute -right-10 top-8 h-32 w-32 rounded-full bg-orange-500/25 blur-3xl" />
            <div className="absolute -left-6 bottom-8 h-24 w-24 rounded-full bg-cyan-400/20 blur-3xl" />

            <div className="relative space-y-6">
              <div>
                <p className="text-xs tracking-[0.28em] uppercase text-neutral-400">
                  Как это работает
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Деньги удерживаются, пока покупатель не подтвердит сделку.
                </h2>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-sm font-semibold text-white">1. Покупатель оплачивает заказ</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-300">
                    Средства списываются с доступного баланса и переходят под контроль платформы.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-sm font-semibold text-white">2. Продавец выполняет заказ</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-300">
                    Все детали и подтверждения фиксируются в заказе и внутреннем чате.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <p className="text-sm font-semibold text-white">3. Escrow выпускает средства</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-300">
                    После завершения сделки продавцу начисляется сумма за вычетом комиссии платформы.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Все игры
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Быстрый переход по каталогу
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Плотный каталог в духе FunPay: выберите игру и сразу перейдите к её категориям и товарам.
          </p>
        </div>

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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Активные предложения
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Актуальные товары маркетплейса
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Каталог на главной обновляется автоматически. Ниже выводятся реальные товары из базы вместе с категорией, игрой, ценой и рангом продавца.
          </p>
        </div>

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
