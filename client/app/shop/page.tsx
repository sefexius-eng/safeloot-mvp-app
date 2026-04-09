import Link from "next/link";
import type { Role } from "@prisma/client";

import { CosmeticsShop } from "@/components/shop/cosmetics-shop";
import { FormattedBalance } from "@/components/ui/formatted-balance";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { getCosmeticsShopState } from "@/lib/domain/cosmetics";

export const dynamic = "force-dynamic";

function getShopUserRole(role: Role | null | undefined) {
  return role ?? null;
}

export default async function ShopPage() {
  const currentUser = await getCurrentSessionUser(await getAuthSession());
  const shopState = await getCosmeticsShopState(currentUser?.id ?? null);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="overflow-hidden rounded-[2.35rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(15,23,42,0.94))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)] md:px-10 md:py-10 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200/80">
              SafeLoot Cosmetics
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.04]">
              Магазин косметики для ников, шрифтов и рамок аватаров.
            </h1>
            <p className="mt-4 text-sm leading-7 text-zinc-300 md:text-base">
              Покупайте персональные стили за баланс площадки и сразу применяйте их в шапке сайта, профиле, чате сделки, таверне, отзывах и витринах продавца.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {shopState.viewer ? (
              <div className="inline-flex h-11 items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100">
                Баланс магазина: <FormattedBalance amount={shopState.viewer.availableBalance} className="ml-2" />
              </div>
            ) : (
              <Link
                href="/login?callbackUrl=/shop"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Войти для покупок
              </Link>
            )}

            <Link
              href="/profile"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            >
              Вернуться в профиль
            </Link>
          </div>
        </div>
      </section>

      <CosmeticsShop
        initialState={shopState}
        currentUserRole={getShopUserRole(currentUser?.role)}
      />
    </main>
  );
}