// Validated categorical order (dataviz reference palette, light mode).
export const SERIES = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
} as const;

export const INK = {
  primary: "#0F172A",
  secondary: "#475569",
  muted: "#64748B",
  grid: "#E2E8F0",
  surface: "#FFFFFF",
} as const;

/** Round a max value up to a "nice" axis top and return evenly spaced ticks. */
export function niceTicks(maxValue: number, count = 4): number[] {
  const max = Math.max(maxValue, 1);
  const rawStep = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const niceStep = step < 1 ? 1 : step;
  const top = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += niceStep) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
