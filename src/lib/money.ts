export function formatUgx(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.abs(rounded));
  return `${sign}UGX ${formatted}`;
}
