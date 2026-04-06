"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  currencies: CurrencyDefinition[];
  currentRate: number;
  currencySymbol: string;
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

function formatCurrencyValue(currency: CurrencyCode, basePriceInUsd: string | number) {
  const numericPrice = Number(basePriceInUsd);
  const currentCurrency = getCurrencyDefinition(currency);

  if (!Number.isFinite(numericPrice)) {
    return attachCurrencySymbol(currentCurrency, "0");
  }

  const convertedValue = numericPrice * currentCurrency.rate;
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

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);

    if (!savedCurrency) {
      return;
    }

    if (CURRENCIES.some((item) => item.code === savedCurrency)) {
      setCurrency(savedCurrency as CurrencyCode);
    }
  }, []);

  function handleSetCurrency(nextCurrency: CurrencyCode) {
    setCurrency(nextCurrency);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
  }

  function formatPrice(basePriceInUsd: string | number) {
    return formatCurrencyValue(currency, basePriceInUsd);
  }

  const currentCurrencyDefinition = getCurrencyDefinition(currency);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency: handleSetCurrency,
        formatPrice,
        currencies: CURRENCIES,
        currentRate: currentCurrencyDefinition.rate,
        currencySymbol: currentCurrencyDefinition.symbol,
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