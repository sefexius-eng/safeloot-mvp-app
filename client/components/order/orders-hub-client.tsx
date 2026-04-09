"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatStoredOrderAmount } from "@/lib/currency-config";
import {
  doesOrderMatchSearch,
  doesOrderMatchStatusFilter,
  getOrdersHubCounterpartyLabel,
  getOrdersHubStatusClassName,
  getOrdersHubStatusLabel,
  ORDER_HUB_STATUS_FILTERS,
  ORDER_HUB_TABS,
  type OrdersHubOrderItem,
  type OrdersHubStatusFilter,
  type OrdersHubTab,
} from "@/lib/orders-hub";
import { cn } from "@/lib/utils";

interface OrdersHubClientProps {
  purchases: OrdersHubOrderItem[];
  sales: OrdersHubOrderItem[];
  accountEmail?: string | null;
}

const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatOrderDate(value: string) {
  return ORDER_DATE_FORMATTER.format(new Date(value));
}

function getEmptyStateCopy(tab: OrdersHubTab, hasAnyOrders: boolean) {
  if (hasAnyOrders) {
    return {
      title: "Ничего не найдено",
      description:
        "Попробуйте изменить поисковый запрос или сбросить фильтр по статусу.",
      actionHref: null,
      actionLabel: null,
    };
  }

  if (tab === "purchases") {
    return {
      title: "Покупок пока нет",
      description:
        "Когда вы оформите первую сделку, она появится здесь вместе со статусом и быстрым переходом в чат заказа.",
      actionHref: "/catalog",
      actionLabel: "Перейти в каталог",
    };
  }

  return {
    title: "Продаж пока нет",
    description:
      "Здесь будут отображаться сделки по вашим лотам, когда покупатели начнут оформлять заказы.",
    actionHref: "/sell",
    actionLabel: "Управлять лотами",
  };
}

export function OrdersHubClient({ purchases, sales, accountEmail }: OrdersHubClientProps) {
  const [activeTab, setActiveTab] = useState<OrdersHubTab>("purchases");
  const [statusFilter, setStatusFilter] = useState<OrdersHubStatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const activeOrders = activeTab === "purchases" ? purchases : sales;
  const filteredOrders = activeOrders.filter(
    (order) =>
      doesOrderMatchStatusFilter(order.status, statusFilter) &&
      doesOrderMatchSearch(order, deferredQuery),
  );
  const counterpartyLabel = getOrdersHubCounterpartyLabel(activeTab);
  const emptyState = getEmptyStateCopy(activeTab, activeOrders.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,200,83,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,94,48,0.18),transparent_36%),rgba(9,9,11,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-[#8bffb3]">
          Orders Hub
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-[1.05]">
          Мои заказы
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
          Отдельный центр управления покупками и продажами: ищите нужный заказ, фильтруйте по статусу и переходите прямо в чат сделки.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {accountEmail ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Аккаунт: <span className="ml-2 font-semibold text-white">{accountEmail}</span>
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
            Покупок: <span className="ml-2 font-semibold text-white">{purchases.length}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
            Продаж: <span className="ml-2 font-semibold text-white">{sales.length}</span>
          </span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,27,34,0.92),rgba(13,17,23,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur md:p-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="orders-search" className="text-sm font-semibold text-zinc-200">
              Поиск по названию товара или ID заказа
            </label>
            <Input
              id="orders-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: Steam Wallet или cmn123..."
              className="mt-3"
            />
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400 lg:min-w-[220px]">
            Найдено: <span className="font-semibold text-white">{filteredOrders.length}</span>
            <span className="ml-2 text-zinc-500">из {activeOrders.length}</span>
          </div>
        </div>

        <div className="mt-6 inline-flex flex-wrap rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-1">
          {ORDER_HUB_TABS.map((tab) => {
            const tabCount = tab.value === "purchases" ? purchases.length : sales.length;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "rounded-[1rem] px-4 py-2.5 text-sm font-semibold transition",
                  activeTab === tab.value
                    ? "border border-[#00C853]/30 bg-[#00C853] text-[#03130a] shadow-[0_10px_30px_rgba(0,200,83,0.2)]"
                    : "text-zinc-400 hover:bg-white/[0.08] hover:text-white",
                )}
                aria-pressed={activeTab === tab.value}
              >
                {tab.label}
                <span className="ml-2 text-xs opacity-70">{tabCount}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ORDER_HUB_STATUS_FILTERS.map((filter) => {
            const filterCount = activeOrders.filter((order) =>
              doesOrderMatchStatusFilter(order.status, filter.value),
            ).length;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition",
                  statusFilter === filter.value
                    ? "border-[#00C853]/35 bg-[#00C853]/12 text-[#c8ffd9]"
                    : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/15 hover:bg-white/[0.07] hover:text-white",
                )}
                aria-pressed={statusFilter === filter.value}
              >
                {filter.label}
                <span className="ml-2 text-xs opacity-70">{filterCount}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-sm leading-7 text-zinc-400">
              <p className="text-base font-semibold text-white">{emptyState.title}</p>
              <p className="mt-2 max-w-2xl">{emptyState.description}</p>
              {emptyState.actionHref && emptyState.actionLabel ? (
                <Link
                  href={emptyState.actionHref}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-[#00C853]/35 bg-[#00C853] px-5 text-sm font-semibold text-[#03130a] shadow-[0_16px_40px_rgba(0,200,83,0.24)] transition hover:-translate-y-0.5 hover:bg-[#00A344]"
                >
                  {emptyState.actionLabel}
                </Link>
              ) : null}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,200,83,0.12),transparent_36%),linear-gradient(180deg,rgba(22,27,34,0.94),rgba(13,17,23,0.98))] p-5 shadow-[0_20px_56px_rgba(0,0,0,0.28)] transition hover:border-[#00C853]/30"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold",
                      getOrdersHubStatusClassName(order.status),
                    )}
                  >
                    {getOrdersHubStatusLabel(order.status)}
                  </span>
                  <span className="text-sm text-zinc-500">Заказ #{order.id}</span>
                  <span className="text-sm text-zinc-500">
                    Создан {formatOrderDate(order.createdAt)}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-white">{order.productTitle}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
                      <span>
                        {counterpartyLabel}:{" "}
                        <span className="font-medium text-zinc-200">{order.counterparty.name}</span>
                      </span>
                      <span>Обновлен {formatOrderDate(order.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="text-sm text-zinc-400">
                      Сумма заказа:{" "}
                      <span className="font-semibold text-white">
                        {formatStoredOrderAmount(order.price, order.currency)}
                      </span>
                    </div>
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#00C853]/35 bg-[#00C853] px-5 text-sm font-semibold text-[#03130a] shadow-[0_16px_40px_rgba(0,200,83,0.24)] transition hover:-translate-y-0.5 hover:bg-[#00A344]"
                    >
                      Перейти к заказу
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}