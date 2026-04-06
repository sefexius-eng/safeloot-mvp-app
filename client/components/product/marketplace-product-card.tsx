"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";

import CensoredText from "@/components/censored-text";
import { SellerRatingBadge } from "@/components/reviews/seller-rating-badge";
import { useCurrency } from "@/components/providers/currency-provider";
import { TeamBadge } from "@/components/ui/team-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SellerReviewSummary } from "@/lib/review-summary";

type SellerRank = "BRONZE" | "SILVER" | "GOLD";
const SELLER_ONLINE_WINDOW_MS = 5 * 60 * 1000;

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
    email: string;
    name: string | null;
    image: string | null;
    lastSeen: string | null;
    role: Role;
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

function isSellerOnline(lastSeen?: string | null) {
  if (!lastSeen) {
    return false;
  }

  const lastSeenTime = new Date(lastSeen).getTime();

  if (!Number.isFinite(lastSeenTime)) {
    return false;
  }

  return lastSeenTime > Date.now() - SELLER_ONLINE_WINDOW_MS;
}

interface MarketplaceProductCardProps {
  product: MarketplaceProductCardData;
}

export function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  const { formatPrice } = useCurrency();
  const sellerDisplayName = getSellerDisplayName(product.seller);
  const sellerIsOnline = isSellerOnline(product.seller.lastSeen);

  return (
    <article className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_20px_46px_rgba(0,0,0,0.26)]">
      <Link href={`/product/${product.id}`} className="block">
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
              <h3 className="text-xl font-semibold tracking-tight text-white transition group-hover:text-orange-200">
                <CensoredText text={product.title} />
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
      </Link>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
        <Link
          href={`/user/${product.seller.id}`}
          className="group/seller flex min-w-0 flex-row items-center gap-3"
        >
          <div className="relative shrink-0">
            <UserAvatar
              src={product.seller.image}
              name={sellerDisplayName}
              email={product.seller.email}
              className="h-12 w-12 shrink-0 border-transparent bg-zinc-900/80"
              imageClassName="rounded-full border border-gray-700/50 object-cover"
            />
            {sellerIsOnline ? (
              <span
                aria-label="Продавец онлайн"
                title="Продавец онлайн"
                className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-950 bg-emerald-500 text-[8px] text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.45)]"
              >
                ●
              </span>
            ) : null}
          </div>
          <div className="min-w-0 self-center">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-zinc-500">
              Продавец
            </p>
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white transition group-hover/seller:text-orange-300 group-hover/seller:underline">
              <span className="truncate">
                <CensoredText text={sellerDisplayName} />
              </span>
              <TeamBadge role={product.seller.role} />
            </div>
            <SellerRatingBadge
              summary={product.seller.reviewSummary}
              className="mt-2"
              size="sm"
            />
          </div>
        </Link>
        <Link
          href={`/product/${product.id}`}
          className="shrink-0 text-sm font-medium text-white transition group-hover:text-orange-400"
        >
          Открыть карточку
        </Link>
      </div>
    </article>
  );
}