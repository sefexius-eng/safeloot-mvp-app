import Link from "next/link";

import { BuyProductDialog } from "@/components/product/buy-product-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { prisma } from "@/lib/prisma";

type SellerRank = "BRONZE" | "SILVER" | "GOLD";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ProductDetail {
  id: string;
  title: string;
  description: string;
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
    rank: SellerRank;
  };
}

async function getProduct(id: string): Promise<ProductDetail | null> {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id,
      },
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
    });

    if (!product) {
      return null;
    }

    return {
      ...product,
      price: product.price.toFixed(8),
    };
  } catch (error) {
    console.error("[PRODUCT_DETAIL_ERROR]", error);
    return null;
  }
}

const rankStyles: Record<
  SellerRank,
  {
    label: string;
    badgeClassName: string;
    iconClassName: string;
  }
> = {
  BRONZE: {
    label: "Бронза",
    badgeClassName: "border-amber-500/20 bg-amber-500/12 text-amber-200",
    iconClassName: "bg-amber-700 text-amber-50",
  },
  SILVER: {
    label: "Серебро",
    badgeClassName: "border-slate-400/20 bg-slate-300/12 text-slate-200",
    iconClassName: "bg-slate-500 text-white",
  },
  GOLD: {
    label: "Золото",
    badgeClassName: "border-yellow-500/20 bg-yellow-400/12 text-yellow-200",
    iconClassName: "bg-yellow-500 text-yellow-950",
  },
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="w-full rounded-[2rem] border border-white/10 bg-zinc-900/80 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-12">
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Ошибка загрузки
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Товар не найден
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">
            Возможно, товар был удален или ссылка устарела. Вернитесь на главную страницу и выберите другое активное предложение.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex rounded-2xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
            >
              Вернуться на главную
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const sellerName = product.seller.name?.trim() || product.seller.email;
  const rankStyle = rankStyles[product.seller.rank];
  const categoryLabel = product.category.name;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px] lg:items-start">
        <article className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur md:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-zinc-400">
              Карточка товара
            </span>
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-orange-200">
              {categoryLabel}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
              {product.title}
            </h1>
            <p className="max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">
              {product.description}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                Игра
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {product.game.name}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                Оплата
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Escrow резервирует средства
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                Идентификатор
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                #{product.id}
              </p>
            </div>
          </div>
        </article>

        <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(15,23,42,0.96))] p-6 text-white shadow-[0_22px_58px_rgba(0,0,0,0.28)] lg:sticky lg:top-28 lg:p-7">
          <div className="space-y-6">
            <div>
              <p className="text-xs tracking-[0.28em] uppercase text-zinc-500">
                Цена сделки
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
                {product.price} USDT
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/8 p-4">
              <p className="text-xs tracking-[0.24em] uppercase text-zinc-500">
                Продавец
              </p>
              <div className="mt-4 flex items-start gap-4">
                <UserAvatar
                  src={product.seller.image}
                  name={sellerName}
                  email={product.seller.email}
                  className="h-12 w-12 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-semibold text-white">
                    {sellerName}
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-400">{product.seller.email}</p>
                  <div
                    className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${rankStyle.badgeClassName}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${rankStyle.iconClassName}`}
                    >
                      {rankStyle.label.slice(0, 1)}
                    </span>
                    Ранг: {rankStyle.label}
                  </div>
                </div>
              </div>
            </div>

            <BuyProductDialog
              product={{
                id: product.id,
                title: product.title,
                price: product.price,
              }}
            />

            <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">
                Гарантия безопасной сделки
              </p>
              <p className="mt-2 text-sm leading-7 text-neutral-300">
                Деньги не уходят продавцу сразу. Система резервирует оплату и выпускает средства только после того, как вы получите товар или подтвердите выполнение услуги.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}