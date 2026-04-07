"use client";

import { useState, useTransition } from "react";

import { sendVerificationEmailAction } from "@/app/actions/email-verification";
import { Button } from "@/components/ui/button";

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({
  email,
}: EmailVerificationBannerProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fallbackErrorMessage = "Не удалось отправить письмо. Попробуйте позже.";

  function handleSendVerificationEmail() {
    setFeedback("");
    setErrorMessage("");

    startTransition(() => {
      void sendVerificationEmailAction()
        .then((result) => {
          if (result.ok) {
            setFeedback(result.message);
            setErrorMessage("");
            return;
          }

          setErrorMessage("");
          setFeedback("");
          setErrorMessage(result.message || fallbackErrorMessage);
        })
        .catch(() => {
          setFeedback("");
          setErrorMessage(fallbackErrorMessage);
        });
    });
  }

  return (
    <div className="border-b border-amber-500/20 bg-[linear-gradient(90deg,rgba(120,53,15,0.42),rgba(37,99,235,0.14))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">
            ⚠️ Пожалуйста, подтвердите ваш email, чтобы вовремя получать важные уведомления о ваших сделках.
          </p>
          <p className="mt-1 text-xs text-amber-100/75">
            Текущий адрес: {email}
          </p>
          {feedback ? (
            <p className="mt-1 text-xs text-emerald-200">{feedback}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-1 text-xs text-red-200">{errorMessage}</p>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={handleSendVerificationEmail}
          disabled={isPending}
          className="ml-0 h-9 shrink-0 rounded-xl border border-yellow-500 bg-transparent px-4 text-sm font-semibold text-yellow-400 shadow-none hover:bg-yellow-500/10 lg:ml-4"
        >
          {isPending ? "Отправляем..." : "Отправить письмо"}
        </Button>
      </div>
    </div>
  );
}