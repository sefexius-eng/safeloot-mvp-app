"use client";

import { useState } from "react";

import { createTopupInvoice } from "@/app/actions/payments";
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
import { Input } from "@/components/ui/input";

export function TopupBalanceDialogMenuItem() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

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
      const result = await createTopupInvoice(normalizedAmount);

      if (!result.ok || !result.checkoutUrl) {
        throw new Error(result.message || "Не удалось создать счёт на пополнение.");
      }

      window.location.href = result.checkoutUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось создать счёт на пополнение.",
      );
      setIsPending(false);
    }
  }

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        Пополнить баланс
      </DropdownMenuItem>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пополнение баланса</DialogTitle>
            <DialogDescription>
              Введите сумму в USDT. После создания инвойса вы будете перенаправлены на защищенную страницу оплаты.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Сумма пополнения
              </label>
              <div className="mt-3 flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-zinc-950/60 px-4 py-3">
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-auto border-0 bg-transparent px-0 text-lg font-semibold text-white shadow-none focus-visible:ring-0"
                  placeholder="10"
                  disabled={isPending}
                />
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  USDT
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Средства зачисляются на доступный баланс после подтверждения оплаты через webhook кассы.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-sky-500/15 bg-sky-500/8 p-4 text-sm leading-7 text-sky-100">
              Если ключи Cryptomus не настроены, откроется локальный тестовый checkout для безопасной отладки потока пополнения.
            </div>

            {errorMessage ? (
              <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending}
                className="h-12 w-full rounded-2xl bg-orange-600 text-sm font-semibold shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500 sm:w-auto"
              >
                {isPending ? "Создаем инвойс..." : "Перейти к оплате"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}