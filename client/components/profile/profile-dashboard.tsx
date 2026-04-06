"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { useCurrency } from "@/components/providers/currency-provider";
import { SellerRatingBadge } from "@/components/reviews/seller-rating-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SellerReviewSummary } from "@/lib/review-summary";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  rank: string;
  availableBalance: string;
  holdBalance: string;
  reviewSummary: SellerReviewSummary;
  createdAt: string;
}

interface ProductItem {
  id: string;
  title: string;
  description: string;
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
  sellerId: string;
  seller: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    rank: string;
    reviewSummary: SellerReviewSummary;
  };
  createdAt: string;
  updatedAt: string;
}

export function ProfileDashboard() {
  const { status } = useSession();
  const { formatPrice } = useCurrency();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    function handleBalanceRefresh() {
      setRefreshToken((currentValue) => currentValue + 1);
    }

    window.addEventListener(BALANCE_REFRESH_EVENT, handleBalanceRefresh);

    return () => {
      window.removeEventListener(BALANCE_REFRESH_EVENT, handleBalanceRefresh);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (status === "loading") {
      return () => {
        isMounted = false;
      };
    }

    if (status !== "authenticated") {
      setUser(null);
      setProducts([]);
      setIsLoading(false);

      return () => {
        isMounted = false;
      };
    }

    async function loadDashboard() {
      setErrorMessage("");

      try {
        const [userResponse, productsResponse] = await Promise.all([
          fetch("/api/users/me", { cache: "no-store" }),
          fetch("/api/users/me/products", { cache: "no-store" }),
        ]);

        const [userPayload, productsPayload] = await Promise.all([
          userResponse.json().catch(() => null),
          productsResponse.json().catch(() => null),
        ]);

        if (!userResponse.ok) {
          throw new Error(
            (userPayload && userPayload.message) ||
              (userPayload && userPayload.error) ||
              "Не удалось загрузить профиль.",
          );
        }

        if (!productsResponse.ok) {
          throw new Error(
            (productsPayload && productsPayload.message) ||
              (productsPayload && productsPayload.error) ||
              "Не удалось загрузить товары.",
          );
        }

        if (isMounted) {
          setUser(userPayload as CurrentUser);
          setProducts(productsPayload as ProductItem[]);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить личный кабинет.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [refreshToken, status]);

  if (status === "loading" || isLoading) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-8 text-sm text-zinc-400 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
        Загружаем личный кабинет...
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-8 text-sm leading-7 text-zinc-300 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
        <p className="text-base font-semibold text-white">Авторизация требуется</p>
        <p className="mt-3">
          Чтобы открыть личный кабинет, войдите в аккаунт или зарегистрируйтесь.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500">
            Войти
          </Link>
          <Link href="/register" className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">
            Регистрация
          </Link>
        </div>
      </div>
    );
  }

  if (!user || errorMessage) {
    return (
      <div className="rounded-[2rem] border border-red-500/15 bg-red-500/10 p-8 text-sm leading-7 text-red-200 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
        {errorMessage || "Не удалось загрузить личный кабинет."}
      </div>
    );
  }

  const displayName = user.name.trim() || user.email.split("@")[0];
  const avatarLetter = displayName.slice(0, 1).toUpperCase() || "S";

  return (
    <section className="space-y-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_38%),rgba(9,9,11,0.92)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 text-3xl font-semibold text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={`Аватар ${displayName}`}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                avatarLetter
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.24em] uppercase text-orange-200/80">
                Профиль продавца
              </p>
              <h2 className="mt-3 truncate text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {displayName}
              </h2>
              <p className="mt-2 truncate text-sm text-zinc-300">{user.email}</p>
              <SellerRatingBadge summary={user.reviewSummary} className="mt-4" />

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-zinc-200">
                  {user.role}
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                  Ранг {user.rank}
                </span>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Быстрые действия
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Настройте ник и аватар
          </h3>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Откройте страницу настроек, чтобы обновить публичный никнейм и загрузить сжатый аватар, который сразу появится в кабинете.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/profile/settings"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-500"
            >
              Открыть настройки
            </Link>
            <Link
              href="/sell"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Разместить товар
            </Link>
          </div>
        </article>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-[2rem] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(5,150,105,0.12),rgba(9,9,11,0.92))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-emerald-300/80">
            Доступно к выводу
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {formatPrice(user.availableBalance)}
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Баланс, который продавец может использовать после вывода из внутренней системы.
          </p>
        </article>

        <article className="rounded-[2rem] border border-sky-500/15 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(9,9,11,0.92))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-semibold tracking-[0.24em] uppercase text-sky-300/80">
            В холде (Escrow)
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {formatPrice(user.holdBalance)}
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Средства по завершенным сделкам, зафиксированные во внутреннем escrow-балансе.
          </p>
        </article>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
              Личный кабинет
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Мои товары
            </h2>
          </div>

          <div className="text-sm text-zinc-400">
            Продавец: <span className="font-medium text-zinc-200">{displayName}</span>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
            У вас пока нет опубликованных товаров. <Link href="/sell" className="font-semibold text-orange-300 transition hover:text-orange-200">Перейти к размещению</Link>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
            <div className="grid grid-cols-[minmax(0,1.35fr)_140px_140px_minmax(160px,1fr)_120px] gap-4 border-b border-white/10 bg-white/5 px-5 py-4 text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
              <span>Товар</span>
              <span>Игра</span>
              <span>Категория</span>
              <span>Продавец</span>
              <span>Цена</span>
            </div>

            <div className="divide-y divide-white/10">
              {products.map((product) => {
                const sellerDisplayName =
                  product.seller.name?.trim() || product.seller.email;

                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="grid grid-cols-[minmax(0,1.35fr)_140px_140px_minmax(160px,1fr)_120px] gap-4 px-5 py-4 transition hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {product.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        #{product.id}
                      </p>
                    </div>
                    <span className="text-sm text-zinc-300">{product.game.name}</span>
                    <span className="text-sm text-zinc-300">{product.category.name}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        src={product.seller.image}
                        name={sellerDisplayName}
                        email={product.seller.email}
                        className="h-6 w-6 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-200">
                          {sellerDisplayName}
                        </span>
                        <SellerRatingBadge
                          summary={product.seller.reviewSummary}
                          className="mt-1"
                          size="sm"
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white">{formatPrice(product.price)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
