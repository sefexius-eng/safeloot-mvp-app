import type { Prisma } from "@prisma/client";

export const WITHDRAWAL_METHOD_OPTIONS = [
  {
    value: "USDT TRC20",
    label: "USDT TRC20",
  },
  {
    value: "Банковская карта",
    label: "Банковская карта",
  },
] as const;

export const WITHDRAWAL_STATUS_VALUES = [
  "PENDING",
  "COMPLETED",
  "REJECTED",
] as const;

type WithdrawalBadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info";

export type WithdrawalMethod = (typeof WITHDRAWAL_METHOD_OPTIONS)[number]["value"];
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUS_VALUES)[number];
export type WithdrawalListItem = {
  id: string;
  amount: string;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function normalizeWithdrawalMethod(method: string): WithdrawalMethod | null {
  const normalizedMethod = method.trim().toLowerCase();

  if (normalizedMethod === "usdt" || normalizedMethod === "usdt trc20") {
    return "USDT TRC20";
  }

  if (
    normalizedMethod === "card" ||
    normalizedMethod === "банковская карта" ||
    normalizedMethod === "bank card"
  ) {
    return "Банковская карта";
  }

  return null;
}

export function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return WITHDRAWAL_STATUS_VALUES.includes(value as WithdrawalStatus);
}

export function getWithdrawalStatusMeta(status: string): {
  label: string;
  variant: WithdrawalBadgeVariant;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Выплачено",
        variant: "success",
      };
    case "REJECTED":
      return {
        label: "Отклонено",
        variant: "destructive",
      };
    case "PENDING":
    default:
      return {
        label: "На рассмотрении",
        variant: "warning",
      };
  }
}

function formatWithdrawalAmount(value: Prisma.Decimal) {
  return value.toFixed(2);
}

export function mapWithdrawalListItem(withdrawal: {
  id: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): WithdrawalListItem {
  return {
    id: withdrawal.id,
    amount: formatWithdrawalAmount(withdrawal.amount),
    paymentMethod: withdrawal.paymentMethod,
    paymentDetails: withdrawal.paymentDetails,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt.toISOString(),
    updatedAt: withdrawal.updatedAt.toISOString(),
  };
}