import { OrderStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import CensoredText from "@/components/censored-text";
import { ProfileHero } from "@/components/profile/profile-hero";
import { PublicProfileMessageButton } from "@/components/profile/public-profile-message-button";
import { ProfileRoleBadge } from "@/components/profile/profile-role-badge";
import {
  MarketplaceProductCard,
  type MarketplaceProductCardData,
} from "@/components/product/marketplace-product-card";
import {
  SellerReviewCard,
  type SellerReviewCardData,
} from "@/components/reviews/seller-review-card";
import {
  SellerStarScale,
  formatSellerAverageRating,
  formatSellerReviewCount,
} from "@/components/reviews/seller-star-scale";
import {
  UserPresenceDot,
  UserPresencePill,
} from "@/components/ui/user-presence-status";
import { extractUserAppearance, USER_APPEARANCE_SELECT } from "@/lib/cosmetics";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { mergeProfileBadgeIds } from "@/lib/profile-badges";
import { prisma } from "@/lib/prisma";
import { getSellerAutomaticBadgeDataBySellerId } from "@/lib/seller-achievements";

export const dynamic = 'force-dynamic';

type SellerRank = "BRONZE" | "SILVER" | "GOLD";

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

async function getPublicSellerProfile(id: string) {
  const seller = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      image: true,
      ...USER_APPEARANCE_SELECT,
      bannerUrl: true,
      badges: true,
      lastSeen: true,
      role: true,
      rank: true,
      createdAt: true,
      products: {
        where: {
          isActive: true,
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
          sellerReply: true,
          replyCreatedAt: true,
          createdAt: true,
          author: {
            select: {
              id: true,
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
  });

  if (!seller) {
    return null;
  }

  const automaticBadgeData = await getSellerAutomaticBadgeDataBySellerId(
    seller.id,
    seller.badges,
  );
  const reviewCount = automaticBadgeData.metrics.reviewCount;
  const averageRating = automaticBadgeData.metrics.averageRating;

  const reviewSummary = {
    averageRating,
    reviewCount,
  };

  const products = seller.products.map(
    (product) =>
      ({
        ...product,
        price: product.price.toFixed(2),
        seller: {
          id: seller.id,
          name: seller.name,
          image: seller.image,
          activeColor: seller.activeColor,
          activeFont: seller.activeFont,
          activeDecoration: seller.activeDecoration,
          lastSeen: seller.lastSeen.toISOString(),
          role: seller.role,
          rank: seller.rank,
          reviewSummary,
        },
      }) satisfies MarketplaceProductCardData,
  );

  return {
    ...seller,
    badges: mergeProfileBadgeIds(
      seller.badges,
      automaticBadgeData.automaticBadgeIds,
    ),
    averageRating,
    reviewCount,
    products,
  };
}

export default async function PublicUserPage({ params }: PublicUserPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentSessionUser(await getAuthSession());
  const seller = await getPublicSellerProfile(id);

  if (!seller) {
    notFound();
  }

  const displayName = seller.name?.trim() || "Продавец";
  const isOwnProfile = currentUser?.id === seller.id;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <ProfileHero
        eyebrow="Публичный профиль продавца"
        displayName={
          <span className="block break-words [overflow-wrap:anywhere]">
            <CensoredText text={displayName} />
          </span>
        }
        avatarName={displayName}
        avatarSrc={seller.image}
        appearance={extractUserAppearance(seller)}
        bannerUrl={seller.bannerUrl}
        roleBadge={<ProfileRoleBadge role={seller.role} />}
        badges={seller.badges}
        avatarStatus={
          <UserPresenceDot
            userId={seller.id}
            lastSeen={seller.lastSeen}
            subjectLabel="Продавец"
            className="md:h-6 md:w-6"
          />
        }
        details={
          <>
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 font-medium ${getRankClassName(seller.rank)}`}
            >
              Ранг: {getRankLabel(seller.rank)}
            </span>
            <UserPresencePill
              userId={seller.id}
              lastSeen={seller.lastSeen}
              subjectLabel="Продавец"
              label="long"
              className="px-3 py-1.5 font-medium text-sm"
            />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-300">
              На площадке с {formatJoinedDate(seller.createdAt)}
            </span>
          </>
        }
        actions={
          !isOwnProfile ? (
            <PublicProfileMessageButton
              targetUserId={seller.id}
              isAuthenticated={Boolean(currentUser)}
            />
          ) : null
        }
        aside={
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-zinc-500">
              Средний рейтинг
            </p>
            <div className="mt-3">
              {seller.reviewCount > 0 && seller.averageRating !== null ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-semibold text-white">
                    {formatSellerAverageRating(seller.averageRating)}
                  </span>
                  <SellerStarScale rating={seller.averageRating} />
                  <span className="text-sm text-zinc-400">
                    {formatSellerReviewCount(seller.reviewCount)}
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-semibold text-white">Нет оценок</p>
                  <p className="text-sm text-zinc-400">Отзывов пока нет</p>
                </div>
              )}
            </div>
          </div>
        }
      />

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
            {seller.reviewsReceived.map((review) => (
              <SellerReviewCard
                key={review.id}
                review={{
                  id: review.id,
                  rating: review.rating,
                  comment: review.comment,
                  sellerReply: review.sellerReply,
                  replyCreatedAt: review.replyCreatedAt?.toISOString() ?? null,
                  createdAt: review.createdAt.toISOString(),
                  author: review.author,
                } satisfies SellerReviewCardData}
                sellerId={seller.id}
                currentUserId={currentUser?.id ?? null}
                currentUserRole={currentUser?.role ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}