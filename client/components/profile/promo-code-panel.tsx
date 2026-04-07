"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { redeemPromoCode } from "@/app/actions/promocodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";

interface PromoToastState {
  variant: "success" | "error";
  title: string;
  description: string;
}

export function PromoCodePanel() {
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [toast, setToast] = useState<PromoToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!promoCode.trim()) {
      setToast({
        variant: "error",
        title: "Пустой код",
        description: "Введите подарочный код перед активацией.",
      });
      return;
    }

    startTransition(() => {
      void redeemPromoCode(promoCode)
        .then((result) => {
          if (!result.ok) {
            setToast({
              variant: "error",
              title: "Активация отклонена",
              description: result.message ?? "Не удалось активировать промокод.",
            });
            return;
          }

          setPromoCode("");
          setToast({
            variant: "success",
            title: "Промокод активирован",
            description: result.creditedAmount
              ? `На ваш availableBalance зачислено ${result.creditedAmount} USDT.`
              : (result.message ?? "Средства успешно зачислены."),
          });
          window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
          router.refresh();
        })
        .catch(() => {
          setToast({
            variant: "error",
            title: "Ошибка активации",
            description: "Не удалось активировать промокод.",
          });
        });
    });
  }

  return (
    <>
      <div className="mt-6 rounded-[1.6rem] border border-sky-500/15 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(9,9,11,0.4))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase text-sky-200/80">
              Gift Redeem
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Подарочный код
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
              Введите подарочный код, чтобы моментально зачислить бонус на доступный баланс аккаунта.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-[520px]">
            <Input
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              placeholder="Например, MAMA2026"
              className="h-12 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500/40 focus:bg-white/8"
              maxLength={32}
              disabled={isPending}
            />
            <Button
              type="submit"
              disabled={isPending || !promoCode.trim()}
              className="h-12 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(2,132,199,0.28)] hover:bg-sky-500"
            >
              {isPending ? "Активируем..." : "Активировать"}
            </Button>
          </form>
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[90] w-[min(420px,calc(100vw-2rem))]">
          <div
            role="status"
            aria-live="polite"
            className={[
              "rounded-[1.6rem] border px-5 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl",
              toast.variant === "success"
                ? "border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.92),rgba(6,95,70,0.94))] text-emerald-50"
                : "border-red-500/20 bg-[linear-gradient(135deg,rgba(220,38,38,0.92),rgba(127,29,29,0.94))] text-red-50",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] opacity-90">
                  {toast.title}
                </p>
                <p className="mt-2 text-sm leading-7 opacity-95">
                  {toast.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg transition hover:bg-white/20"
                aria-label="Закрыть уведомление"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}