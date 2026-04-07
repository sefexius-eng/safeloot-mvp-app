import Link from "next/link";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { redirect } from "next/navigation";

import { MockTopupButton } from "@/components/payment/mock-topup-button";
import { FormattedPrice } from "@/components/ui/formatted-price";
import { getCurrentSessionUser } from "@/lib/access-control";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface TopupMockPageProps {
  searchParams: Promise<{
    transactionId?: string;
  }>;
}

export default async function TopupMockPage({ searchParams }: TopupMockPageProps) {
  const currentUser = await getCurrentSessionUser(await getAuthSession());

  if (!currentUser || currentUser.isBanned) {
    redirect("/");
  }

  const { transactionId } = await searchParams;

  if (!transactionId) {
    redirect("/");
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      status: true,
      type: true,
      createdAt: true,
    },
  });

  if (
    !transaction ||
    transaction.userId !== currentUser.id ||
    transaction.type !== TransactionType.DEPOSIT ||
    transaction.status !== TransactionStatus.PENDING
  ) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="grid w-full gap-6 rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:grid-cols-[minmax(0,1fr)_340px] md:p-10">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-emerald-400">
            Mock Cryptomus Checkout
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Тестовое пополнение баланса SafeLoot
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">
            Это безопасная локальная имитация оплаты. После подтверждения mock checkout вызовет webhook Cryptomus и зачислит средства на ваш available balance.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Провайдер
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Cryptomus Mock
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Валюта
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {transaction.currency}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Статус
              </p>
              <p className="mt-3 text-lg font-semibold text-amber-300">
                Ожидает оплаты
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(15,23,42,0.92))] p-6 shadow-[0_22px_58px_rgba(0,0,0,0.28)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
              Транзакция
            </p>
            <p className="mt-3 break-all text-lg font-semibold text-white">
              #{transaction.id}
            </p>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
              Сумма пополнения
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <span className="text-sm text-zinc-400">К зачислению</span>
              <span className="text-2xl font-semibold tracking-tight text-white">
                <FormattedPrice amount={transaction.amount.toString()} />
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-emerald-500/15 bg-emerald-500/8 p-5 text-sm leading-7 text-emerald-100">
            Кнопка ниже имитирует callback от крипто-эквайринга и проверяет ваш webhook-поток без реального провайдера.
          </div>

          <div className="mt-6">
            <MockTopupButton
              transactionId={transaction.id}
              amount={transaction.amount.toString()}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="inline-flex rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
            >
              Вернуться в профиль
            </Link>
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              На главную
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}