"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createPendingOrder } from "@/app/actions/orders";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BuyProductDialogProps {
  product: {
    id: string;
    title: string;
    price: string;
  };
}

interface CreateOrderResponse {
  ok: boolean;
  orderId?: string;
  message?: string;
}

export function BuyProductDialog({ product }: BuyProductDialogProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleBuy() {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = (await createPendingOrder(product.id)) as CreateOrderResponse;

      if (!result.ok || !result.orderId) {
        throw new Error(result.message || "Не удалось создать заказ.");
      }

      router.push(`/payment-mock?orderId=${result.orderId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать заказ.",
      );
      setIsLoading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-14 w-full rounded-[1.35rem] bg-orange-600 text-base font-semibold shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500">
          Купить
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтверждение покупки</DialogTitle>
          <DialogDescription>
            Проверьте детали заказа перед переходом на защищенную платежную страницу.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Товар
          </p>
          <p className="mt-2 text-lg font-semibold text-white">{product.title}</p>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <span className="text-sm text-zinc-400">Сумма заказа</span>
            <span className="text-xl font-semibold tracking-tight text-white">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-sky-500/15 bg-sky-500/8 p-4 text-sm text-sky-100">
          <div className="flex items-start gap-3">
            <div className="flex gap-2 pt-0.5">
              <span className="flex h-9 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-[10px] font-semibold tracking-[0.18em] text-white">
                VISA
              </span>
              <span className="flex h-9 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-[10px] font-semibold tracking-[0.12em] text-white">
                MC
              </span>
              <span className="flex h-9 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-[10px] font-semibold tracking-[0.12em] text-white">
                MIR
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Оплата банковскими картами</p>
              <p className="mt-2 leading-7 text-sky-100/80">
                На следующем шаге будет доступна оплата картой. Поддерживаются платежи в RUB, UAH и USD.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-orange-500/15 bg-orange-500/8 p-4 text-sm leading-7 text-orange-100">
          Ваши средства будут заморожены системой Escrow до момента получения товара.
        </div>

        {errorMessage ? (
          <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            onClick={handleBuy}
            disabled={isLoading}
            className="h-12 w-full rounded-2xl bg-orange-600 text-sm font-semibold shadow-[0_18px_42px_rgba(234,88,12,0.35)] hover:bg-orange-500 sm:w-auto"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 animate-spin"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="3"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Создаем заказ...
              </span>
            ) : (
              "Перейти к оплате"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}