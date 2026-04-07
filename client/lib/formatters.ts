export function formatCurrency(amount: number) {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount)
    ? Math.max(0, numericAmount)
    : 0;

  return safeAmount.toFixed(2);
}