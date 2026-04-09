import Link from "next/link";

import { ProfilePageClient } from "@/app/profile/profile-page-client";
import {
  ProfileAchievementGrid,
  type ProfileAchievementItem,
} from "@/components/profile/profile-achievement-grid";
import { extractUserAppearance, USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileRoleBadge } from "@/components/profile/profile-role-badge";
import {
  ProfileTabs,
  type ProfileTabsProduct,
  type ProfileTabsReview,
} from "@/components/profile-tabs";
import { getAuthSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { mergeProfileBadgeIds } from "@/lib/profile-badges";
import { prisma } from "@/lib/prisma";
import { getSellerAutomaticBadgeDataBySellerId } from "@/lib/seller-achievements";
import { mapWithdrawalListItem } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getAuthSession();
  const sellerId = session?.user?.id?.trim() ?? "";
  const profileData = sellerId
    ? await Promise.all([
        prisma.user.findUnique({
          where: {
            id: sellerId,
          },
          select: {
            id: true,
            name: true,
            image: true,
            ...USER_APPEARANCE_SELECT,
            role: true,
            bannerUrl: true,
            badges: true,
            availableBalance: true,
            earnedAchievements: {
              select: {
                id: true,
                earnedAt: true,
                achievement: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    description: true,
                    iconUrl: true,
                    rarity: true,
                  },
                },
              },
              orderBy: {
                earnedAt: "desc",
              },
            },
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
                    ...USER_APPEARANCE_SELECT,
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
        getSellerAutomaticBadgeDataBySellerId(sellerId),
      ])
    : null;

  const sellerProfile = profileData?.[0] ?? null;
  const withdrawals = profileData?.[1] ?? [];
  const automaticBadgeData = profileData?.[2] ?? null;
  const sellerDisplayName =
    sellerProfile?.name?.trim() ||
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Продавец";
  const effectiveBadges = mergeProfileBadgeIds(
    sellerProfile?.badges,
    automaticBadgeData?.automaticBadgeIds,
  );

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
  const profileAchievements = sellerProfile
    ? sellerProfile.earnedAchievements.map(
        (entry) =>
          ({
            id: entry.id,
            code: entry.achievement.code,
            title: entry.achievement.title,
            description: entry.achievement.description,
            iconUrl: entry.achievement.iconUrl,
            rarity: entry.achievement.rarity,
            earnedAt: entry.earnedAt.toISOString(),
          }) satisfies ProfileAchievementItem,
      )
    : [];
  const currentProfileRole = sellerProfile?.role ?? session?.user?.role;
  const shouldShowProfileRoleBadge =
    currentProfileRole && currentProfileRole !== "USER"
      ? true
      : profileProducts.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <ProfileHero
        eyebrow="Seller Dashboard"
        displayName={sellerDisplayName}
        avatarName={sellerDisplayName}
        avatarSrc={sellerProfile?.image ?? session?.user?.image ?? null}
        appearance={extractUserAppearance(sellerProfile)}
        bannerUrl={sellerProfile?.bannerUrl ?? null}
        roleBadge={
          shouldShowProfileRoleBadge ? (
            <ProfileRoleBadge role={currentProfileRole} />
          ) : null
        }
        badges={effectiveBadges}
        details={
          <>
            {session?.user?.email ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
                Аккаунт: <span className="ml-2 font-semibold text-white">{session.user.email}</span>
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Лотов: <span className="ml-2 font-semibold text-white">{profileProducts.length}</span>
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Отзывов: <span className="ml-2 font-semibold text-white">{profileReviews.length}</span>
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Ачивок: <span className="ml-2 font-semibold text-white">{profileAchievements.length}</span>
            </span>
          </>
        }
        actions={
          <>
            {sellerProfile?.id ? (
              <Link
                href={`/user/${sellerProfile.id}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Посмотреть мою витрину
              </Link>
            ) : null}
            <Link
              href="/orders"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#00C853]/25 bg-[#00C853]/10 px-5 text-sm font-semibold text-[#c8ffd9] transition hover:-translate-y-0.5 hover:bg-[#00C853]/16"
            >
              Мои заказы
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 px-5 text-sm font-semibold text-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-500/20"
            >
              Магазин косметики
            </Link>
            <Link
              href="/profile/settings"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-500"
            >
              Настроить профиль
            </Link>
          </>
        }
      />

      <ProfilePageClient
        isAuthenticated={Boolean(sellerId)}
        availableBalance={formatCurrency(Number(sellerProfile?.availableBalance ?? 0))}
        withdrawals={withdrawals.map(mapWithdrawalListItem)}
      />

      <ProfileAchievementGrid
        eyebrow="Achievement Board"
        title="Мои достижения"
        description="Здесь собираются все полученные ачивки за покупки, отзывы и успешные продажи на площадке."
        achievements={profileAchievements}
        emptyTitle="Пока достижений нет"
        emptyDescription="Совершите первую покупку, оставьте отзыв или завершите продажу, чтобы открыть первые достижения."
      />

      {sellerProfile ? (
        <ProfileTabs
          products={profileProducts}
          reviews={profileReviews}
          sellerId={sellerProfile.id}
          currentUserId={session?.user?.id ?? sellerProfile.id}
          currentUserRole={(session?.user?.role ?? currentProfileRole) ?? null}
        />
      ) : null}
    </main>
  );
}