"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { searchGames } from "@/app/actions/search";
import { NotificationsBell } from "@/components/notifications-bell";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import catalogSeedData from "@/lib/catalog-seed-data.json";
import { isAdminRole } from "@/lib/roles";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";
const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const PROFILE_REFRESH_INTERVAL_MS = 5000;
const SEARCH_DEBOUNCE_MS = 250;
const POPULAR_GAMES = catalogSeedData.popularGames;

interface SearchGameResult {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  rank: string;
  lastSeen: string;
  availableBalance: string;
  holdBalance: string;
  createdAt: string;
}

function HeaderAuthSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
      <div className="h-10 w-[124px] animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      <div className="h-10 w-[92px] animate-pulse rounded-xl border border-white/10 bg-white/5" />
      <div className="h-10 w-[96px] animate-pulse rounded-xl border border-white/10 bg-white/5" />
      <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
    </div>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { currencies, currency, setCurrency, formatBalance } = useCurrency();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGameResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSeenIntervalRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (lastSeenIntervalRef.current !== null) {
      window.clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }

    if (status !== "authenticated") {
      return undefined;
    }

    async function updateLastSeen() {
      try {
        await fetch("/api/users/me/last-seen", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // Quiet heartbeat; ignore transient network failures.
      }
    }

    void updateLastSeen();
    lastSeenIntervalRef.current = window.setInterval(() => {
      void updateLastSeen();
    }, LAST_SEEN_UPDATE_INTERVAL_MS);

    return () => {
      if (lastSeenIntervalRef.current !== null) {
        window.clearInterval(lastSeenIntervalRef.current);
        lastSeenIntervalRef.current = null;
      }
    };
  }, [status, session?.user?.id]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const nextResults = await searchGames(query);

        if (isActive) {
          setResults(nextResults);
          setIsSearchOpen(true);
        }
      } catch {
        if (isActive) {
          setResults([]);
        }
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelectGame(game: SearchGameResult) {
    setQuery(game.name);
    setResults([]);
    setIsSearchOpen(false);
    router.push(`/games/${game.slug}`);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (results[0]) {
      handleSelectGame(results[0]);
    }
  }

  const displayName =
    user?.name?.trim() ||
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Профиль";
  const displayAvailable = Math.max(0, Number(user?.availableBalance ?? 0));
  const displayHold = Math.max(0, Number(user?.holdBalance ?? 0));
  const availableBalanceLabel = formatBalance(displayAvailable);
  const holdBalanceLabel = formatBalance(displayHold);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(9,9,11,0.78)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-5">
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

          <form className="flex-1 w-full max-w-2xl lg:justify-self-center" onSubmit={handleSearchSubmit}>
            <div ref={searchContainerRef} className="relative z-[70] w-full">
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
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => {
                    setIsSearchOpen(true);
                  }}
                  placeholder="Поиск по играм, товарам и услугам"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-sm text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.22)] outline-none transition placeholder:text-zinc-500 focus:border-orange-500/40 focus:bg-white/8 focus:ring-4 focus:ring-orange-500/10"
                />
              </label>

              {isSearchOpen ? (
                <div className="absolute top-[calc(100%+0.6rem)] z-[80] w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgba(9,9,11,0.96)] shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                  {!query.trim() ? (
                    <div>
                      <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold tracking-[0.22em] uppercase text-orange-200/80">
                        Популярные игры
                      </div>
                      <div className="divide-y divide-white/10">
                        {POPULAR_GAMES.map((game) => (
                          <button
                            key={game.slug}
                            type="button"
                            onClick={() => handleSelectGame({ ...game, id: game.slug, imageUrl: null })}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-sm font-semibold text-orange-100">
                              {game.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-white">
                                {game.name}
                              </span>
                              <span className="block truncate text-xs uppercase tracking-[0.18em] text-zinc-500">
                                Быстрый переход
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : isSearching ? (
                    <div className="px-4 py-3 text-sm text-zinc-400">
                      Ищем игры...
                    </div>
                  ) : results.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {results.map((game) => (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => handleSelectGame(game)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200">
                            {game.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">
                              {game.name}
                            </span>
                            <span className="block truncate text-xs uppercase tracking-[0.18em] text-zinc-500">
                              Каталог игры
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-zinc-400">
                      Ничего не найдено.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </form>

          {status === "loading" ? (
            <HeaderAuthSkeleton />
          ) : (
            <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
              {status === "authenticated" ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Меню профиля"
                      className="inline-flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-zinc-300 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h10A2.5 2.5 0 0 1 18 7.5V8h1.5A1.5 1.5 0 0 1 21 9.5v7a1.5 1.5 0 0 1-1.5 1.5H18v.5a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 3 18.5z" />
                          <path d="M18 8v10" />
                          <circle cx="16" cy="13" r="1" />
                        </svg>
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-bold text-white">
                          {availableBalanceLabel}
                        </span>
                        <span className="mt-0.5 truncate text-xs text-zinc-500">
                          Холд: {holdBalanceLabel}
                        </span>
                      </div>
                      <span className="hidden h-8 w-px bg-white/10 sm:block" />
                      <UserAvatar
                        src={user?.image ?? session?.user?.image ?? null}
                        name={displayName}
                        email={user?.email ?? session?.user?.email ?? null}
                        className="h-10 w-10 shrink-0 rounded-[0.8rem] border-0 bg-zinc-800/80"
                      />
                      <div className="hidden min-w-0 flex-col sm:flex">
                        <span className="truncate text-sm font-semibold text-white">
                          {displayName}
                        </span>
                        <span className="truncate text-xs text-zinc-500">
                          Профиль
                        </span>
                      </div>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-zinc-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Аккаунт</DropdownMenuLabel>
                    <div className="px-3 pb-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {user?.email ?? session?.user?.email ?? ""}
                      </p>
                    </div>
                    <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Мой профиль</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/settings">Настройки профиля</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
                    <div className="px-2 py-2">
                      <NotificationsBell mode="panel" />
                    </div>
                    <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        void signOut({ callbackUrl: "/" });
                      }}
                      className="text-rose-200 focus:bg-rose-500/10 focus:text-rose-100"
                    >
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-[92px] shrink-0">
                  <Select
                    aria-label="Выбор валюты"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as typeof currency)}
                    className="!h-10 !rounded-xl !border !border-gray-800 !bg-[#1A1D24] !px-3 !py-1.5 !pr-9 !text-sm !text-gray-300 !shadow-none outline-none focus:!border-orange-500 focus:!ring-1 focus:!ring-orange-500"
                  >
                    {currencies.map((item) => (
                      <option key={item.code} value={item.code} className="bg-[#1A1D24] text-gray-300">
                        {item.code}
                      </option>
                    ))}
                  </Select>
                </div>

                <Link
                  href="/chats"
                  aria-label="Открыть диалоги"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                >
                  <span aria-hidden="true">💬</span>
                </Link>

                {isBanned ? (
                  <div className="inline-flex h-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold text-red-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
                    Аккаунт заблокирован
                  </div>
                ) : (
                  <>
                    <Link
                      href="/sell"
                      className="sell-link inline-flex h-10 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-500"
                    >
                      Продать
                    </Link>

                    {isAdminRole(session?.user?.role) ? (
                      <Link
                        href="/admin"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-100 shadow-[0_16px_40px_rgba(2,132,199,0.16)] transition hover:-translate-y-0.5 hover:bg-sky-500/20"
                      >
                        Админ-панель
                      </Link>
                    ) : null}
                  </>
                )}

              </>
              ) : status === "unauthenticated" ? (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-100 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:bg-white/10"
                >
                  Войти
                </Link>

                <Link
                  href="/register"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-500"
                >
                  Регистрация
                </Link>
              </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
