export type CurrencyCode = "USD" | "RUB" | "UAH" | "EUR" | "KZT" | "PLN";

export interface CurrencyDefinition {
  code: CurrencyCode;
  symbol: string;
  rate: number;
}

export const CURRENCIES: CurrencyDefinition[] = [
  { code: "USD", symbol: "$", rate: 1 },
  { code: "RUB", symbol: "₽", rate: 93 },
  { code: "UAH", symbol: "₴", rate: 39 },
  { code: "EUR", symbol: "€", rate: 0.92 },
  { code: "KZT", symbol: "₸", rate: 445 },
  { code: "PLN", symbol: "zł", rate: 3.98 },
];

export const STRIPE_TOPUP_CURRENCIES = ["USD", "EUR", "UAH"] as const;

export function getCurrencyDefinition(currency: CurrencyCode) {
  return CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];
}

export function normalizeCurrencyCode(
  value?: string | null,
  fallback: CurrencyCode = "UAH",
): CurrencyCode {
  const normalizedValue = value?.trim().toUpperCase() ?? "";

  return isCurrencyCode(normalizedValue) ? normalizedValue : fallback;
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((item) => item.code === value);
}

export function isStripeTopupCurrency(value: string): value is CurrencyCode {
  return STRIPE_TOPUP_CURRENCIES.includes(value as (typeof STRIPE_TOPUP_CURRENCIES)[number]);
}

export function getStripeTopupCurrency(preferredCurrency: CurrencyCode) {
  return isStripeTopupCurrency(preferredCurrency) ? preferredCurrency : "USD";
}

export function convertUsdToCurrencyAmount(amountInUsd: number, currency: CurrencyCode) {
  const currencyDefinition = getCurrencyDefinition(currency);

  return Math.round((amountInUsd * currencyDefinition.rate + Number.EPSILON) * 100) / 100;
}

export function formatStoredOrderAmount(
  amountInUsd: string | number,
  currencyValue?: string | null,
) {
  const currency = normalizeCurrencyCode(currencyValue);
  const currencyDefinition = getCurrencyDefinition(currency);
  const numericAmount = Number(amountInUsd);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const roundedAmount = Math.round(safeAmount * currencyDefinition.rate);
  const formattedAmount = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, roundedAmount));

  if (currency === "USD" || currency === "EUR") {
    return `${currencyDefinition.symbol}${formattedAmount}`;
  }

  return `${formattedAmount} ${currencyDefinition.symbol}`;
}