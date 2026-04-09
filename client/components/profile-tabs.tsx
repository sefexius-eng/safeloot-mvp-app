"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { toggleAllProductsVisibility } from "@/app/actions/product";
import { useCurrency } from "@/components/providers/currency-provider";
import { PromoCodePanel } from "@/components/profile/promo-code-panel";
import { ProfileProductActions } from "@/components/profile/profile-product-actions";
import {
  SellerReviewCard,
  type SellerReviewCardData,
} from "@/components/reviews/seller-review-card";

export interface ProfileTabsProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  isActive: boolean;
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
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileTabsReview {
  id: string;
  rating: number;
  comment: string | null;
  sellerReply: string | null;
  createdAt: string;
  replyCreatedAt: string | null;
  author: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    activeColor: string | null;
    activeFont: string | null;
    activeDecoration: string | null;
  };
}

interface ProfileTabsProps {
  products: ProfileTabsProduct[];
  reviews: ProfileTabsReview[];
  sellerId: string;
  currentUserId?: string | null;
  currentUserRole?: Role | null;
}

export function ProfileTabs({
  products: initialProducts,
  reviews: initialReviews,
  sellerId,
  currentUserId,
  currentUserRole,
}: ProfileTabsProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState<"products" | "reviews">("products");
  const [products, setProducts] = useState<ProfileTabsProduct[]>(initialProducts);
  const [reviews, setReviews] = useState<ProfileTabsReview[]>(initialReviews);
  const [bulkError, setBulkError] = useState("");
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setReviews(initialReviews);
  }, [initialReviews]);

  function handleProductDeleted(productId: string) {
    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== productId),
    );
  }

  function handleProductVisibilityChanged(productId: string, isActive: boolean) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              isActive,
            }
          : product,
      ),
    );
  }

  function handleToggleAllProducts(nextIsActive: boolean) {
    setBulkError("");

    startBulkTransition(() => {
      void toggleAllProductsVisibility(nextIsActive)
        .then((result) => {
          if (!result.ok) {
            setBulkError(result.message ?? "Не удалось изменить видимость товаров.");
            return;
          }

          setProducts((currentProducts) =>
            currentProducts.map((product) => ({
              ...product,
              isActive: nextIsActive,
            })),
          );
          router.refresh();
        })
        .catch(() => {
          setBulkError("Не удалось изменить видимость товаров.");
        });
    });
  }

  const activeProductsCount = products.filter((product) => product.isActive).length;
  const hiddenProductsCount = products.length - activeProductsCount;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
      <div className="border-b border-white/10 pb-5">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
          Seller Content
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Управление витриной и отзывами
        </h2>
      </div>

      <PromoCodePanel />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={[
            "inline-flex items-center justify-center border-b-2 px-4 py-3 text-sm font-semibold transition",
            activeTab === "products"
              ? "border-orange-400 text-orange-200"
              : "border-transparent text-zinc-500 hover:text-zinc-200",
          ].join(" ")}
        >
          Мои товары ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={[
            "inline-flex items-center justify-center border-b-2 px-4 py-3 text-sm font-semibold transition",
            activeTab === "reviews"
              ? "border-orange-400 text-orange-200"
              : "border-transparent text-zinc-500 hover:text-zinc-200",
          ].join(" ")}
        >
          Мои отзывы ({reviews.length})
        </button>
      </div>

      {activeTab === "products" ? (
        <div className="mt-6">
          {products.length > 0 ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-zinc-400">
                Активных: <span className="font-medium text-zinc-200">{activeProductsCount}</span> · Скрытых: <span className="font-medium text-zinc-200">{hiddenProductsCount}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleAllProducts(false)}
                  disabled={isBulkPending || hiddenProductsCount === products.length}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBulkPending ? "Обновляем..." : "🙈 Скрыть все"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllProducts(true)}
                  disabled={isBulkPending || activeProductsCount === products.length}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBulkPending ? "Обновляем..." : "👁️ Показать все"}
                </button>
              </div>
            </div>
          ) : null}

          {bulkError ? (
            <p className="mt-4 text-sm text-rose-300">{bulkError}</p>
          ) : null}

          {products.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
              У вас пока нет опубликованных товаров. <Link href="/sell" className="font-semibold text-orange-300 transition hover:text-orange-200">Перейти к размещению</Link>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
              <div className="min-w-[980px] grid grid-cols-[minmax(280px,1.8fr)_140px_160px_120px_220px] gap-4 border-b border-white/10 bg-white/5 px-5 py-4 text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
                <span>Товар</span>
                <span>Игра</span>
                <span>Категория</span>
                <span>Цена</span>
                <span className="text-right">Управление</span>
              </div>

              <div className="min-w-[980px] divide-y divide-white/10">
                {products.map((product) => {
                  return (
                    <div
                      key={product.id}
                      className={[
                        "grid grid-cols-[minmax(280px,1.8fr)_140px_160px_120px_220px] gap-4 px-5 py-4 transition hover:bg-white/5",
                        product.isActive ? "opacity-100" : "opacity-50",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/product/${product.id}`}
                          className="truncate text-sm font-semibold text-white transition hover:text-orange-200"
                        >
                          {product.title}
                        </Link>
                        <p className="mt-1 truncate text-sm text-zinc-500">
                          #{product.id}
                        </p>
                        <span
                          className={[
                            "mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                            product.isActive
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-200",
                          ].join(" ")}
                        >
                          {product.isActive ? "Виден" : "Скрыт"}
                        </span>
                      </div>
                      <span className="text-sm text-zinc-300">{product.game.name}</span>
                      <span className="text-sm text-zinc-300">{product.category.name}</span>
                      <span className="text-sm font-semibold text-white">{formatPrice(product.price)}</span>
                      <div className="flex items-start justify-end">
                        <ProfileProductActions
                          productId={product.id}
                          isActive={product.isActive}
                          onDeleted={handleProductDeleted}
                          onVisibilityChanged={handleProductVisibilityChanged}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {reviews.length === 0 ? (
            <div className="rounded-[1.9rem] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm leading-7 text-zinc-400 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
              Пока никто не оставил вам отзывов.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <SellerReviewCard
                  key={review.id}
                  review={review satisfies SellerReviewCardData}
                  sellerId={sellerId}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onUpdated={(updatedReview) =>
                    setReviews((currentReviews) =>
                      currentReviews.map((currentReview) =>
                        currentReview.id === updatedReview.id
                          ? {
                              ...currentReview,
                              rating: updatedReview.rating,
                              comment: updatedReview.comment,
                              sellerReply: updatedReview.sellerReply,
                              createdAt: updatedReview.createdAt,
                              replyCreatedAt: updatedReview.replyCreatedAt,
                            }
                          : currentReview,
                      ),
                    )
                  }
                  onDeleted={(reviewId) =>
                    setReviews((currentReviews) =>
                      currentReviews.filter((currentReview) => currentReview.id !== reviewId),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}