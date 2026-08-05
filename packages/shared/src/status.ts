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
  const raw = hourlyWage > 0 ? (Math.abs(pnl) / hourlyWage) * 3600 : 0;
  // **1원이라도 움직였으면 0초로 떨어뜨리지 않는다.** 반올림에 0으로 깎이면 mood는
  // loss인데 시간이 0이라 "0초 만큼 더 일해야 해"가 뜬다 (본전 분기로도 안 빠진다).
  const seconds = raw > 0 ? Math.max(1, Math.round(raw)) : 0;

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
 * 하루치 노동(8시간). 봉 길이와 카운터 큰 글씨의 "출근 N번"이 이걸 쓴다.
 *
 * **날을 세는 건 큰 글씨뿐이다.** 아래 시계는 날을 안 센다 — 둘 다 날을 세면
 * 같은 값이 두 번 다르게 적히고("출근 132번" 밑에 "43일"), 자를 맞춰 숫자를 같게
 * 해놔도 이번엔 같은 말을 두 번 하는 꼴이 된다. 시계는 누적 시간만 맡는다.
 */
export const WORK_HOURS_PER_DAY = 8;
const WORK_DAY_SECONDS = WORK_HOURS_PER_DAY * 3600;

/**
 * 카운터 아래 작게 붙는 시계 줄 — `총 1,054시간 50분 34초 만큼 돈 잃었다`.
 *
 * **날로 접지 않고 시간을 끝까지 누적한다.** 여기서 "1,054시간"은 잠자는 시간까지
 * 흐르는 절대시간이 아니라 **일한 시간**이다 — 손익을 시급으로 나눈 값이라 곧
 * "이만큼의 노동에 해당하는 돈"이고, 그래서 문장이 "돈 벌었다 / 돈 잃었다"로 끝난다.
 *
 * 날 자리를 두지 않는 게 핵심이다. 위 큰 글씨가 이미 "출근 N번"으로 날을 세고 있어서,
 * 여기까지 날을 세면 한 화면에 날짜가 두 번 적힌다 — 자가 다르면 숫자가 어긋나 보이고
 * (예전 "출근 132번 / 43일 22:50:34"), 자를 맞추면 같은 말을 두 번 한다.
 * 큰 글씨는 "며칠치 노동인가", 시계는 "몇 시간인가"를 맡아 겹치지 않는다.
 *
 * 본전은 셀 시간도 벌거나 잃은 돈도 없으므로 null — 호출부가 줄을 통째로 뺀다.
 */
export function formatTotalWorkLine(totalSeconds: number, mood: Mood): string | null {
  if (mood === "even") return null;

  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const verb = mood === "loss" ? "돈 잃었다" : "돈 벌었다";

  // 시·분·초를 늘 셋 다 적는다 — 값에 따라 자리가 사라지면 1초마다 폭이 널뛴다.
  return `총 ${withCommas(hours)}시간 ${pad(minutes)}분 ${pad(seconds)}초 만큼 ${verb}`;
}

/*
 * 예전엔 `formatSpanWords()`가 같은 시간을 "43일 22시간"으로 적어 문장에 넣었다.
 * 24시간짜리 "일"이라 뒤에 붙는 출근 은유("안 나가도 돼")와 자가 어긋나서
 * 아래 `formatWorkSpanWords()`로 갈아치웠다 — **표기 함수를 둘 두지 않는다.**
 * 남겨두면 다음 사람이 아무거나 집어서 같은 버그가 돌아온다.
 */

/**
 * 손익 시간을 **노동의 단위**로 적는다 — "23분", "3시간 20분", "출근 17번".
 *
 * 카운터 큰 글씨가 쓰는 표기다. "43일"로 적으면 그 뒤에 붙는 출근·휴가 은유
 * ("안 나가도 돼")와 자가 어긋난다 — 그 43일은 24시간짜리라 실제로는 131번 출근이다.
 * 여기서 근무일로 접어 **문장과 숫자가 같은 자**를 보게 한다.
 *
 * 1근무일(8시간)을 넘기면 "출근 N번"이 되고, 그 경계는 문구 구간(`nudgeTier`)의
 * 세 번째 경계와 정확히 같다. 상단 문구가 "나가다" 은유를 3구간부터만 쓰는 근거다.
 *
 * **버림이다.** "그만큼 안 나가도 된다"고 말하는 줄이라 실제로 채운 횟수만 센다 —
 * 반올림하면 131.9번을 132번이라 부르며 못 쉬는 하루를 얹어준다.
 */
export function formatWorkSpanWords(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));

  if (safe >= WORK_DAY_SECONDS) {
    return `출근 ${withCommas(Math.floor(safe / WORK_DAY_SECONDS))}번`;
  }

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;

  return `${safe}초`;
}

/** 천 단위 콤마. `toLocaleString`을 안 쓰는 건 OG 카드가 도는 런타임을 안 가리기 위해서다. */
function withCommas(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
