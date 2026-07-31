/**
 * 연봉 → 시급 환산.
 *
 * 입력은 언제나 **세전(계약) 연봉**이고, 화면과 손익 환산이 쓰는 값은
 * **실수령 시급**이다. 통장에 안 들어오는 돈으로 나누면 "몇 시간 더 일해야
 * 본전인지"가 체감과 어긋나기 때문이다.
 *
 * 공제는 **1인 가구(본인 기본공제만) · 비과세 수당 없음** 기준의 추정치다.
 * 부양가족·비과세 식대·연말정산 결과에 따라 실제 실수령액은 달라진다.
 * 근로기준법상 월 소정근로시간(주휴 포함) 209시간을 기준으로 나눈다.
 */
export const WORK_HOURS_PER_MONTH = 209;
export const WORK_HOURS_PER_YEAR = WORK_HOURS_PER_MONTH * 12;

/**
 * 요율 기준 연도. 4대보험 요율과 국민연금 상·하한은 해마다 바뀌므로
 * 갱신할 곳은 아래 상수들뿐이다.
 */
export const RATE_YEAR = 2026;

/** 국민연금 근로자 부담 (사업장 9.5%의 절반) */
const NATIONAL_PENSION_RATE = 0.0475;
/** 기준소득월액 하한·상한 (2026.7 ~ 2027.6) */
const NATIONAL_PENSION_MIN_MONTHLY = 410_000;
const NATIONAL_PENSION_MAX_MONTHLY = 6_590_000;
/** 건강보험 근로자 부담 (7.19%의 절반) */
const HEALTH_INSURANCE_RATE = 0.03595;
/** 장기요양보험료 = 건강보험료 × 12.95% */
const LONG_TERM_CARE_RATE = 0.1295;
/** 고용보험(실업급여) 근로자 부담 */
const EMPLOYMENT_INSURANCE_RATE = 0.009;
/** 지방소득세 = 소득세 × 10% */
const LOCAL_INCOME_TAX_RATE = 0.1;
/** 본인 기본공제 */
const BASIC_DEDUCTION = 1_500_000;

/** 종합소득세 과세표준 구간 (2023년 귀속 이후) */
const TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, progressiveDeduction: 0 },
  { upTo: 50_000_000, rate: 0.15, progressiveDeduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, progressiveDeduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, progressiveDeduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, progressiveDeduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.4, progressiveDeduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, progressiveDeduction: 35_940_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45, progressiveDeduction: 65_940_000 },
] as const;

export interface NetSalaryBreakdown {
  /** 세전 연봉 (원) */
  gross: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  /** 4대보험 근로자 부담 합계 */
  socialInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  /** 소득세 + 지방소득세 */
  tax: number;
  /** 실수령 연봉 (원) */
  net: number;
}

const EMPTY_BREAKDOWN: NetSalaryBreakdown = {
  gross: 0,
  nationalPension: 0,
  healthInsurance: 0,
  longTermCare: 0,
  employmentInsurance: 0,
  socialInsurance: 0,
  incomeTax: 0,
  localIncomeTax: 0,
  tax: 0,
  net: 0,
};

/** 총급여액 구간별 근로소득공제 (한도 2,000만원) */
function earnedIncomeDeduction(gross: number): number {
  let deduction: number;

  if (gross <= 5_000_000) deduction = gross * 0.7;
  else if (gross <= 15_000_000) deduction = 3_500_000 + (gross - 5_000_000) * 0.4;
  else if (gross <= 45_000_000) deduction = 7_500_000 + (gross - 15_000_000) * 0.15;
  else if (gross <= 100_000_000) deduction = 12_000_000 + (gross - 45_000_000) * 0.05;
  else deduction = 14_750_000 + (gross - 100_000_000) * 0.02;

  return Math.min(deduction, 20_000_000);
}

/** 과세표준 → 산출세액 (누진공제 방식) */
function computeTax(taxBase: number): number {
  if (taxBase <= 0) return 0;

  for (const bracket of TAX_BRACKETS) {
    if (taxBase <= bracket.upTo) {
      return Math.max(0, taxBase * bracket.rate - bracket.progressiveDeduction);
    }
  }

  return 0;
}

/** 근로소득세액공제 — 공제율로 계산한 값과 총급여 구간별 한도 중 작은 쪽 */
function earnedIncomeTaxCredit(computedTax: number, gross: number): number {
  const credit =
    computedTax <= 1_300_000 ? computedTax * 0.55 : 715_000 + (computedTax - 1_300_000) * 0.3;

  let cap: number;
  if (gross <= 33_000_000) cap = 740_000;
  else if (gross <= 70_000_000) cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000) cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);

  return Math.min(credit, cap);
}

