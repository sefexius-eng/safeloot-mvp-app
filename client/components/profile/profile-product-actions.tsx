"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteProduct,
  toggleProductVisibility,
} from "@/app/actions/product";

interface ProfileProductActionsProps {
  productId: string;
  isActive: boolean;
  onDeleted: (productId: string) => void;
  onVisibilityChanged: (productId: string, isActive: boolean) => void;
}

export function ProfileProductActions({
  productId,
  isActive,
  onDeleted,
  onVisibilityChanged,
}: ProfileProductActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"delete" | "toggle" | null>(null);

  function handleDelete() {
    if (!window.confirm("Точно удалить?")) {
      return;
    }

    setError(null);

    startTransition(() => {
      setPendingAction("delete");

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
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  function handleToggleVisibility() {
    setError(null);

    startTransition(() => {
      setPendingAction("toggle");

      void toggleProductVisibility(productId)
        .then((result) => {
          if (!result.ok || typeof result.isActive !== "boolean") {
            setError(result.message ?? "Не удалось изменить видимость товара.");
            return;
          }

          onVisibilityChanged(productId, result.isActive);
          router.refresh();
        })
        .catch(() => {
          setError("Не удалось изменить видимость товара.");
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleToggleVisibility}
          disabled={isPending}
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "toggle"
            ? "Обновляем..."
            : isActive
              ? "🙈 Скрыть"
              : "👁️ Показать"}
        </button>
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
          {pendingAction === "delete" ? "Удаляем..." : "🗑️ Удалить"}
        </button>
      </div>

      {error ? <p className="max-w-[260px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}