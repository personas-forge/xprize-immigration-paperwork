const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US");

// Placeholder for non-finite / non-number input. These helpers are leaf display
// formatters consuming AI-sourced scores with no upstream validation boundary;
// they degrade safely rather than throw or emit "$NaN"/"NaN%" (ADR 0003).
const INVALID = "—";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatCurrency(value: number, decimals = true): string {
  if (!finite(value)) return INVALID;
  return (decimals ? usd : usd0).format(value);
}

export function formatSignedCurrency(value: number): string {
  if (!finite(value)) return INVALID;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${usd.format(Math.abs(value))}`;
}

export function formatNumber(value: number): string {
  if (!finite(value)) return INVALID;
  return number.format(value);
}

export function formatPercent(value: number, decimals = 0): string {
  if (!finite(value)) return INVALID;
  return `${value.toFixed(decimals)}%`;
}
