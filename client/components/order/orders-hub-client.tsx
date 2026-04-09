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
      <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
        <p className="text-sm font-semibold tracking-[0.24em] uppercase text-emerald-700">
          Orders Hub
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl md:leading-[1.05]">
          Мои заказы
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Отдельный центр управления покупками и продажами: ищите нужный заказ, фильтруйте по статусу и переходите прямо в чат сделки.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {accountEmail ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600">
              Аккаунт: <span className="ml-2 font-semibold text-slate-900">{accountEmail}</span>
            </span>
          ) : null}
          <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600">
            Покупок: <span className="ml-2 font-semibold text-slate-900">{purchases.length}</span>
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600">
            Продаж: <span className="ml-2 font-semibold text-slate-900">{sales.length}</span>
          </span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="orders-search" className="text-sm font-semibold text-slate-900">
              Поиск по названию товара или ID заказа
            </label>
            <Input
              id="orders-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: Steam Wallet или cmn123..."
              className="mt-3 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:min-w-[220px]">
            Найдено: <span className="font-semibold text-slate-900">{filteredOrders.length}</span>
            <span className="ml-2 text-slate-500">из {activeOrders.length}</span>
          </div>
        </div>

        <div className="mt-6 inline-flex flex-wrap rounded-[1.25rem] border border-slate-200 bg-slate-50 p-1">
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
                    ? "border border-emerald-300 bg-emerald-500 text-emerald-950 shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
                    : "text-slate-600 hover:bg-white hover:text-slate-900",
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
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
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
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm leading-7 text-slate-600">
              <p className="text-base font-semibold text-slate-900">{emptyState.title}</p>
              <p className="mt-2 max-w-2xl">{emptyState.description}</p>
              {emptyState.actionHref && emptyState.actionLabel ? (
                <Link
                  href={emptyState.actionHref}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-100 px-5 text-sm font-semibold text-emerald-900 shadow-[0_16px_40px_rgba(16,185,129,0.14)] transition hover:-translate-y-0.5 hover:bg-emerald-200"
                >
                  {emptyState.actionLabel}
                </Link>
              ) : null}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_56px_rgba(15,23,42,0.08)] transition hover:border-emerald-300"
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
                  <span className="text-sm text-slate-600">Заказ #{order.id}</span>
                  <span className="text-sm text-slate-600">
                    Создан {formatOrderDate(order.createdAt)}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-slate-900">{order.productTitle}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                      <span>
                        {counterpartyLabel}:{" "}
                        <span className="font-medium text-slate-900">{order.counterparty.name}</span>
                      </span>
                      <span>Обновлен {formatOrderDate(order.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="text-sm text-slate-600">
                      Сумма заказа:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatStoredOrderAmount(order.price, order.currency)}
                      </span>
                    </div>
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-100 px-5 text-sm font-semibold text-emerald-900 shadow-[0_16px_40px_rgba(16,185,129,0.14)] transition hover:-translate-y-0.5 hover:bg-emerald-200"
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