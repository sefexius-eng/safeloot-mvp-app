"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const INFO_LINKS = [
  {
    label: "Пользовательское соглашение",
    href: "/terms",
  },
  {
    label: "Политика конфиденциальности",
    href: "/privacy",
  },
  {
    label: "Правила Escrow-сделок",
    href: "/help",
  },
  {
    label: "Поддержка",
    href: "/help",
  },
];

const COMMUNITY_LINKS = [
  {
    label: "Telegram",
    href: "https://t.me/safelootmarket",
    external: true,
  },
  {
    label: "Discord",
    href: "#",
    external: false,
  },
];

const PAYMENT_METHODS = ["Visa", "Mastercard", "USDT", "TON"];

export function SiteFooter() {
  const pathname = usePathname();
  const isChatOrOrder =
    pathname?.startsWith("/chats") ||
    pathname?.startsWith("/orders") ||
    pathname?.startsWith("/order");

  if (isChatOrOrder) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-[#0a0a0a]">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-600 text-base font-semibold text-white shadow-[0_14px_36px_rgba(249,115,22,0.24)]">
                S
              </span>
              <div>
                <span className="block text-base font-semibold tracking-tight text-white">
                  SafeLoot
                </span>
                <span className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Escrow Market
                </span>
              </div>
            </Link>
            <p className="max-w-xs text-sm leading-6 text-zinc-400">
              Маркетплейс игровых ценностей с защитой сделок Escrow.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Информация
            </p>
            <nav className="mt-4 flex flex-col gap-3 text-sm text-zinc-400">
              {INFO_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Соцсети
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-400">
              {COMMUNITY_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Способы оплаты
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-zinc-900 pt-5 text-center text-xs text-zinc-500">
          © 2026 SafeLoot. Все права защищены.
        </div>
      </div>
    </footer>
  );
}