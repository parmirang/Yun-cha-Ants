import { BREAKEVEN_STAGE, STAGE_COUNT } from "./status.js";

/**
 * 화면 연출(봉 길이·배경 날씨·말풍선 톤)을 결정하는 값들.
 *
 * 배경 레벨은 **개미 50단계를 그대로 재사용한다.** 새 축을 만들면 개미 껍질 색과
 * 배경 날씨가 따로 놀 수 있다 — 같은 stage에서 파생되어야 한 몸으로 움직인다.
 */

/** -3 폭풍 … 0 잠잠 … +3 폭죽 연발 */
export type SceneLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3;

interface LevelRange {
  level: SceneLevel;
  /** 이 레벨이 차지하는 stage 구간 (양끝 포함) */
  min: number;
  max: number;
}

/**
 * 본전 근처(레벨 0)를 ±4%로 넓게 비워둔 건 의도적이다.
 * 좁게 잡으면 ±2% 언저리에서 비가 왔다 폭죽이 터졌다 하며 깜빡인다.
 */
const LEVEL_RANGES: readonly LevelRange[] = [
  { level: -3, min: 0, max: 10 }, // 수익률 -30% 이하
  { level: -2, min: 11, max: 17 }, // -28% ~ -16%
  { level: -1, min: 18, max: 22 }, // -14% ~ -6%
  { level: 0, min: 23, max: 27 }, //  -4% ~ +4%
  { level: 1, min: 28, max: 32 }, //  +6% ~ +14%
  { level: 2, min: 33, max: 39 }, // +16% ~ +28%
  { level: 3, min: 40, max: STAGE_COUNT - 1 }, // +30% 이상
];

export function sceneLevelFromStage(stage: number): SceneLevel {
  for (const range of LEVEL_RANGES) {
    if (stage <= range.max) return range.level;
  }
  return 3;
}

/**
 * 레벨을 대표하는 stage — 구간의 한가운데.
 *
 * **공유 링크가 stage를 되돌릴 때 쓴다.** 링크에는 50단계가 아니라 이 7레벨만 싣는데
 * (`share.ts` 참고), 화면은 개미 껍질 색과 눈금을 그리려면 stage가 필요하다. 구간
 * 한가운데를 골라야 `sceneLevelFromStage()`에 다시 넣었을 때 같은 레벨로 돌아오고,
 * 그래야 개미 색과 배경 날씨가 계속 한 몸으로 움직인다.
 */
export function stageFromSceneLevel(level: SceneLevel): number {
  const range = LEVEL_RANGES.find((candidate) => candidate.level === level);
  if (!range) return BREAKEVEN_STAGE;

  return Math.floor((range.min + range.max) / 2);
}

/**
 * 경계에 딱 걸친 stage가 1초마다 오가면 배경이 깜빡인다.
 * 현재 레벨 구간에서 **한 단계 더 벗어나야** 다음 레벨로 넘어가게 잡아둔다.
 */
export function sceneLevelWithHysteresis(
  stage: number,
  previous: SceneLevel | null,
): SceneLevel {
  const next = sceneLevelFromStage(stage);
  if (previous === null || next === previous) return next;

  const held = LEVEL_RANGES.find((range) => range.level === previous);
  if (held && stage >= held.min - 1 && stage <= held.max + 1) return previous;

  return next;
}

/*
 * 봉 길이 구간(0.5일 ~ 20일)은 `WORK_HOURS_PER_DAY`(8시간)에서 나온다 —
 * 카운터 큰 글씨의 "출근 N번", 그 아래 시계의 날 자리와 **같은 자**다
 * (status.ts에 정의). 이 앱에서 하루는 어디서나 8시간이다.
 */

/** 이 이하는 봉이 자라지 않는다 — 1:1 정사각형 그대로 (0.5 근무일) */
export const CANDLE_MIN_HOURS = 4;
/** 여기서 봉 길이가 멈춘다 (20 근무일 = 한 달치). 시간 숫자는 계속 커진다. */
export const CANDLE_MAX_HOURS = 160;
/** 봉 폭 대비 최대 높이 배수 */
export const CANDLE_MAX_SCALE = 12;

/**
 * 손익 시간 → 봉 높이(봉 폭의 배수). 1 = 정사각형, 12 = 최대.
 *
 * 로그를 쓰는 건 실제 분포 때문이다. 연봉 5,000만원 기준으로 27만원 손실이 16시간,
 * 270만원 손실이 160시간이다 — 선형으로 깔면 대부분이 바닥에 붙어 차이가 안 보인다.
 */
export function candleScale(seconds: number): number {
  const hours = seconds / 3600;
  if (!Number.isFinite(hours) || hours <= CANDLE_MIN_HOURS) return 1;

  const span = Math.log(CANDLE_MAX_HOURS / CANDLE_MIN_HOURS);
  const t = Math.min(1, Math.log(hours / CANDLE_MIN_HOURS) / span);

  return 1 + t * (CANDLE_MAX_SCALE - 1);
}
