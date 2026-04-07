"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { formatCurrency } from "@/lib/formatters";

export type CurrencyCode = "USD" | "RUB" | "UAH" | "EUR" | "KZT" | "PLN";

interface CurrencyDefinition {
  code: CurrencyCode;
  symbol: string;
  rate: number;
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (basePriceInUsd: string | number) => string;
  formatBalance: (basePriceInUsd: string | number) => string;
  currencies: CurrencyDefinition[];
  currentRate: number;
  currencySymbol: string;
  isHydrated: boolean;
}

const CURRENCY_STORAGE_KEY = "safeloot:currency";

const CURRENCIES: CurrencyDefinition[] = [
  { code: "USD", symbol: "$", rate: 1 },
  { code: "RUB", symbol: "₽", rate: 93 },
  { code: "UAH", symbol: "₴", rate: 39 },
  { code: "EUR", symbol: "€", rate: 0.92 },
  { code: "KZT", symbol: "₸", rate: 445 },
  { code: "PLN", symbol: "zł", rate: 3.98 },
];

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getCurrencyDefinition(currency: CurrencyCode) {
  return CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];
}

function attachCurrencySymbol(currency: CurrencyDefinition, formattedValue: string) {
  if (currency.code === "PLN") {
    return `${formattedValue} ${currency.symbol}`;
  }

  if (currency.code === "USD" || currency.code === "EUR") {
    return `${currency.symbol}${formattedValue}`;
  }

  return `${formattedValue} ${currency.symbol}`;
}

function formatFixedCurrencyValue(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number(formatCurrency(amount)))
    .replace(/,/g, " ");
}

function formatCurrencyValue(
  currency: CurrencyCode,
  basePriceInUsd: string | number,
  options?: {
    clampNegative?: boolean;
    forceTwoDecimals?: boolean;
  },
) {
  const numericPrice = Number(basePriceInUsd);
  const currentCurrency = getCurrencyDefinition(currency);

  if (!Number.isFinite(numericPrice)) {
    return attachCurrencySymbol(
      currentCurrency,
      options?.forceTwoDecimals ? formatCurrency(0) : "0",
    );
  }

  const safePrice = options?.clampNegative ? Math.max(0, numericPrice) : numericPrice;
  const convertedValue = safePrice * currentCurrency.rate;

  if (options?.forceTwoDecimals) {
    return attachCurrencySymbol(
      currentCurrency,
      formatFixedCurrencyValue(convertedValue),
    );
  }

  const roundedValue = Math.round((convertedValue + Number.EPSILON) * 100) / 100;
  const hasFraction = Math.abs(roundedValue % 1) > Number.EPSILON;
  const localizedValue = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(roundedValue)
    .replace(/,/g, " ");

  return attachCurrencySymbol(currentCurrency, localizedValue);
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);

    if (!savedCurrency) {
      setIsHydrated(true);
      return;
    }

    if (CURRENCIES.some((item) => item.code === savedCurrency)) {
      setCurrency(savedCurrency as CurrencyCode);
    }

    setIsHydrated(true);
  }, []);

  function handleSetCurrency(nextCurrency: CurrencyCode) {
    setCurrency(nextCurrency);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
  }

  function formatPrice(basePriceInUsd: string | number) {
    return formatCurrencyValue(currency, basePriceInUsd);
  }

  function formatBalance(basePriceInUsd: string | number) {
    return formatCurrencyValue(currency, basePriceInUsd, {
      clampNegative: true,
      forceTwoDecimals: true,
    });
  }

  const currentCurrencyDefinition = getCurrencyDefinition(currency);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency: handleSetCurrency,
        formatPrice,
        formatBalance,
        currencies: CURRENCIES,
        currentRate: currentCurrencyDefinition.rate,
        currencySymbol: currentCurrencyDefinition.symbol,
        isHydrated,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider.");
  }

  return context;
}