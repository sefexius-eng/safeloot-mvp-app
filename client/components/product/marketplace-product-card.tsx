"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";

import CensoredText from "@/components/censored-text";
import { useCurrency } from "@/components/providers/currency-provider";
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

export function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  const { formatPrice } = useCurrency();
  const previewImage = product.images[0]?.trim() || product.game.imageUrl?.trim() || "";
  const fallbackLetter = product.game.name.slice(0, 1).toUpperCase() || "G";

  return (
    <article className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-[0_20px_46px_rgba(0,0,0,0.26)]">
      <Link href={`/product/${product.id}`} className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/25 text-lg font-semibold text-white shadow-[0_12px_26px_rgba(0,0,0,0.24)]">
          {previewImage ? (
            <img
              src={previewImage}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            fallbackLetter
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold tracking-tight text-white transition group-hover:text-orange-200">
            <CensoredText text={product.title} />
          </h3>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {product.game.name}
          </p>
        </div>

        <div className="shrink-0 whitespace-nowrap text-right text-lg font-bold tracking-tight text-white">
          {formatPrice(product.price)}
        </div>
      </Link>
    </article>
  );
}