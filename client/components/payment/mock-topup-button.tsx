"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

interface MockTopupButtonProps {
  transactionId: string;
  amount: string;
  currency: string;
}

export function MockTopupButton({
  transactionId,
  amount,
  currency,
}: MockTopupButtonProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleMockPayment() {
    setErrorMessage("");
    setIsPending(true);

    try {
      const amountTotal = Math.round(Number.parseFloat(amount) * 100);

      const response = await fetch("/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "mock-topup-signature",
        },
        body: JSON.stringify({
          id: `evt_mock_${transactionId}`,
          type: "checkout.session.completed",
          data: {
            object: {
              id: `cs_mock_${transactionId}`,
              client_reference_id: transactionId,
              payment_status: "paid",
              status: "complete",
              amount_total: amountTotal,
              currency: currency.toLowerCase(),
              metadata: {
                transactionId,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(payload?.message || "Не удалось подтвердить тестовую карточную оплату.");
      }

      window.location.href = "/profile?topup=success";
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить тестовую карточную оплату.",
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
        {isPending
          ? "Подтверждаем карточную оплату..."
          : "Имитировать успешную оплату картой"}
      </Button>

      {errorMessage ? (
        <div className="mt-4 rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </>
  );
}