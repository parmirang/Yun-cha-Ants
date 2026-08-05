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

const KOREAN_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"] as const;
const KOREAN_UNITS = ["", "십", "백", "천"] as const;

/** 1~9999를 한글로. 1000 → "천", 1200 → "천이백", 3456 → "삼천사백오십육" */
function koreanUnderTenThousand(value: number): string {
  const digits = String(value);

  return [...digits].reduce((text, char, index) => {
    const digit = Number(char);
    if (digit === 0) return text;

    const unit = KOREAN_UNITS[digits.length - 1 - index] ?? "";
    // 십·백·천 앞의 "일"은 적지 않는다 — "일십이백"이 아니라 "십", "이백"이다.
    const head = digit === 1 && unit !== "" ? "" : (KOREAN_DIGITS[digit] ?? "");

    return `${text}${head}${unit}`;
  }, "");
}

const GROUP_UNITS = ["", "만", "억", "조"] as const;

/**
 * 금액을 한글 읽기로. 12,500,000 → "천이백오십만원"
 *
 * 입력칸 옆에 붙여 **자릿수를 세지 않고도 읽히게** 한다 — 연봉은 만원 단위라 한 자리만
 * 밀리면 열 배가 어긋나고, 평단가는 0이 여섯 개씩 붙어 눈으로 세기 어렵다.
 *
 * **자릿수를 읽는 게 아니라 금액을 읽는다.** 연봉칸의 "12,000"을 자릿수대로 읽어
 * "만 이천"이라 적고 뒤에 "만원"을 붙이면 "만 이천 만원"이 되는데, 실제로는
 * 1억 2천만원이다. 그래서 만원 단위는 곱해서 넘기고(`annualSalary`) 여기서
 * 억·만으로 끊어 읽는다.
 *
 * 띄어쓰기는 맞춤법을 따라 **만·억 묶음 사이만 띄운다** ("일억 이천만원").
 * 단위 명사 '원'은 원칙상 띄지만, 좁은 입력칸 옆에 붙는 곁줄이라 붙여 적는다.
 */
export function koreanWon(amount: number): string {
  if (!Number.isFinite(amount) || amount < 1) return "";

  const groups: string[] = [];
  let rest = Math.floor(amount);
  let group = 0;

  while (rest > 0 && group < GROUP_UNITS.length) {
    const chunk = rest % 10_000;

    if (chunk > 0) {
      const unit = GROUP_UNITS[group] ?? "";
      // 1만은 "일만"이 아니라 "만"이다. 억·조는 "일억"·"일조"로 적는다.
      groups.unshift(chunk === 1 && unit === "만" ? unit : `${koreanUnderTenThousand(chunk)}${unit}`);
    }

    rest = Math.floor(rest / 10_000);
    group += 1;
  }

  // 조를 넘기면 읽어줘도 못 읽는다 — 그럴 땐 숫자만 남긴다.
  return rest > 0 || groups.length === 0 ? "" : `${groups.join(" ")}원`;
}
