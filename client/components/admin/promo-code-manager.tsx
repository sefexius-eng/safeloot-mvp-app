"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  createPromoCode,
  type PromoCodeSummary,
} from "@/app/actions/promocodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PromoCodeManagerProps {
  activePromoCodes: PromoCodeSummary[];
}

function formatPromoAmount(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPromoDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PromoCodeManager({ activePromoCodes }: PromoCodeManagerProps) {
  const router = useRouter();
  const [promoCodes, setPromoCodes] = useState(activePromoCodes);
  const [formState, setFormState] = useState({
    code: "",
    amount: "",
    maxUses: "",
  });
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPromoCodes(activePromoCodes);
  }, [activePromoCodes]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(() => {
      void createPromoCode(
        formState.code,
        Number(formState.amount),
        Number(formState.maxUses),
      )
        .then((result) => {
          if (!result.ok) {
            setFeedback({
              type: "error",
              message: result.message ?? "Не удалось создать промокод.",
            });
            return;
          }

          if (result.promoCode) {
            setPromoCodes((currentPromoCodes) => [
              result.promoCode as PromoCodeSummary,
              ...currentPromoCodes.filter(
                (promoCode) => promoCode.id !== result.promoCode?.id,
              ),
            ]);
          }

          setFormState({
            code: "",
            amount: "",
            maxUses: "",
          });
          setFeedback({
            type: "success",
            message: result.message ?? "Промокод создан.",
          });
          router.refresh();
        })
        .catch(() => {
          setFeedback({
            type: "error",
            message: "Не удалось создать промокод.",
          });
        });
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_200px_220px_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Текст кода</span>
          <Input
            value={formState.code}
            onChange={(event) => {
              setFormState((currentState) => ({
                ...currentState,
                code: event.target.value.toUpperCase(),
              }));
            }}
            placeholder="MAMA2026"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            maxLength={32}
            disabled={isPending}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Сумма зачисления</span>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={formState.amount}
            onChange={(event) => {
              setFormState((currentState) => ({
                ...currentState,
                amount: event.target.value,
              }));
            }}
            placeholder="10"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isPending}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Количество активаций</span>
          <Input
            type="number"
            min="1"
            step="1"
            value={formState.maxUses}
            onChange={(event) => {
              setFormState((currentState) => ({
                ...currentState,
                maxUses: event.target.value,
              }));
            }}
            placeholder="100"
            className="border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
            disabled={isPending}
          />
        </label>

        <Button
          type="submit"
          disabled={
            isPending ||
            !formState.code.trim() ||
            !formState.amount.trim() ||
            !formState.maxUses.trim()
          }
          className="h-11 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(249,115,22,0.28)] hover:bg-orange-500"
        >
          {isPending ? "Создаём..." : "Создать"}
        </Button>
      </form>

      {feedback ? (
        <div
          className={[
            "rounded-[1.25rem] border px-4 py-3 text-sm leading-7",
            feedback.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/20 bg-red-500/10 text-red-100",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      {promoCodes.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-sm leading-7 text-zinc-400">
          Активных промокодов пока нет.
        </div>
      ) : (
        <div className="space-y-3">
          {promoCodes.map((promoCode) => {
            const remainingUses = Math.max(promoCode.maxUses - promoCode.usedCount, 0);

            return (
              <div
                key={promoCode.id}
                className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_16px_42px_rgba(0,0,0,0.16)] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {promoCode.code}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    <span>Создан: {formatPromoDate(promoCode.createdAt)}</span>
                    <span>Осталось: {remainingUses}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-100">
                    +{formatPromoAmount(promoCode.amount)} USDT
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 font-medium text-zinc-300">
                    {promoCode.usedCount} / {promoCode.maxUses}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}