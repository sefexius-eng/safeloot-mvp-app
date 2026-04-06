"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";
const PROFILE_REFRESH_INTERVAL_MS = 5000;

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  rank: string;
  availableBalance: string;
  holdBalance: string;
  createdAt: string;
}

function formatBalance(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function SiteHeader() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const isBanned = Boolean(session?.user?.isBanned);

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

      return () => {
        isMounted = false;
      };
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/users/me", {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | CurrentUser
          | null;

        if (!response.ok) {
          throw new Error(
            (payload && "message" in payload && payload.message) ||
              (payload && "error" in payload && payload.error) ||
              "Не удалось загрузить профиль.",
          );
        }

        if (isMounted) {
          setUser(payload as CurrentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      }
    }

    void loadCurrentUser();
    const intervalId = window.setInterval(() => {
      void loadCurrentUser();
    }, PROFILE_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshToken, status, session?.user?.id]);

  const avatarLetter =
    session?.user?.email?.slice(0, 1).toUpperCase() ??
    session?.user?.name?.slice(0, 1).toUpperCase() ??
    "S";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(9,9,11,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4 lg:min-w-[220px]">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 text-lg font-semibold text-white shadow-[0_14px_40px_rgba(249,115,22,0.26)]">
              S
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-neutral-50">
                SafeLoot
              </span>
              <span className="block text-xs tracking-[0.24em] uppercase text-zinc-500">
                Escrow Market
              </span>
            </span>
          </Link>
        </div>

        <form className="flex-1 lg:max-w-2xl">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              name="search"
              placeholder="Поиск по играм, товарам и услугам"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-sm text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.22)] outline-none transition placeholder:text-zinc-500 focus:border-orange-500/40 focus:bg-white/8 focus:ring-4 focus:ring-orange-500/10"
            />
          </label>
        </form>

        <div className="flex flex-col gap-3 lg:min-w-[360px] lg:items-end">
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {status === "authenticated" ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
                  <span className="font-medium text-white">Доступно:</span>{" "}
                  {formatBalance(user?.availableBalance ?? "0")}
                  <span className="ml-1 text-zinc-500">USDT</span>
                  <span className="mx-2 text-zinc-600">|</span>
                  <span className="font-medium text-white">Холд:</span>{" "}
                  {formatBalance(user?.holdBalance ?? "0")}
                  <span className="ml-1 text-zinc-500">USDT</span>
                </div>

                {isBanned ? (
                  <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-5 text-sm font-semibold text-red-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
                    Аккаунт заблокирован
                  </div>
                ) : (
                  <>
                    <Link
                      href="/sell"
                      className="sell-link inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold shadow-[0_16px_40px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5 hover:bg-orange-500"
                    >
                      Продать
                    </Link>

                    {session?.user?.role === "ADMIN" ? (
                      <Link
                        href="/admin"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 px-5 text-sm font-semibold text-sky-100 shadow-[0_16px_40px_rgba(2,132,199,0.16)] transition hover:-translate-y-0.5 hover:bg-sky-500/20"
                      >
                        Админ-панель
                      </Link>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                >
                  Выйти
                </button>

                <Link
                  href="/profile"
                  aria-label="Профиль пользователя"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                >
                  {avatarLetter}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                >
                  Войти
                </Link>

                <Link
                  href="/register"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-500"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
