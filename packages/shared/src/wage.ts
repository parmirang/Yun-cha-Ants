/**
 * 근로기준법상 월 소정근로시간(주휴 포함) 209시간을 기준으로 시급을 환산한다.
 * 세전 연봉 기준이며, 실수령액 기준으로 바꾸려면 여기 한 곳만 고치면 된다.
 */
export const WORK_HOURS_PER_MONTH = 209;
export const WORK_HOURS_PER_YEAR = WORK_HOURS_PER_MONTH * 12;

export function hourlyWageFromAnnualSalary(annualSalary: number): number {
  if (!Number.isFinite(annualSalary) || annualSalary <= 0) return 0;
  return annualSalary / WORK_HOURS_PER_YEAR;
}
