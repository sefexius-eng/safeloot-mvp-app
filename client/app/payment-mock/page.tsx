import Link from "next/link";

import { MockPaymentButton } from "@/components/payment/mock-payment-button";

interface PaymentMockPageProps {
  searchParams: Promise<{
    orderId?: string;
  }>;
}

export default async function PaymentMockPage({
  searchParams,
}: PaymentMockPageProps) {
  const { orderId } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <section className="grid w-full gap-6 rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:grid-cols-[minmax(0,1fr)_340px] md:p-10">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-sky-400">
            Тестовый шлюз
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Тестовый платежный шлюз SafeLoot
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">
            Это тестовая среда для отладки оплаты заказа без реального банковского эквайринга. После имитации успешной оплаты заказ будет переведен в статус PAID.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Методы оплаты
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Visa, Mastercard, Mir
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Валюты
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                RUB, UAH, USD
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
                Статус
              </p>
              <p className="mt-3 text-lg font-semibold text-amber-300">
                Тестовый режим
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(15,23,42,0.92))] p-6 shadow-[0_22px_58px_rgba(0,0,0,0.28)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs tracking-[0.22em] uppercase text-zinc-500">
              Номер заказа
            </p>
            <p className="mt-3 break-all text-lg font-semibold text-white">
              {orderId ? `#${orderId}` : "Не передан"}
            </p>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-sky-500/15 bg-sky-500/8 p-5 text-sm leading-7 text-sky-100">
            Покупатель будет оплачивать заказ банковской картой, а продавец получит средства только после подтверждения сделки.
          </div>

          <div className="mt-6">
            <MockPaymentButton orderId={orderId ?? ""} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
            >
              Вернуться на главную
            </Link>
            <Link
              href="/sell"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Продолжить размещение
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
