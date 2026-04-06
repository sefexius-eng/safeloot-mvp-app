"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CurrencyCode = "USD" | "RUB" | "UAH" | "EUR" | "KZT" | "PLN";

interface CurrencyDefinition {
  code: CurrencyCode;
  symbol: string;
  rate: number;
  locale: string;
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (basePriceInUsd: string | number) => string;
  currencies: CurrencyDefinition[];
}

const CURRENCY_STORAGE_KEY = "safeloot:currency";

const CURRENCIES: CurrencyDefinition[] = [
  { code: "USD", symbol: "$", rate: 1, locale: "en-US" },
  { code: "RUB", symbol: "₽", rate: 93, locale: "ru-RU" },
  { code: "UAH", symbol: "₴", rate: 39, locale: "uk-UA" },
  { code: "EUR", symbol: "€", rate: 0.92, locale: "de-DE" },
  { code: "KZT", symbol: "₸", rate: 445, locale: "kk-KZ" },
  { code: "PLN", symbol: "zł", rate: 3.98, locale: "pl-PL" },
];

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getCurrencyDefinition(currency: CurrencyCode) {
  return CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];
}

function formatCurrencyValue(currency: CurrencyCode, basePriceInUsd: string | number) {
  const numericPrice = Number(basePriceInUsd);

  if (!Number.isFinite(numericPrice)) {
    return `${getCurrencyDefinition(currency).symbol}0.00`;
  }

  const currentCurrency = getCurrencyDefinition(currency);
  const localizedValue = new Intl.NumberFormat(currentCurrency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericPrice * currentCurrency.rate);

  if (currentCurrency.code === "PLN") {
    return `${localizedValue} ${currentCurrency.symbol}`;
  }

  if (currentCurrency.code === "USD" || currentCurrency.code === "EUR") {
    return `${currentCurrency.symbol}${localizedValue}`;
  }

  return `${localizedValue} ${currentCurrency.symbol}`;
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

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency: handleSetCurrency,
        formatPrice,
        currencies: CURRENCIES,
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