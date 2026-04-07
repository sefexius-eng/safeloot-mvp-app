"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

interface MockTopupButtonProps {
  transactionId: string;
  amount: string;
}

export function MockTopupButton({ transactionId, amount }: MockTopupButtonProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleMockPayment() {
    setErrorMessage("");
    setIsPending(true);

    try {
      const response = await fetch("/api/webhooks/cryptomus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: transactionId,
          uuid: `mock-${transactionId}`,
          status: "paid",
          amount,
          currency: "USDT",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(payload?.message || "Не удалось подтвердить тестовую оплату.");
      }

      window.location.href = "/profile?topup=success";
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить тестовую оплату.",
      );
      setIsPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={handleMockPayment}
        disabled={isPending || !transactionId}
        className="h-14 w-full rounded-[1.35rem] bg-emerald-600 text-base font-semibold shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Подтверждаем оплату..." : "Имитировать успешную оплату"}
      </Button>

      {errorMessage ? (
        <div className="mt-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </>
  );
}