import type { Mood } from "@yca/shared";

import { nudgeTier } from "./nudge-lines";

/**
 * 개미가 말풍선에 띄우는 한마디 (1인칭 — 개미가 제 처지를 말한다).
 *
 * **일해야 하는 시간의 크기**로 세기를 정한다 — 그 시간은 손익을 유저가 입력한 시급으로
 * 나눈 값이라, 곧 "내 노동시간 몇 시간짜리 손익인가"다. 그래서 며칠치면 "회사에 뼈를
 * 묻어야 해", 몇 분치면 "금방 벌어"로 갈린다. 손익 방향(부정·긍정)만 보고 표정 짓던 걸
 * 시간축으로 폈다. 구간은 상단 카운터·하단 한마디와 **같은 축**이라 `nudgeTier`를 그대로 쓴다.
 *
 * 세 surface가 같은 시간축을 쓰지만 **목소리가 다르다** — 상단은 "{시간} 만큼 __"을
 * 끝맺는 서술어, 하단은 화면 밑에서 등 떠미는 배경 문장, 이쪽은 개미의 1인칭 혼잣말이다.
 * 개미의 껍질 색과 배경 날씨는 여전히 수익률 레벨(`sceneLevelFromStage`)을 따른다 —
 * 얼굴은 손익률로, 말은 노동시간으로 반응한다.
 *
 * 이 파일의 글자가 곧 임베드하는 픽셀 폰트의 서브셋 범위다
 * (`pnpm --filter @yca/web font`이 이 파일을 읽어서 굽는다).
 * 문구를 고치면 폰트를 다시 구워야 새 글자가 깨지지 않는다.
 */

/** 구간이 낮은 것부터. 배열 길이는 `nudgeTier`가 내는 구간 수(5)와 같아야 한다. */
const LOSS_SPEECH: readonly (readonly string[])[] = [
  ["금방 벌어", "이 정도는 괜찮아", "커피 한 잔 참으면 돼"],
  ["오늘 야근각이네", "반나절은 더 일해야겠다", "퇴근이 멀어졌어"],
  ["하루를 통째로 갈아야 해", "이럴 때가 아니야", "정신 차리고 일하자"],
  ["며칠은 일만 해야 해", "휴가는 물 건너갔어", "주말도 반납이야"],
  ["회사에 뼈를 묻어야 해", "이번 생은 노동이야", "존버는 승리한다며.."],
];

const PROFIT_SPEECH: readonly (readonly string[])[] = [
  ["커피값은 벌었어", "티끌도 모으면 돼", "안 잃은 게 어디야"],
  ["점심값은 굳었어", "반나절 벌었다", "오늘은 기분 좋아"],
  ["하루는 안 나가도 돼", "내일 늦잠 자야지", "이 맛에 하는 거지"],
  ["며칠은 놀아도 돼", "휴가 신청서 꺼낼까", "일할 맛 난다"],
  ["사표 쓰러 간다", "노동은 나약한 자들의 것", "이번 생은 성공이야"],
];

const EVEN_SPEECH: readonly string[] = [
  "딱 본전이야",
  "제자리걸음 중",
  "움직여 좀",
  "심심한데",
];

/**
 * 대문(간판) 개미의 한마디. 손익도 시간도 없는 늘 신난 개미라 풀을 따로 둔다.
 */
export const HERO_LINES: readonly string[] = [
  "사표 쓰러 간다",
  "노동은 나약한 자들의 것",
  "이번 생은 성공이야",
  "출근? 그게 뭔데",
];

/**
 * 평단가를 입력하기 전, 아직 손익이 없을 때 개미가 서성이며 하는 말.
 * 손익도 시간도 없으므로 위 풀과 섞지 않는다.
 */
export const WAITING_LINES: readonly string[] = [
  "얼마에 샀더라?",
  "몇 주였지?",
  "빨리 좀 알려줘",
  "증권앱 켜봐",
  "심호흡하고..",
  "각오는 됐어?",
];

/**
 * 손익 방향과 시간 크기에 맞는 개미 한마디 하나.
 * `seed`는 렌더마다 바뀌지 않도록 호출부가 붙잡아두는 값이다 — 매 틱 새로 뽑으면
 * 말풍선이 1초마다 깜빡인다. 구간이나 손익 방향이 바뀔 때만 새로 뽑을 것.
 */
export function pickAntSpeech(mood: Mood, seconds: number, seed: number): string {
  if (mood === "even") return pickFrom(EVEN_SPEECH, seed);

  const pools = mood === "loss" ? LOSS_SPEECH : PROFIT_SPEECH;

  return pickFrom(pools[nudgeTier(seconds)] ?? [], seed);
}

export function pickHeroLine(seed: number): string {
  return pickFrom(HERO_LINES, seed);
}

export function pickWaitingLine(seed: number): string {
  return pickFrom(WAITING_LINES, seed);
}

function pickFrom(pool: readonly string[], seed: number): string {
  if (pool.length === 0) return "";
  return pool[Math.abs(Math.floor(seed)) % pool.length] ?? "";
}
