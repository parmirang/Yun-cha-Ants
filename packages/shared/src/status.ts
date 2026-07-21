import type { Position } from "./position.js";

/**
 * 엔트의 상태 단계. 0 = 완전히 시듦(대손실), 49 = 무성함(대수익).
 * 25단계가 본전이고, 한 단계는 수익률 2%p에 해당한다 (표현 범위 -50% ~ +48%).
 */
export const STAGE_COUNT = 50;
export const BREAKEVEN_STAGE = 25;
export const STAGE_STEP_RATE = 0.02;

export function stageFromReturnRate(returnRate: number): number {
  if (!Number.isFinite(returnRate)) return BREAKEVEN_STAGE;
  const raw = Math.round(BREAKEVEN_STAGE + returnRate / STAGE_STEP_RATE);
  return Math.min(STAGE_COUNT - 1, Math.max(0, raw));
}

export type Mood = "loss" | "profit" | "even";

export interface PositionStatus {
  /** 매수 원금 (원) */
  costBasis: number;
  /** 현재 평가금액 (원) */
  marketValue: number;
  /** 평가손익 (원). 음수면 손실 */
  pnl: number;
  /** 수익률. 0.05 = +5% */
  returnRate: number;
  mood: Mood;
  stage: number;
  /**
   * 손익을 시급으로 환산한 시간(초). 항상 양수이며 의미는 mood에 달렸다.
   * loss  → 이만큼 더 일해야 본전
   * profit → 이만큼 안 일해도 되는 여유
   */
  seconds: number;
}

export function calcPositionStatus(
  position: Position,
  price: number,
  hourlyWage: number,
): PositionStatus {
  const costBasis = position.avgPrice * position.quantity;
  const marketValue = price * position.quantity;
  const pnl = marketValue - costBasis;
  const returnRate = costBasis > 0 ? pnl / costBasis : 0;

  // 시급이 0이면 시간 환산이 불가능하므로 0초로 둔다 (온보딩 전 상태).
  const seconds = hourlyWage > 0 ? Math.round((Math.abs(pnl) / hourlyWage) * 3600) : 0;

  return {
    costBasis,
    marketValue,
    pnl,
    returnRate,
    mood: pnl > 0 ? "profit" : pnl < 0 ? "loss" : "even",
    stage: stageFromReturnRate(returnRate),
    seconds,
  };
}

/** 초 → "HH:MM:SS". 100시간을 넘으면 시 자리가 자연스럽게 늘어난다. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