/**
 * 세전 연봉에서 4대보험과 소득세를 뺀 실수령 연봉을 추정한다.
 * 4대보험은 월 단위로 부과되므로 월 보험료를 구해 12배 한다.
 */
export function estimateNetAnnualSalary(annualSalary: number): NetSalaryBreakdown {
  if (!Number.isFinite(annualSalary) || annualSalary <= 0) return EMPTY_BREAKDOWN;

  const gross = annualSalary;
  const monthly = gross / 12;

  // 국민연금은 기준소득월액(천원 단위 절사)에 상·하한이 걸린다.
  const pensionBase = Math.min(
    NATIONAL_PENSION_MAX_MONTHLY,
    Math.max(NATIONAL_PENSION_MIN_MONTHLY, Math.floor(monthly / 1_000) * 1_000),
  );
  const monthlyHealth = Math.floor(monthly * HEALTH_INSURANCE_RATE);

  const nationalPension = Math.floor(pensionBase * NATIONAL_PENSION_RATE) * 12;
  const healthInsurance = monthlyHealth * 12;
  const longTermCare = Math.floor(monthlyHealth * LONG_TERM_CARE_RATE) * 12;
  const employmentInsurance = Math.floor(monthly * EMPLOYMENT_INSURANCE_RATE) * 12;
  const socialInsurance =
    nationalPension + healthInsurance + longTermCare + employmentInsurance;

  // 4대보험료는 전액 소득공제된다 (국민연금 = 연금보험료공제, 나머지 = 특별소득공제).
  const taxBase = Math.max(
    0,
    gross - earnedIncomeDeduction(gross) - BASIC_DEDUCTION - socialInsurance,
  );
  const computedTax = computeTax(taxBase);
  const incomeTax = Math.max(0, computedTax - earnedIncomeTaxCredit(computedTax, gross));
  const localIncomeTax = incomeTax * LOCAL_INCOME_TAX_RATE;
  const tax = incomeTax + localIncomeTax;

  return {
    gross,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    socialInsurance,
    incomeTax,
    localIncomeTax,
    tax,
    net: gross - socialInsurance - tax,
  };
}

/** 세전 시급. 비교용으로만 쓰고 손익 환산에는 쓰지 않는다. */
export function grossHourlyWage(annualSalary: number): number {
  if (!Number.isFinite(annualSalary) || annualSalary <= 0) return 0;
  return annualSalary / WORK_HOURS_PER_YEAR;
}

/**
 * 수입이 없는 사람의 환산 기준.
 *
 * 연봉을 0으로 저장한 프로필("나는 그냥 무일푼이야")은 나눌 시급이 없다.
 * 0으로 나누면 시간이 무한대가 되고 `calcPositionStatus`가 그걸 0초로 떨어뜨려
 * 카운터가 통째로 죽는다 — 앱에 남는 게 없어진다.
 *
 * 그래서 **최저임금으로 일했다고 치고** 환산한다. 최저임금도 세전이므로
 * 연봉으로 되돌려 넣어주면 4대보험·소득세 공제를 타는 경로가 하나로 유지된다
 * (여기서 시급을 직접 만들어 끼우면 실수령 환산을 우회하게 된다).
 *
 * 최저임금은 해마다 바뀐다 — `RATE_YEAR`와 함께 갱신할 것.
 */
export const MINIMUM_HOURLY_WAGE = 10_320;

/** 최저임금으로 일했을 때의 세전 연봉 */
export const MINIMUM_ANNUAL_SALARY = MINIMUM_HOURLY_WAGE * WORK_HOURS_PER_YEAR;

/** 무일푼 프로필인가 (연봉 0). 화면에 "최저시급 기준"을 적을지 판단할 때 쓴다. */
export function isBroke(annualSalary: number): boolean {
  return !(annualSalary > 0);
}

/** 손익 환산에 실제로 쓰이는 세전 연봉. 무일푼이면 최저임금 연봉으로 대신한다. */
export function effectiveAnnualSalary(annualSalary: number): number {
  return isBroke(annualSalary) ? MINIMUM_ANNUAL_SALARY : annualSalary;
}

/** 실수령 시급. 손익을 시간으로 바꿀 때 나누는 값이 이것이다. */
export function netHourlyWage(annualSalary: number): number {
  return (
    estimateNetAnnualSalary(effectiveAnnualSalary(annualSalary)).net / WORK_HOURS_PER_YEAR
  );
}
