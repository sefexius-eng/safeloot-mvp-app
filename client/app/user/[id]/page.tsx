import Link from "next/link";
import { OrderStatus, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  MarketplaceProductCard,
  type MarketplaceProductCardData,
} from "@/components/product/marketplace-product-card";
import { RatingStars } from "@/components/reviews/rating-stars";
import { UserAvatar } from "@/components/ui/user-avatar";
import { prisma } from "@/lib/prisma";

type SellerRank = "BRONZE" | "SILVER" | "GOLD";
const SELLER_ONLINE_WINDOW_MS = 15 * 60 * 1000;

interface PublicUserPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getRankLabel(rank: SellerRank) {
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

function getRankClassName(rank: SellerRank) {
  switch (rank) {
    case "BRONZE":
      return "border-amber-500/20 bg-amber-500/12 text-amber-200";
    case "SILVER":
      return "border-slate-400/20 bg-slate-300/12 text-slate-200";
    case "GOLD":
      return "border-yellow-500/20 bg-yellow-400/12 text-yellow-200";
    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function formatJoinedDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatAverageRating(value: number | null) {
  if (value === null) {
    return "Нет оценок";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatReviewDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function isSellerOnline(lastSeen?: Date | string | null) {
  if (!lastSeen) {
    return false;
  }

  const lastSeenTime = new Date(lastSeen).getTime();

  if (!Number.isFinite(lastSeenTime)) {
    return false;
  }

  return Date.now() - lastSeenTime <= SELLER_ONLINE_WINDOW_MS;
}

async function getPublicSellerProfile(id: string) {
  const seller = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      lastSeen: true,
      rank: true,
      createdAt: true,
      products: {
        where: {
          orders: {
            none: {
              status: {
                in: [
                  OrderStatus.PENDING,
                  OrderStatus.PAID,
                  OrderStatus.DELIVERED,
                  OrderStatus.DISPUTED,
                ],
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          images: true,
          price: true,
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
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      reviewsReceived: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!seller) {
    return null;
  }

  const reviewCount = seller.reviewsReceived.length;
  const averageRating =
    reviewCount > 0
      ? Math.round(
          (seller.reviewsReceived.reduce(
            (sum, review) => sum + review.rating,
            0,
          ) /
            reviewCount) *
            10,
        ) / 10
      : null;

  const reviewSummary = {
    averageRating,
    reviewCount,
  };

  const products = seller.products.map(
    (product) =>
      ({
        ...product,
        price: product.price.toFixed(8),
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          image: seller.image,
          lastSeen: seller.lastSeen.toISOString(),
          rank: seller.rank,
          reviewSummary,
        },
      }) satisfies MarketplaceProductCardData,
  );

  return {
    ...seller,
    averageRating,
    reviewCount,
    products,
  };
}

export default async function PublicUserPage({ params }: PublicUserPageProps) {
  const { id } = await params;
  const seller = await getPublicSellerProfile(id);

  if (!seller) {
    notFound();
  }

  const displayName = seller.name?.trim() || seller.email.split("@")[0];
  const sellerIsOnline = isSellerOnline(seller.lastSeen);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_30%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative shrink-0">
              <UserAvatar
                src={seller.image}
                name={displayName}
                email={seller.email}
                className="h-24 w-24 shrink-0 border-white/10 bg-zinc-900/80 text-2xl"
                imageClassName="rounded-full object-cover"
              />
              <span
                aria-label={sellerIsOnline ? "Продавец онлайн" : "Продавец не в сети"}
                title={sellerIsOnline ? "Продавец онлайн" : "Продавец не в сети"}
                className={[
                  "absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-950 text-[10px] shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
                  sellerIsOnline
                    ? "bg-emerald-500 text-emerald-950 shadow-[0_8px_20px_rgba(16,185,129,0.4)]"
                    : "bg-zinc-600 text-zinc-200",
                ].join(" ")}
              >
                ●
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
                Публичный профиль продавца
              </p>
              <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {displayName}
              </h1>
              <p className="mt-2 truncate text-sm text-zinc-400">{seller.email}</p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 font-medium ${getRankClassName(seller.rank)}`}
                >
                  Ранг: {getRankLabel(seller.rank)}
                </span>
                <span
                  className={[
                    "inline-flex rounded-full border px-3 py-1.5 font-medium",
                    sellerIsOnline
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-zinc-300",
                  ].join(" ")}
                >
                  {sellerIsOnline ? "Онлайн сейчас" : "Сейчас не в сети"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-300">
                  На площадке с {formatJoinedDate(seller.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-zinc-500">
              Средний рейтинг
            </p>
            <div className="mt-3 flex items-center gap-3">
              <RatingStars value={Math.round(seller.averageRating ?? 0)} size="lg" />
              <div>
                <p className="text-2xl font-semibold text-white">
                  {formatAverageRating(seller.averageRating)}
                </p>
                <p className="text-sm text-zinc-400">
                  {seller.reviewCount > 0
                    ? `${seller.reviewCount} отзывов`
                    : "Отзывов пока нет"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Витрина продавца
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Товары продавца
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Все доступные лоты продавца собраны в одной витрине. Отсюда можно перейти к карточке товара или открыть публичный профиль напрямую из каталога.
          </p>
        </div>

        {seller.products.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            У продавца пока нет активных лотов без текущих сделок.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {seller.products.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Репутация
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Отзывы покупателей
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Здесь отображаются отзывы, оставленные продавцу после эскроу-сделок.
          </p>
        </div>

        {seller.reviewsReceived.length === 0 ? (
          <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
            Пока никто не оставил отзывов этому продавцу.
          </div>
        ) : (
          <div className="space-y-4">
            {seller.reviewsReceived.map((review) => {
              const authorName = review.author.name?.trim() || review.author.email;

              return (
                <article
                  key={review.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.16)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        src={review.author.image}
                        name={authorName}
                        email={review.author.email}
                        className="h-12 w-12 shrink-0 border-white/10 bg-zinc-900/80"
                        imageClassName="rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {authorName}
                        </p>
                        <p className="truncate text-xs uppercase tracking-[0.16em] text-zinc-500">
                          Покупатель
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <RatingStars value={review.rating} size="sm" />
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {formatReviewDate(review.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-zinc-200">
                    {review.comment?.trim() || "Покупатель поставил оценку без текстового комментария."}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}