const wonFormatter = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number): string {
  return `${wonFormatter.format(Math.round(value))}원`;
}

export function formatSignedWon(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${wonFormatter.format(Math.round(Math.abs(value)))}원`;
}

export function formatPercent(rate: number): string {
  const sign = rate > 0 ? "+" : rate < 0 ? "-" : "";
  return `${sign}${(Math.abs(rate) * 100).toFixed(2)}%`;
}

/** "5000" → 5000, "5,000만" 같은 입력은 숫자만 남긴다. */
export function parseNumericInput(raw: string): number {
  const digits = raw.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(digits);

  return Number.isFinite(parsed) ? parsed : 0;
}
