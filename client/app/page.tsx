import Link from "next/link";

import { UserAvatar } from "@/components/ui/user-avatar";
import { prisma } from "@/lib/prisma";

interface ProductCard {
  id: string;
  title: string;
  price: string;
  game: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
    gameId: string;
  };
  seller: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    rank: "BRONZE" | "SILVER" | "GOLD";
  };
}

async function getProducts(): Promise<ProductCard[]> {
  try {
    const products = await prisma.product.findMany({
      include: {
        game: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            gameId: true,
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            rank: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return products.map((product) => ({
      ...product,
      price: product.price.toFixed(8),
    }));
  } catch (error) {
    console.error("[HOME_PRODUCTS_ERROR]", error);
    return [];
  }
}

function getRankLabel(rank: ProductCard["seller"]["rank"]) {
  switch (rank) {
    case "BRONZE":
      return "Бронза";
    case "SILVER":
      return "Серебро";
    case "GOLD":
      return "Золото";
    default:
      return rank;
  }
}

function getRankClassName(rank: ProductCard["seller"]["rank"]) {
  switch (rank) {
    case "BRONZE":
      return "border-amber-700/20 bg-amber-600/10 text-amber-900";
    case "SILVER":
      return "border-slate-500/20 bg-slate-400/12 text-slate-800";
    case "GOLD":
      return "border-yellow-500/20 bg-yellow-400/12 text-yellow-900";
    default:
      return "border-black/8 bg-black/4 text-neutral-700";
  }
}

function getSellerDisplayName(seller: ProductCard["seller"]) {
  return seller.name?.trim() || seller.email;
}

export default async function Home() {
  const products = await getProducts();

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
              Активные предложения
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Актуальные товары маркетплейса
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Каталог на главной обновляется автоматически. Ниже выводятся реальные товары из базы вместе с типом, игрой, ценой и рангом продавца.
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
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_20px_46px_rgba(0,0,0,0.26)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                            {product.category.name}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getRankClassName(product.seller.rank)}`}
                      >
                        {getRankLabel(product.seller.rank)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-white">
                        {product.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Игра: {product.game.name}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] bg-black/40 px-4 py-3 text-right text-white shadow-[0_12px_26px_rgba(0,0,0,0.24)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Цена
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight">
                      {product.price} USDT
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      src={product.seller.image}
                      name={getSellerDisplayName(product.seller)}
                      email={product.seller.email}
                      className="h-6 w-6 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-zinc-500">
                        Продавец
                      </p>
                      <p className="truncate text-sm font-semibold text-white">
                        {getSellerDisplayName(product.seller)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-white group-hover:text-orange-400">
                    Открыть карточку
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
