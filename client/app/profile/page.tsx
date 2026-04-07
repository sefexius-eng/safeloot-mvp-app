import Link from "next/link";

import { ProfilePageClient } from "@/app/profile/profile-page-client";
import {
  ProfileTabs,
  type ProfileTabsProduct,
  type ProfileTabsReview,
} from "@/components/profile-tabs";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerReviewSummaryBySellerId } from "@/lib/review-summary";
import { mapWithdrawalListItem } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";

function getOrderStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Ожидает оплаты";
    case "PAID":
      return "Оплачен";
    case "DELIVERED":
      return "Передан";
    case "COMPLETED":
      return "Завершен";
    case "DISPUTED":
      return "Спор";
    case "REFUNDED":
      return "Возврат покупателю";
    case "CANCELLED":
      return "Отменен";
    default:
      return status;
  }
}

function getOrderStatusClassName(status: string) {
  switch (status) {
    case "PAID":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200";
    case "COMPLETED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "DISPUTED":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    case "REFUNDED":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "CANCELLED":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
}

function formatAmount(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export default async function ProfilePage() {
  const session = await getAuthSession();
  const sellerId = session?.user?.id?.trim() ?? "";
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Продавец";
  const profileData = sellerId
    ? await Promise.all([
        prisma.order.findMany({
          where: {
            sellerId,
          },
          include: {
            product: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.user.findUnique({
          where: {
            id: sellerId,
          },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            rank: true,
            availableBalance: true,
            products: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                isActive: true,
                sellerId: true,
                createdAt: true,
                updatedAt: true,
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
                sellerReply: true,
                replyCreatedAt: true,
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
        }),
        prisma.withdrawal.findMany({
          where: {
            userId: sellerId,
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        getSellerReviewSummaryBySellerId(sellerId),
      ])
    : null;

  const sales = profileData?.[0] ?? [];
  const sellerProfile = profileData?.[1] ?? null;
  const withdrawals = profileData?.[2] ?? [];
  const sellerReviewSummary = profileData?.[3] ?? {
    averageRating: null,
    reviewCount: 0,
  };

  const profileProducts = sellerProfile
    ? sellerProfile.products.map(
        (product) =>
          ({
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price.toFixed(2),
            isActive: product.isActive,
            sellerId: product.sellerId,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
            game: product.game,
            category: product.category,
            seller: {
              id: sellerProfile.id,
              email: sellerProfile.email,
              name: sellerProfile.name,
              image: sellerProfile.image,
              rank: sellerProfile.rank,
              reviewSummary: sellerReviewSummary,
            },
          }) satisfies ProfileTabsProduct,
      )
    : [];

  const profileReviews = sellerProfile
    ? sellerProfile.reviewsReceived.map(
        (review) =>
          ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            sellerReply: review.sellerReply,
            createdAt: review.createdAt.toISOString(),
            replyCreatedAt: review.replyCreatedAt?.toISOString() ?? null,
            author: review.author,
          }) satisfies ProfileTabsReview,
      )
    : [];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section>
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          Seller Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Личный кабинет продавца
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
          Здесь собраны ваши текущие балансы и все размещенные товары. Используйте кабинет для контроля средств в escrow и управления активными предложениями.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            Аккаунт: <span className="ml-2 font-semibold text-white">{displayName}</span>
          </div>
          {sellerProfile?.id ? (
            <Link
              href={`/user/${sellerProfile.id}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              👀 Посмотреть мою витрину
            </Link>
          ) : null}
          <Link
            href="/profile/settings"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-500"
          >
            Настроить профиль
          </Link>
        </div>
      </section>

      <ProfilePageClient
        isAuthenticated={Boolean(sellerId)}
        availableBalance={sellerProfile?.availableBalance.toFixed(2) ?? "0"}
        withdrawals={withdrawals.map(mapWithdrawalListItem)}
      />

      {sellerProfile ? (
        <ProfileTabs
          products={profileProducts}
          reviews={profileReviews}
        />
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Seller Activity
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Мои продажи (Активные сделки)
            </h2>
          </div>

          {session?.user?.email ? (
            <div className="text-sm text-zinc-400">
              Аккаунт продавца: <span className="font-medium text-zinc-200">{session.user.email}</span>
            </div>
          ) : null}
        </div>

        {!sellerId ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
            После входа здесь появятся заказы покупателей и ссылка на чат по каждой сделке.
          </div>
        ) : sales.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
            У вас пока нет продаж. Как только покупатель оформит заказ на ваш товар, сделка появится в этом разделе.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {sales.map((order) => (
              <article
                key={order.id}
                className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getOrderStatusClassName(order.status)}`}
                    >
                      {getOrderStatusLabel(order.status)}
                    </span>
                    <span className="text-sm text-zinc-500">Заказ #{order.id}</span>
                  </div>

                  <div>
                    <p className="text-lg font-semibold text-white">
                      {order.product.title}
                    </p>
                    <p className="mt-1 text-sm leading-7 text-zinc-400">
                      Покупатель: <span className="text-zinc-300">{order.buyerId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 md:items-end">
                  <div className="text-sm text-zinc-400">
                    Сумма сделки: <span className="font-semibold text-white">{formatAmount(order.price)} USDT</span>
                  </div>
                  <Link
                    href={`/order/${order.id}`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-500"
                  >
                    Открыть чат сделки
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}