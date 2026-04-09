import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Каталог игр и предложений | SafeLoot",
  description:
    "Каталог SafeLoot: выбирайте игру, переходите в нужную категорию и просматривайте актуальные предложения продавцов.",
};

async function getCatalogGames() {
  return prisma.game.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      categories: {
        select: {
          id: true,
        },
      },
      products: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      },
    },
  });
}

export default async function CatalogPage() {
  const games = await getCatalogGames();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_34%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          SafeLoot Catalog
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Каталог игр и торговых категорий
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
          Быстрый вход в каталог SafeLoot: выбирайте игру, переходите в нужный раздел и смотрите активные предложения с безопасной Escrow-сделкой.
        </p>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Навигация по маркетплейсу
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Все игровые разделы
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Доступно игр: {games.length}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="group rounded-[1.9rem] border border-white/10 bg-white/5 p-6 shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-1 hover:bg-white/8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] uppercase text-zinc-500">
                    Игра
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white transition group-hover:text-orange-200">
                    {game.name}
                  </h3>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-zinc-200">
                  {game.name.slice(0, 1).toUpperCase()}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1.25rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Категории
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {game.categories.length}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Активные лоты
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {game.products.length}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-zinc-400">
                Открыть все предложения по {game.name} и перейти к нужной категории внутри каталога.
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}