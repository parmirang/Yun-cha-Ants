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

/**
 * 카운터에서의 하루는 **24시간**이다. 봉 길이에 쓰는 근무일(8시간)과 다른 값이니
 * 섞지 말 것 — 봉은 "며칠치 노동인가"를, 카운터는 "얼마나 긴 시간인가"를 그린다.
 */
const SECONDS_PER_DAY = 24 * 3600;

/**
 * 초 → "HH:MM:SS". 24시간을 넘기면 앞에 날을 세워 "1일 02:34:56"으로 적는다 —
 * 시 자리만 늘리면 "134:02:11" 같은 숫자가 나오는데 한눈에 안 읽힌다.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / SECONDS_PER_DAY);
  const hours = Math.floor((safe % SECONDS_PER_DAY) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return days > 0 ? `${days}일 ${clock}` : clock;
}

/**
 * 같은 시간을 문장에 넣을 때의 표기 — "1일 3시간", "3시간 12분", "12분", "40초".
 *
 * 큰 단위 둘까지만 남긴다. 초까지 읽어주면 바로 위 카운터를 소리 내어 따라 읽는
 * 꼴이 되고, 문장은 카운터가 못 주는 "그래서 얼마나 긴데?"를 맡아야 한다.
 */
export function formatSpanWords(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / SECONDS_PER_DAY);
  const hours = Math.floor((safe % SECONDS_PER_DAY) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;

  return `${safe % 60}초`;
}
