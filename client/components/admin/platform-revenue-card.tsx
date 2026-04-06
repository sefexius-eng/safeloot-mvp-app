"use client";

import { useCurrency } from "@/components/providers/currency-provider";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlatformRevenueCardProps {
  revenue: number;
}

export function PlatformRevenueCard({ revenue }: PlatformRevenueCardProps) {
  const { formatPrice } = useCurrency();

  return (
    <Card className="border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_36%),linear-gradient(180deg,rgba(8,47,73,0.38),rgba(15,23,42,0.92))] shadow-[0_24px_70px_rgba(16,185,129,0.16)]">
      <CardHeader className="gap-2 p-5">
        <CardDescription className="text-emerald-100/70">
          Доход платформы
        </CardDescription>
        <CardTitle className="text-3xl text-white">
          {formatPrice(revenue)}
        </CardTitle>
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">
          Чистый заработок с комиссий 5%
        </p>
      </CardHeader>
    </Card>
  );
}