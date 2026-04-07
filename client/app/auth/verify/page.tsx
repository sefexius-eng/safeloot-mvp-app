import Link from "next/link";

import { verifyEmailToken } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

interface VerifyEmailPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token?.trim() ?? "";
  const result = await verifyEmailToken(token);

  const isSuccess = result.status === "success";
  const title =
    result.status === "success"
      ? "Email подтвержден"
      : result.status === "expired"
        ? "Ссылка истекла"
        : "Ссылка недействительна";
  const description =
    result.status === "success"
      ? `Адрес ${result.email} успешно подтвержден. Теперь вы можете получать email-уведомления и размещать товары.`
      : result.status === "expired"
        ? `Срок действия ссылки для ${result.email} истек. Запросите новое письмо из баннера в интерфейсе.`
        : "Токен подтверждения не найден или уже был использован. Запросите новое письмо из баннера в интерфейсе.";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="w-full rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_28%),rgba(9,9,11,0.92)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-10">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.26em] uppercase text-zinc-300">
          SafeLoot Verification
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-8 text-zinc-300 md:text-lg">
          {description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={isSuccess ? "/profile" : "/"}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] transition hover:bg-orange-500"
          >
            {isSuccess ? "Перейти в профиль" : "Вернуться на главную"}
          </Link>
          <Link
            href="/profile"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Открыть кабинет
          </Link>
        </div>
      </section>
    </main>
  );
}