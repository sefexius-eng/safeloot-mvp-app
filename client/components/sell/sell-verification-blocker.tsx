"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { sendVerificationEmailAction } from "@/app/actions/email-verification";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SellVerificationBlockerProps {
  email: string;
}

interface SellVerificationGateCardProps {
  email: string;
  mode?: "page" | "dialog";
}

const BLOCKER_BENEFITS = [
  "Публикация лотов откроется сразу после подтверждения адреса.",
  "Письма по заказам и спорам будут приходить только на проверенный email.",
  "Маркетплейс не допускает продавцов с неподтверждёнными контактами.",
];

export function SellVerificationGateCard({
  email,
  mode = "page",
}: SellVerificationGateCardProps) {
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isDialogMode = mode === "dialog";

  function handleSendVerificationEmail() {
    setSuccessMessage("");
    setErrorMessage("");

    startTransition(() => {
      void sendVerificationEmailAction().then((result) => {
        if (result.ok) {
          setSuccessMessage(result.message);
          return;
        }

        setErrorMessage(result.message);
      });
    });
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[2.25rem] shadow-[0_28px_90px_rgba(0,0,0,0.34)]",
        isDialogMode
          ? "border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(24,24,27,1),rgba(9,9,11,1))]"
          : "border border-amber-500/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))]",
      )}
    >
      <div
        className={cn(
          "grid gap-8",
          isDialogMode
            ? "p-5 md:p-6 lg:grid-cols-[minmax(0,1.1fr)_280px]"
            : "p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:p-10",
        )}
      >
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold tracking-[0.28em] uppercase text-amber-200">
              Seller Access Locked
            </div>

            <div className="space-y-4">
              <h1
                className={cn(
                  "max-w-3xl font-semibold tracking-tight text-white",
                  isDialogMode ? "text-2xl md:text-4xl" : "text-3xl md:text-5xl",
                )}
              >
                Раздел продаж временно заблокирован до подтверждения email.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">
                Чтобы публиковать товары и получать уведомления по заказам, подтвердите адрес электронной почты. Это обязательный шаг для всех продавцов на площадке.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-zinc-500">
                Email для подтверждения
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{email}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Нажмите кнопку ниже, и мы отправим новое письмо со ссылкой подтверждения.
              </p>

              {successMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-7 text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-7 text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleSendVerificationEmail}
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-amber-400 px-5 text-sm font-semibold text-zinc-950 shadow-[0_18px_42px_rgba(251,191,36,0.24)] hover:bg-amber-300"
                >
                  {isPending ? "Отправляем письмо..." : "Подтвердить Email"}
                </Button>

                <Link
                  href="/profile"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  Вернуться в профиль
                </Link>
              </div>
            </div>
          </div>

          <aside className="rounded-[1.9rem] border border-white/10 bg-white/5 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur-sm md:p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-2xl text-amber-200">
              ✉
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-white">
              Почему это обязательно
            </h2>
            <div className="mt-5 space-y-3">
              {BLOCKER_BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-zinc-300"
                >
                  {benefit}
                </div>
              ))}
            </div>
          </aside>
      </div>
    </section>
  );
}

export function SellVerificationBlocker({
  email,
}: SellVerificationBlockerProps) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <SellVerificationGateCard email={email} />
    </main>
  );
}