"use client";

import Link from "next/link";

import { SellerRatingBadge } from "@/components/reviews/seller-rating-badge";
import { useCurrency } from "@/components/providers/currency-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SellerReviewSummary } from "@/lib/review-summary";

type SellerRank = "BRONZE" | "SILVER" | "GOLD";

export interface MarketplaceProductCardData {
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
    rank: SellerRank;
    reviewSummary: SellerReviewSummary;
  };
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
      return "border-amber-700/20 bg-amber-600/10 text-amber-900";
    case "SILVER":
      return "border-slate-500/20 bg-slate-400/12 text-slate-800";
    case "GOLD":
      return "border-yellow-500/20 bg-yellow-400/12 text-yellow-900";
    default:
      return "border-black/8 bg-black/4 text-neutral-700";
  }
}

function getSellerDisplayName(seller: MarketplaceProductCardData["seller"]) {
  return seller.name?.trim() || seller.email;
}

interface MarketplaceProductCardProps {
  product: MarketplaceProductCardData;
}

export function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  const { formatPrice } = useCurrency();

  return (
    <Link
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

        <div className="min-w-fit shrink-0 rounded-[1.2rem] bg-black/40 px-4 py-3 text-right text-white shadow-[0_12px_26px_rgba(0,0,0,0.24)]">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Цена
          </p>
          <p className="mt-1 flex flex-row items-center justify-end whitespace-nowrap text-lg font-bold tracking-tight">
            {formatPrice(product.price)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
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
            <SellerRatingBadge
              summary={product.seller.reviewSummary}
              className="mt-2"
              size="sm"
            />
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-white group-hover:text-orange-400">
          Открыть карточку
        </span>
      </div>
    </Link>
  );
}