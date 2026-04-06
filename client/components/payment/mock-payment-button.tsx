"use client";

import { useActionState } from "react";

import { processPayment } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";

interface MockPaymentButtonProps {
  orderId: string;
}

const initialState = {
  message: "",
};

export function MockPaymentButton({ orderId }: MockPaymentButtonProps) {
  const [state, formAction, isPending] = useActionState(
    processPayment.bind(null, orderId),
    initialState,
  );

  return (
    <form action={formAction}>
      <Button
        type="submit"
        disabled={isPending || !orderId}
        className="h-14 w-full rounded-[1.35rem] bg-emerald-600 text-base font-semibold shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Подтверждаем оплату..." : "Имитировать успешную оплату картой"}
      </Button>

      {state.message ? (
        <div className="mt-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
