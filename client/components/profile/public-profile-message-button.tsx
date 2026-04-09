"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startDirectConversation } from "@/app/actions/chat";
import { Button } from "@/components/ui/button";

interface PublicProfileMessageButtonProps {
  targetUserId: string;
  isAuthenticated: boolean;
}

export function PublicProfileMessageButton({
  targetUserId,
  isAuthenticated,
}: PublicProfileMessageButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    startTransition(() => {
      void startDirectConversation(targetUserId)
        .then((result) => {
          if (!result.ok || !result.conversationId) {
            if (result.requiresLogin) {
              router.push("/login");
              return;
            }

            setError(result.message ?? "Не удалось открыть диалог.");
            return;
          }

          router.push(`/chats/${result.conversationId}`);
        })
        .catch(() => {
          setError("Не удалось открыть диалог.");
        });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={handleClick}
        disabled={isPending}
        className="h-11 rounded-2xl border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)] hover:bg-white/20"
      >
        {isPending ? (
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
            Открываем чат...
          </span>
        ) : (
          "💬 Написать сообщение"
        )}
      </Button>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}