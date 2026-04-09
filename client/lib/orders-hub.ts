export type OrdersHubTab = "purchases" | "sales";

export type OrdersHubStatus =
  | "PENDING"
  | "PAID"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "REFUNDED"
  | "CANCELLED";

export type OrdersHubStatusFilter =
  | "ALL"
  | "PENDING"
  | "ACTIVE"
  | "DISPUTED"
  | "COMPLETED"
  | "CANCELLED";

export interface OrdersHubOrderParty {
  id: string;
  name: string;
  email: string | null;
}

export interface OrdersHubOrderItem {
  id: string;
  status: OrdersHubStatus;
  price: string;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  productId: string;
  productTitle: string;
  counterparty: OrdersHubOrderParty;
}

export const ORDER_HUB_TABS: Array<{ value: OrdersHubTab; label: string }> = [
  { value: "purchases", label: "Мои покупки" },
  { value: "sales", label: "Мои продажи" },
];

export const ORDER_HUB_STATUS_FILTERS: Array<{
  value: OrdersHubStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "Все" },
  { value: "PENDING", label: "Ожидают оплаты" },
  { value: "ACTIVE", label: "Активные" },
  { value: "DISPUTED", label: "Спор" },
  { value: "COMPLETED", label: "Завершенные" },
  { value: "CANCELLED", label: "Отмененные" },
];

export function getOrderPartyDisplayName(input: {
  name?: string | null;
  email?: string | null;
  id?: string | null;
}) {
  return (
    input.name?.trim() ||
    input.email?.split("@")[0] ||
    input.id?.trim() ||
    "Пользователь"
  );
}

export function getOrdersHubStatusLabel(status: OrdersHubStatus) {
  switch (status) {
    case "PENDING":
      return "Ожидает оплаты";
    case "PAID":
      return "Активен";
    case "DELIVERED":
      return "Передан";
    case "COMPLETED":
      return "Завершен";
    case "DISPUTED":
      return "Спор";
    case "REFUNDED":
      return "Возврат";
    case "CANCELLED":
      return "Отменен";
    default:
      return status;
  }
}

export function getOrdersHubStatusClassName(status: OrdersHubStatus) {
  switch (status) {
    case "PENDING":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "PAID":
      return "border-sky-300 bg-sky-50 text-sky-900";
    case "DELIVERED":
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
    case "COMPLETED":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "DISPUTED":
      return "border-red-300 bg-red-50 text-red-900";
    case "REFUNDED":
      return "border-yellow-300 bg-yellow-50 text-yellow-900";
    case "CANCELLED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-900";
  }
}

export function doesOrderMatchStatusFilter(
  status: OrdersHubStatus,
  filter: OrdersHubStatusFilter,
) {
  switch (filter) {
    case "ALL":
      return true;
    case "PENDING":
      return status === "PENDING";
    case "ACTIVE":
      return status === "PAID" || status === "DELIVERED";
    case "DISPUTED":
      return status === "DISPUTED";
    case "COMPLETED":
      return status === "COMPLETED";
    case "CANCELLED":
      return status === "CANCELLED" || status === "REFUNDED";
    default:
      return true;
  }
}

export function doesOrderMatchSearch(order: OrdersHubOrderItem, rawQuery: string) {
  const normalizedQuery = rawQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const normalizedIdQuery = normalizedQuery.startsWith("#")
    ? normalizedQuery.slice(1)
    : normalizedQuery;

  return (
    order.id.toLowerCase().includes(normalizedIdQuery) ||
    order.productTitle.toLowerCase().includes(normalizedQuery)
  );
}

export function getOrdersHubCounterpartyLabel(tab: OrdersHubTab) {
  return tab === "purchases" ? "Продавец" : "Покупатель";
}