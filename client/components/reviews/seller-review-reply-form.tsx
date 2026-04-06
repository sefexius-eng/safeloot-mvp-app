"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { replyToReview } from "@/app/actions/reviews";
import { Textarea } from "@/components/ui/textarea";

const MAX_REVIEW_REPLY_LENGTH = 1000;

interface SellerReviewReplyFormProps {
  reviewId: string;
}

export function SellerReviewReplyForm({
  reviewId,
}: SellerReviewReplyFormProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setError(null);
    setIsExpanded(true);
  }

  function handleCancel() {
    setError(null);
    setText("");
    setIsExpanded(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void replyToReview(reviewId, text)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось отправить ответ.");
            return;
          }

          setText("");
          setIsExpanded(false);
          router.refresh();
        })
        .catch(() => {
          setError("Не удалось отправить ответ.");
        });
    });
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20"
      >
        Ответить
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4"
    >
      <p className="text-sm font-semibold text-white">Ответ продавца</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
        HTML будет автоматически удалён перед сохранением
      </p>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_REVIEW_REPLY_LENGTH}
        placeholder="Напишите ответ покупателю..."
        className="mt-3 min-h-28 border-white/10 bg-zinc-950/70 text-zinc-100 shadow-none placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-zinc-950 focus:ring-orange-500/10"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Отправляем..." : "Отправить"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Отмена
        </button>
        <span className="text-xs text-zinc-500">
          {text.trim().length}/{MAX_REVIEW_REPLY_LENGTH}
        </span>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </form>
  );
}
