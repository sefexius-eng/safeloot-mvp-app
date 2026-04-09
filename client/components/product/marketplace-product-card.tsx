"use client";

import type { Role } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";

import CensoredText from "@/components/censored-text";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  SellerStarScale,
  formatSellerAverageRating,
  formatSellerReviewCount,
} from "@/components/reviews/seller-star-scale";
import { UserPresenceInlineStatus } from "@/components/ui/user-presence-status";
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

function getProductCover(product: MarketplaceProductCardData) {
  return product.images[0] || product.game.imageUrl || null;
}

function getSellerDisplayName(seller: MarketplaceProductCardData["seller"]) {
  return seller.name?.trim() || "Продавец";
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
  const coverImage = getProductCover(product);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(12,12,14,0.98))] shadow-[0_18px_48px_rgba(0,0,0,0.24)] transition hover:-translate-y-1.5 hover:border-orange-500/30 hover:shadow-[0_28px_64px_rgba(0,0,0,0.32)]">
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative h-40 w-full overflow-hidden border-b border-white/10 bg-zinc-900">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={product.title}
              fill
              unoptimized
              sizes="(min-width: 1280px) 320px, (min-width: 640px) 50vw, 100vw"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.34),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.28),transparent_42%),linear-gradient(135deg,rgba(39,39,42,1),rgba(9,9,11,1))] p-4">
              <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
                {product.game.name}
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.02),rgba(10,10,10,0.1)_50%,rgba(10,10,10,0.76))]" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
            <div className="min-w-0 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-200 backdrop-blur-sm">
              {product.game.name}
            </div>
            <div className="shrink-0 rounded-full border border-orange-400/20 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100 backdrop-blur-sm">
              {product.category.name}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            {product.game.name}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-orange-100">
            <CensoredText text={product.title} />
          </h3>
          <div className="mt-3 text-lg font-bold tracking-tight text-orange-300">
            {formatPrice(product.price)}
          </div>
        </div>
      </Link>

      <div className="mt-auto border-t border-white/10 px-4 pb-4 pt-3">
        <Link
          href={`/user/${product.seller.id}`}
          className="flex min-w-0 items-center gap-3"
        >
          <UserAvatar
            src={product.seller.image}
            name={sellerDisplayName}
            className="h-10 w-10 shrink-0 rounded-full border-white/10 bg-zinc-900/80"
            imageClassName="rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-zinc-200 transition group-hover:text-white">
                <CensoredText text={sellerDisplayName} />
              </p>
              {isTeamSeller(product.seller.role) ? (
                <span className="shrink-0 rounded-full border border-sky-400/20 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-100 align-middle">
                  TEAM
                </span>
              ) : null}
            </div>
            <UserPresenceInlineStatus
              userId={product.seller.id}
              lastSeen={product.seller.lastSeen}
              subjectLabel="Продавец"
              className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"
            />
            <div className="mt-1">
              {hasReviews ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-200">
                    {formatSellerAverageRating(averageRating)}
                  </span>
                  <SellerStarScale rating={averageRating} size="sm" />
                  <span className="text-xs text-zinc-500">
                    {formatSellerReviewCount(reviewSummary.reviewCount)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-zinc-500">Пока без отзывов</span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </article>
  );
}