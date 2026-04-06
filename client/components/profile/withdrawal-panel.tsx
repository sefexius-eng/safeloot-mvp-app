"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { requestWithdrawal } from "@/app/actions/withdraw";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getWithdrawalStatusMeta,
  type WithdrawalListItem,
} from "@/lib/withdrawals";

const BALANCE_REFRESH_EVENT = "safeloot:balances-refresh";

interface WithdrawalPanelProps {
  isAuthenticated: boolean;
  availableBalance: string;
  withdrawals: WithdrawalListItem[];
}

function formatAmount(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(numericValue);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WithdrawalPanel({
  isAuthenticated,
  availableBalance,
  withdrawals,
}: WithdrawalPanelProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("USDT");
  const [details, setDetails] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const availableBalanceValue = useMemo(() => Number(availableBalance), [availableBalance]);
  const amountValue = Number(amount);
  const isAmountValid = Number.isFinite(amountValue) && amountValue > 0;
  const exceedsBalance = isAmountValid && amountValue > availableBalanceValue;

  function resetForm() {
    setAmount("");
    setMethod("USDT");
    setDetails("");
    setErrorMessage("");
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isAmountValid) {
      setErrorMessage("Введите корректную сумму вывода.");
      return;
    }

    if (exceedsBalance) {
      setErrorMessage("Сумма вывода не должна превышать доступный баланс.");
      return;
    }

    if (!details.trim()) {
      setErrorMessage("Укажите реквизиты для вывода.");
      return;
    }

    startTransition(() => {
      void requestWithdrawal(amountValue, method, details)
        .then((result) => {
          if (!result.ok) {
            setErrorMessage(result.message ?? "Не удалось создать заявку на вывод.");
            return;
          }

          setSuccessMessage("Заявка на вывод создана и отправлена на проверку.");
          setIsModalOpen(false);
          resetForm();
          window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
          router.refresh();
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось создать заявку на вывод.",
          );
        });
    });
  }

  const detailsPlaceholder =
    method === "Card"
      ? "Введите номер карты или IBAN"
      : "Введите адрес кошелька TRC20";

  return (
    <section className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Payouts
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Заявки на вывод средств
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            Вывод доступен только из available balance. Заявка уходит администратору, а история всех выплат сохраняется ниже.
          </p>
        </div>

        {isAuthenticated ? (
          <Button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setIsModalOpen(true);
            }}
            disabled={availableBalanceValue <= 0}
            className="h-11 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(5,150,105,0.28)] hover:bg-emerald-500"
          >
            Вывести средства
          </Button>
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-zinc-950/95 p-6 text-zinc-50 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-white">
                  Новая заявка на вывод
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Доступно к выводу: {formatAmount(availableBalance)} USDT.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Закрыть окно вывода"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Сумма
                </p>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.00000001"
                  min="0"
                  max={availableBalance}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Например, 125.50"
                  className="mt-3 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                  disabled={isPending}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Максимум: {formatAmount(availableBalance)} USDT
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Способ вывода
                </p>
                <Select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="mt-3 border-white/10 bg-white/5 text-zinc-100 focus:border-orange-500/45 focus:bg-white/8"
                  disabled={isPending}
                >
                  <option value="USDT">USDT</option>
                  <option value="Card">Card</option>
                </Select>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Реквизиты
                </p>
                <Input
                  type="text"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder={detailsPlaceholder}
                  className="mt-3 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/45 focus:bg-white/8"
                  disabled={isPending}
                />
              </div>

              {exceedsBalance ? (
                <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
                  Сумма вывода не должна превышать доступный баланс.
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-[1.25rem] border border-red-500/15 bg-red-500/10 p-4 text-sm leading-7 text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isPending}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200 shadow-none hover:bg-white/10 sm:w-auto"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !isAmountValid || exceedsBalance || !details.trim()}
                  className="h-12 w-full rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(5,150,105,0.35)] hover:bg-emerald-500 sm:w-auto"
                >
                  {isPending ? "Создаем заявку..." : "Отправить"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {!isAuthenticated ? (
        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
          Войдите в аккаунт продавца, чтобы создавать заявки на вывод средств и видеть их историю.
        </div>
      ) : (
        <>
          {successMessage ? (
            <div className="mt-6 rounded-[1.25rem] border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          {withdrawals.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-400">
              У вас пока нет заявок на вывод. Создайте первую заявку, чтобы отправить available balance на внешний кошелек или карту.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {withdrawals.map((withdrawal) => {
                const statusMeta = getWithdrawalStatusMeta(withdrawal.status);

                return (
                  <article
                    key={withdrawal.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                          <span className="text-sm text-zinc-500">
                            {formatDate(withdrawal.createdAt)}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              Сумма
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {formatAmount(withdrawal.amount)} USDT
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              Метод
                            </p>
                            <p className="mt-2 text-sm font-medium text-zinc-200">
                              {withdrawal.paymentMethod}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="max-w-xl min-w-0 md:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Реквизиты
                        </p>
                        <p className="mt-2 break-all text-sm leading-7 text-zinc-300">
                          {withdrawal.paymentDetails}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}