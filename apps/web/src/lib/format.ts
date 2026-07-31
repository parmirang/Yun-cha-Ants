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

/**
 * 입력창에 치는 도중의 숫자에 천 단위 쉼표를 넣는다. "74800" → "74,800".
 *
 * 쉼표는 **정수부에만** 붙이고 소수점 아래는 건드리지 않는다 — 평단가는 소수가
 * 나온다(74,833.33). 치는 중인 "74800."의 마침표도 살려둬야 다음 자리를 이어 칠 수 있다.
 *
 * 값은 이 형태 그대로 state에 담아도 된다. `parseNumericInput()`이 쉼표를 털어내므로
 * 계산 쪽은 아무것도 달라지지 않는다.
 *
 * @param maxIntegerDigits 정수부 자릿수 상한. `<input maxLength>`로는 이 일을 못 한다 —
 *   쉼표까지 글자 수로 세어버려서 자리가 찰수록 칠 수 있는 숫자가 줄어든다.
 */
export function formatNumericInput(raw: string, maxIntegerDigits?: number): string {
  const [head = "", ...rest] = raw.replace(/[^0-9.]/g, "").split(".");

  // 앞의 0은 떼어낸다 — 안 떼면 "0074800"이 "0,074,800"으로 묶여 읽기 어렵다.
  // 마지막 한 자리는 남겨서 "0"이나 "0.5"를 칠 수 있게 한다.
  const digits = head.replace(/^0+(?=\d)/, "");
  const capped = maxIntegerDigits === undefined ? digits : digits.slice(0, maxIntegerDigits);
  const grouped = capped.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return rest.length > 0 ? `${grouped}.${rest.join("")}` : grouped;
}

/** "5000" → 5000, "5,000만" 같은 입력은 숫자만 남긴다. */
export function parseNumericInput(raw: string): number {
  const digits = raw.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(digits);

  return Number.isFinite(parsed) ? parsed : 0;
}
