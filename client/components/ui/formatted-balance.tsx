"use client";

import { useCurrency } from "@/components/providers/currency-provider";

interface FormattedBalanceProps {
  amount: string | number;
  className?: string;
}

export function FormattedBalance({ amount, className }: FormattedBalanceProps) {
  const { formatBalance } = useCurrency();

  return <span className={className}>{formatBalance(amount)}</span>;
}