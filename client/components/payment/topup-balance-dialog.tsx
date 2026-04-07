"use client";

import { useState } from "react";

import { createTopupSession } from "@/app/actions/payments";
import {
  useCurrency,
  type CurrencyCode,
} from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const QUICK_TOPUP_AMOUNTS = [10, 50, 100, 500] as const;

interface TopupBalanceDialogMenuItemProps {
  currencyCode?: CurrencyCode;
}

function formatAmountChip(amount: number, currencyCode: CurrencyCode, currencySymbol: string) {
  if (currencyCode === "USD" || currencyCode === "EUR") {
    return `${currencySymbol}${amount}`;
  }

  if (currencyCode === "PLN") {
    return `${amount} ${currencySymbol}`;
  }

  return `${amount}${currencySymbol}`;
}

function isLeadingCurrencySymbol(currencyCode: CurrencyCode) {
  return currencyCode === "USD" || currencyCode === "EUR";
}

export function TopupBalanceDialogMenuItem({
  currencyCode = "USD",
}: TopupBalanceDialogMenuItemProps) {
  const { currencies } = useCurrency();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const currencyDefinition =
    currencies.find((item) => item.code === currencyCode) ?? currencies[0];
  const currencySymbol = currencyDefinition?.symbol ?? "$";
  const showLeadingCurrencySymbol = isLeadingCurrencySymbol(currencyCode);

  function updateAmount(nextAmount: string) {
    setAmount(nextAmount);
    setErrorMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAmount = Number.parseFloat(amount.replace(",", "."));

    if (!Number.isFinite(normalizedAmount)) {
      setErrorMessage("Укажите корректную сумму пополнения.");
      return;
    }

    setIsPending(true);
    setErrorMessage("");

    try {
      const result = await createTopupSession(normalizedAmount);

      if (!result.ok || !result.checkoutUrl) {
        throw new Error(result.message || "Не удалось создать checkout сессию.");
      }

      window.location.href = result.checkoutUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось создать checkout сессию.",
      );
      setIsPending(false);
    }
  }

  return (
    <>
      <DropdownMenuItem
        className="font-semibold text-emerald-100 focus:bg-emerald-500/10 focus:text-emerald-50"
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        Пополнить баланс
      </DropdownMenuItem>

      <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-[36rem] overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-0">
              <div className="relative overflow-hidden rounded-[inherit] px-6 py-8 sm:px-8 sm:py-9">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-32 rounded-full bg-orange-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 top-20 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

                <DialogHeader className="relative space-y-3 pr-10">
                  <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-zinc-400">
                    Visa • Mastercard • 3D Secure
                  </div>
                  <DialogTitle className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
                    Пополнение баланса
                  </DialogTitle>
                  <DialogDescription className="max-w-xl text-sm leading-7 text-zinc-400">
                    Введите сумму пополнения и перейдите в защищенную Stripe Checkout кассу. После подтверждения оплаты баланс будет обновлен автоматически.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="relative mt-7 space-y-6">
                  <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
                    <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      <span>Сумма пополнения</span>
                      <span>{currencyCode}</span>
                    </div>

                    <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-black/20 px-4 py-6 sm:px-6 sm:py-7">
                      <div className="flex items-baseline justify-center gap-3">
                        {showLeadingCurrencySymbol ? (
                          <span className="text-3xl font-semibold text-zinc-500 sm:text-4xl">
                            {currencySymbol}
                          </span>
                        ) : null}

                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => updateAmount(event.target.value.replace(",", "."))}
                          className="h-auto w-full max-w-[240px] bg-transparent px-0 py-0 text-center text-4xl font-bold tracking-tight text-white outline-none [appearance:textfield] focus:outline-none focus:ring-0 focus-visible:ring-0 sm:text-5xl [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="0"
                          disabled={isPending}
                        />

                        {!showLeadingCurrencySymbol ? (
                          <span className="text-3xl font-semibold text-zinc-500 sm:text-4xl">
                            {currencySymbol}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-center text-sm leading-7 text-zinc-500">
                        Сумма будет списана в {currencyCode}. Чем точнее сумма, тем быстрее вы дойдете до checkout без лишних шагов.
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                      {QUICK_TOPUP_AMOUNTS.map((presetAmount) => {
                        const presetValue = presetAmount.toString();
                        const isActive = amount === presetValue;

                        return (
                          <Button
                            key={presetAmount}
                            type="button"
                            onClick={() => updateAmount(presetValue)}
                            disabled={isPending}
                            className={[
                              "h-11 rounded-full border px-4 text-sm font-semibold shadow-none transition",
                              isActive
                                ? "border-orange-400/50 bg-orange-500/20 text-orange-50 hover:bg-orange-500/25"
                                : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                            ].join(" ")}
                          >
                            {formatAmountChip(presetAmount, currencyCode, currencySymbol)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-[1.35rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-zinc-400">
                    Средства зачисляются на доступный баланс только после подтверждения успешной карточной оплаты через защищенный webhook шлюза.
                  </div>

                  <DialogFooter className="pt-1 sm:justify-center">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="h-14 w-full rounded-[1.4rem] bg-orange-600 text-sm font-semibold shadow-[0_24px_60px_rgba(234,88,12,0.35)] hover:bg-orange-500 sm:w-full"
                    >
                      {isPending ? "Создаем checkout..." : "Перейти к оплате картой"}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
        </DialogContent>
      </Dialog>
    </>
  );
}