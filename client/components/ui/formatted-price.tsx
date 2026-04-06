"use client";

import { useCurrency } from "@/components/providers/currency-provider";

interface FormattedPriceProps {
  amount: string | number;
  className?: string;
}

export function FormattedPrice({ amount, className }: FormattedPriceProps) {
  const { formatPrice } = useCurrency();

  return <span className={className}>{formatPrice(amount)}</span>;
}