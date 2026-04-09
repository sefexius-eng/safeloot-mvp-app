"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useCurrency } from "@/components/providers/currency-provider";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  convertCurrencyAmount,
  normalizeCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency-config";

const PRICE_FILTER_DEBOUNCE_MS = 350;

function normalizeNumberInput(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function formatPriceFilterValue(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  const roundedValue = Math.round((value + Number.EPSILON) * 100) / 100;

  return roundedValue
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function convertPriceFilterValue(
  value: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return "";
  }

  return formatPriceFilterValue(
    convertCurrencyAmount(numericValue, fromCurrency, toCurrency),
  );
}

interface CatalogFiltersProps {
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialSelectedCurrency?: string;
}

export function CatalogFilters({
  initialMinPrice = "",
  initialMaxPrice = "",
  initialSelectedCurrency,
}: CatalogFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, currencySymbol, isHydrated } = useCurrency();
  const sort = searchParams.get("sort") ?? "newest";
  const online = searchParams.get("online") === "true";
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(() =>
    normalizeCurrencyCode(initialSelectedCurrency, currency),
  );

  const pushWithUpdates = useCallback(
    (updates: Record<string, string | boolean | null | undefined>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (
          value === null ||
          value === undefined ||
          value === "" ||
          value === false ||
          value === "newest"
        ) {
          nextParams.delete(key);
          continue;
        }

        nextParams.set(key, value === true ? "true" : String(value));
      }

      const nextQuery = nextParams.toString();
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!isHydrated || priceCurrency === currency) {
      return;
    }

    const hasActivePriceFilters = minPrice !== "" || maxPrice !== "";

    if (!hasActivePriceFilters) {
      return;
    }

    pushWithUpdates({
      minPrice: minPrice
        ? convertPriceFilterValue(minPrice, priceCurrency, currency)
        : "",
      maxPrice: maxPrice
        ? convertPriceFilterValue(maxPrice, priceCurrency, currency)
        : "",
      selectedCurrency: currency,
    });
  }, [
    currency,
    isHydrated,
    maxPrice,
    minPrice,
    priceCurrency,
    pushWithUpdates,
  ]);

  useEffect(() => {
    const currentMin = searchParams.get("minPrice") ?? "";
    const currentMax = searchParams.get("maxPrice") ?? "";
    const currentCurrency = normalizeCurrencyCode(
      searchParams.get("selectedCurrency"),
      "USD",
    );
    const hasActivePriceFilters = minPrice !== "" || maxPrice !== "";

    if (
      minPrice === currentMin &&
      maxPrice === currentMax &&
      ((!hasActivePriceFilters && !searchParams.get("selectedCurrency")) ||
        currentCurrency === priceCurrency)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      pushWithUpdates({
        minPrice,
        maxPrice,
        selectedCurrency: hasActivePriceFilters ? priceCurrency : null,
      });
    }, PRICE_FILTER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [maxPrice, minPrice, priceCurrency, pushWithUpdates, searchParams]);

  function handleMinPriceChange(value: string) {
    setPriceCurrency(currency);
    setMinPrice(normalizeNumberInput(value));
  }

  function handleMaxPriceChange(value: string) {
    setPriceCurrency(currency);
    setMaxPrice(normalizeNumberInput(value));
  }

  return (
    <section className="rounded-[1.85rem] border border-white/10 bg-white/5 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] uppercase text-zinc-500">
            Фильтры каталога
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Настройте выдачу под себя
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-400">
            Диапазон цены работает в выбранной валюте и автоматически пересчитывается при её смене в шапке.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_180px_180px_auto] xl:items-end">
          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-500">
              Сортировка
            </span>
            <Select
              value={sort}
              onChange={(event) => pushWithUpdates({ sort: event.target.value })}
              className="!h-11 !rounded-2xl !border-white/10 !bg-white/5 !text-zinc-100"
            >
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Сначала дешевые</option>
              <option value="price_desc">Сначала дорогие</option>
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-500">
              Цена от
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-300">
                {currencySymbol}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={minPrice}
                onChange={(event) => handleMinPriceChange(event.target.value)}
                placeholder="0"
                className="!h-11 !rounded-2xl !border-white/10 !bg-white/5 !text-zinc-100 !placeholder:text-zinc-500"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-500">
              Цена до
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-300">
                {currencySymbol}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={maxPrice}
                onChange={(event) => handleMaxPriceChange(event.target.value)}
                placeholder="100"
                className="!h-11 !rounded-2xl !border-white/10 !bg-white/5 !text-zinc-100 !placeholder:text-zinc-500"
              />
            </div>
          </label>

          <label className="flex h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 shadow-[0_12px_24px_rgba(0,0,0,0.12)]">
            <input
              type="checkbox"
              checked={online}
              onChange={(event) => pushWithUpdates({ online: event.target.checked })}
              className="h-4 w-4 rounded border-white/10 bg-transparent accent-emerald-500"
            />
            Только продавцы онлайн
          </label>
        </div>
      </div>
    </section>
  );
}