"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";

import CensoredText from "@/components/censored-text";
import { useCurrency } from "@/components/providers/currency-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SellerReviewSummary } from "@/lib/review-summary";

type SellerRank = "BRONZE" | "SILVER" | "GOLD";

export interface MarketplaceProductCardData {
  id: string;
  title: string;
  images: string[];
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
    name: string | null;
    image: string | null;
    lastSeen: string | null;
    role: Role;
    rank: SellerRank;
    reviewSummary: SellerReviewSummary;
  };
}

interface MarketplaceProductCardProps {
  product: MarketplaceProductCardData;
}

function getSellerDisplayName(seller: MarketplaceProductCardData["seller"]) {
  return seller.name?.trim() || "Продавец";
}

function formatAverageRating(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatReviewCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${count} отзыв`;
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return `${count} отзыва`;
  }

  return `${count} отзывов`;
}

function isTeamSeller(role: Role) {
  return ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role);
}

export function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  const { formatPrice } = useCurrency();
  const sellerDisplayName = getSellerDisplayName(product.seller);
  const reviewSummary = product.seller.reviewSummary;
  const hasReviews =
    reviewSummary.averageRating !== null && reviewSummary.reviewCount > 0;
  const averageRating = reviewSummary.averageRating ?? 0;

  return (
    <article className="group flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_20px_46px_rgba(0,0,0,0.26)]">
      <Link href={`/product/${product.id}`} className="block">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-white transition group-hover:text-orange-200">
              <CensoredText text={product.title} />
            </h3>
            <p className="mt-1 truncate text-sm text-zinc-400">
              {product.game.name}
            </p>
          </div>

          <div className="shrink-0 whitespace-nowrap text-right text-xl font-bold tracking-tight text-white">
            {formatPrice(product.price)}
          </div>
        </div>
      </Link>

      <div className="mt-4 border-t border-white/10 pt-4">
        <Link
          href={`/user/${product.seller.id}`}
          className="flex min-w-0 items-center gap-3"
        >
          <UserAvatar
            src={product.seller.image}
            name={sellerDisplayName}
            className="h-8 w-8 shrink-0 border-white/10 bg-zinc-900/80"
            imageClassName="rounded-full object-cover"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-zinc-200 transition group-hover:text-white">
                <CensoredText text={sellerDisplayName} />
              </p>
              {isTeamSeller(product.seller.role) ? (
                <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white align-middle">
                  🛡️ TEAM
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {hasReviews
                ? `⭐ ${formatAverageRating(averageRating)} (${formatReviewCount(reviewSummary.reviewCount)})`
                : "⭐ Нет отзывов"}
            </p>
          </div>
        </Link>
      </div>
    </article>
  );
}