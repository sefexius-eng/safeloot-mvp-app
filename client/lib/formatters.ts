export function formatCurrency(amount: number) {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount)
    ? Math.max(0, numericAmount)
    : 0;

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(safeAmount);
}