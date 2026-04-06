"use client";

import { useState, useTransition } from "react";

import {
  deleteProductAdmin,
  releaseUserHoldBalance,
  toggleBanUser,
} from "@/app/admin/actions";
import {
  adminApproveWithdrawal,
  adminRejectWithdrawal,
} from "@/app/actions/withdraw";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminToggleBanButtonProps {
  userId: string;
  currentStatus: boolean;
}

interface AdminReleaseHoldButtonProps {
  userId: string;
  canRelease: boolean;
}

interface AdminDeleteProductButtonProps {
  productId: string;
  canDelete: boolean;
}

interface AdminWithdrawalActionButtonsProps {
  withdrawalId: string;
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

export function AdminWithdrawalActionButtons({
  withdrawalId,
}: AdminWithdrawalActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: "approve" | "reject") {
    const confirmationMessage =
      action === "approve"
        ? "Подтвердить, что заявка действительно выплачена?"
        : "Отклонить заявку и вернуть средства пользователю?";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setError(null);

    startTransition(() => {
      const actionRequest =
        action === "approve"
          ? adminApproveWithdrawal(withdrawalId)
          : adminRejectWithdrawal(withdrawalId);

      void actionRequest
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось обработать заявку на вывод.");
          }
        })
        .catch(() => {
          setError("Не удалось обработать заявку на вывод.");
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          onClick={() => handleAction("approve")}
          disabled={isPending}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-white shadow-none hover:bg-emerald-500"
        >
          {isPending ? "Загрузка..." : "Выплачено"}
        </Button>
        <Button
          type="button"
          onClick={() => handleAction("reject")}
          disabled={isPending}
          className="h-10 rounded-xl bg-rose-600 px-4 text-white shadow-none hover:bg-rose-500"
        >
          {isPending ? "Загрузка..." : "Отклонить"}
        </Button>
      </div>
      {error ? <p className="max-w-[260px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

export function AdminReleaseHoldButton({
  userId,
  canRelease,
}: AdminReleaseHoldButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!canRelease) {
      return;
    }

    if (!window.confirm("Перенести все средства из холда в доступный баланс пользователя?")) {
      return;
    }

    setError(null);

    startTransition(() => {
      void releaseUserHoldBalance(userId)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Не удалось снять холд пользователя.");
          }
        })
        .catch(() => {
          setError("Не удалось снять холд пользователя.");
        });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={!canRelease || isPending}
        className={cn(
          "h-10 rounded-xl px-4 shadow-none",
          canRelease
            ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            : "bg-zinc-800 text-zinc-500 hover:translate-y-0 hover:bg-zinc-800",
        )}
      >
        {isPending ? "Загрузка..." : "Снять холд"}
      </Button>
      {error ? <p className="max-w-[220px] text-right text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}