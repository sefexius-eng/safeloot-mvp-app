"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface MockPaymentButtonProps {
  orderId: string;
}

interface ConfirmOrderResponse {
  orderId: string;
  status: string;
}

export function MockPaymentButton({ orderId }: MockPaymentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleConfirmPayment() {
    if (!orderId) {
      setErrorMessage("Не удалось определить номер заказа.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | ConfirmOrderResponse
        | null;

      if (!response.ok) {
        throw new Error(
          (payload && "message" in payload && payload.message) ||
            (payload && "error" in payload && payload.error) ||
            "Не удалось подтвердить оплату.",
        );
      }

      const confirmedOrder = payload as ConfirmOrderResponse;
      router.push(`/order/${confirmedOrder.orderId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить оплату.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={handleConfirmPayment}
        disabled={isLoading || !orderId}
        className="h-14 w-full rounded-[1.35rem] bg-emerald-600 text-base font-semibold shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Подтверждаем оплату..." : "Имитировать успешную оплату картой"}
      </Button>

      {errorMessage ? (
        <div className="mt-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
