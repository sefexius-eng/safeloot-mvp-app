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

  function handleSendVerificationEmail() {
    setFeedback("");
    setErrorMessage("");

    startTransition(() => {
      void sendVerificationEmailAction().then((result) => {
        if (result.ok) {
          setFeedback(result.message);
          setErrorMessage("");
          return;
        }

        setFeedback("");
        setErrorMessage(result.message);
      });
    });
  }

  return (
    <div className="border-b border-amber-500/20 bg-[linear-gradient(90deg,rgba(120,53,15,0.42),rgba(37,99,235,0.14))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">
            ⚠️ Пожалуйста, подтвердите ваш email, чтобы получать уведомления и продавать товары.
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
          className="h-10 shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)] hover:bg-amber-300"
        >
          {isPending ? "Отправляем..." : "Отправить письмо"}
        </Button>
      </div>
    </div>
  );
}