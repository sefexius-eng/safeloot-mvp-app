"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProduct } from "@/app/actions/product";

interface ProfileProductActionsProps {
  productId: string;
  onDeleted: (productId: string) => void;
}

export function ProfileProductActions({
  productId,
  onDeleted,
}: ProfileProductActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Точно удалить?")) {
      return;
    }

    setError(null);

    startTransition(() => {
      void deleteProduct(productId)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось удалить товар.");
            return;
          }

          onDeleted(productId);
          router.refresh();
        })
        .catch(() => {
          setError("Не удалось удалить товар.");
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/product/${productId}/edit`)}
          disabled={isPending}
          className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ✏️ Редактировать
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-xl border border-red-500/20 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Удаляем..." : "🗑️ Удалить"}
        </button>
      </div>

      {error ? <p className="max-w-[260px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}