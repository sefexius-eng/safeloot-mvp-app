"use client";

import { useState, useTransition } from "react";

import {
  deleteProductAdmin,
  toggleBanUser,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminToggleBanButtonProps {
  userId: string;
  currentStatus: boolean;
}

interface AdminDeleteProductButtonProps {
  productId: string;
  canDelete: boolean;
}

export function AdminToggleBanButton({
  userId,
  currentStatus,
}: AdminToggleBanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = currentStatus ? "Разбанить" : "Забанить";

  function handleClick() {
    setError(null);

    startTransition(() => {
      void toggleBanUser(userId, currentStatus)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось обновить статус пользователя.");
          }
        })
        .catch(() => {
          setError("Не удалось обновить статус пользователя.");
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "h-10 rounded-xl px-4 shadow-none",
          currentStatus
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-rose-600 text-white hover:bg-rose-500",
        )}
      >
        {isPending ? "Загрузка..." : label}
      </Button>
      {error ? <p className="max-w-[220px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

export function AdminDeleteProductButton({
  productId,
  canDelete,
}: AdminDeleteProductButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    startTransition(() => {
      void deleteProductAdmin(productId)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось удалить товар.");
          }
        })
        .catch(() => {
          setError("Не удалось удалить товар.");
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={!canDelete || isPending}
        className={cn(
          "h-10 rounded-xl px-4 shadow-none",
          canDelete
            ? "bg-rose-600 text-white hover:bg-rose-500"
            : "bg-zinc-800 text-zinc-500 hover:translate-y-0 hover:bg-zinc-800",
        )}
      >
        {isPending ? "Загрузка..." : "Удалить"}
      </Button>
      {error ? <p className="max-w-[220px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}