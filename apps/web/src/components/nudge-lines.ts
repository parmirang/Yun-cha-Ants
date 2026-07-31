import type { Mood } from "@yca/shared";

/**
 * 화면 맨 아래에서 등을 떠미는 한마디.
 *
 * 상단 카운터(`countdown-lines.ts`)·개미 말풍선(`speech-lines.ts`)과 **같은 시간 축**을
 * 쓴다 — 경계는 여기 `nudgeTier` 한 곳에 두고 셋이 함께 가져다 쓴다. 같은 -5%라도
 * 100만원어치면 20분이고 1억어치면 사흘이라, 그때 들어야 할 말이 다르다.
 *
 * 셋이 같은 축이어도 겹치지 않는 건 **역할이 다르기 때문**이다 — 상단은 "{시간} 만큼
 * __"을 끝맺는 서술어, 말풍선은 개미의 1인칭 혼잣말, 이쪽은 화면 밑에서 등을 떠미는
 * 배경 문장이다. 개미의 껍질 색·배경 날씨만 수익률 레벨(`sceneLevelFromStage`)을 따른다.
 *
 * 이 문구들은 본문 폰트로 그린다 (픽셀 폰트 서브셋 대상이 아니다) — 그래서
 * `speech-lines.ts`와 한 파일에 두지 않았다. 여기 문구를 고쳐도 폰트는 다시
 * 굽지 않아도 된다.
 */

/** 시간 구간. 경계는 "한 시간 · 하루 노동(8시간) · 하루 · 닷새"다. */
const TIER_BOUNDS = [3600, 8 * 3600, 24 * 3600, 5 * 24 * 3600] as const;

export function nudgeTier(seconds: number): number {
  const safe = Math.max(0, seconds);
  const index = TIER_BOUNDS.findIndex((bound) => safe < bound);

  return index === -1 ? TIER_BOUNDS.length : index;
}

/** 구간이 낮은 것부터. 배열 길이는 `TIER_BOUNDS.length + 1`과 같아야 한다. */
const LOSS_LINES: readonly (readonly string[])[] = [
  ["커피 한 잔 참으면 되는 정도야", "이 정도는 눈 감아줄게", "숨 한 번 쉬면 지나갈 시간이야"],
  ["오늘 점심시간을 반납하면 되겠는데", "퇴근이 조금 멀어졌을 뿐이야", "야근각까지는 아니야"],
  ["너는 지금 이럴 때가 아니야", "하루를 통째로 갈아 넣어야 해", "앱 볼 시간에 일을 해"],
  ["며칠은 조용히 일만 하자", "휴가 계획은 잠시 접어두는 걸로", "너는 지금 이럴 때가 아니야"],
  ["이건 야근으로 될 일이 아니야", "회사에 뼈를 묻을 각오는 됐어?", "주말 반납으로도 모자라"],
];

const PROFIT_LINES: readonly (readonly string[])[] = [
  ["티끌이지만 안 잃은 게 어디야", "커피값은 벌었네", "오늘은 기분이 좋아"],
  ["오늘 점심은 주식이 사줬어", "이따 퇴근길이 가볍겠는데", "조금 벌었어 헤헤"],
  ["하루쯤 안 나가도 되겠는데?", "내일 늦잠 자도 될 것 같아", "이 맛에 하는 거지"],
  ["휴가 신청서 슬쩍 꺼내볼까", "며칠은 놀아도 되는 거야", "일할 맛 난다"],
  ["이쯤 되면 회사는 취미지", "사표는 이럴 때 쓰는 거야", "노동은 나약한 자들의 것"],
];

const EVEN_LINES: readonly string[] = [
  "딱 본전이야. 움직인 게 없어",
  "제자리걸음 중",
  "이럴 거면 왜 샀어",
];

/**
 * 시간 구간에 맞는 한마디 하나.
 *
 * `seed`는 호출부가 붙잡아두는 값이다 — 매 렌더 새로 뽑으면 시세가 들어올 때마다
 * (1초에 한 번) 문장이 갈린다. 구간이나 손익 방향이 바뀔 때만 새로 뽑을 것.
 */
export function pickNudgeLine(mood: Mood, seconds: number, seed: number): string {
  if (mood === "even") return pickFrom(EVEN_LINES, seed);

  const pools = mood === "loss" ? LOSS_LINES : PROFIT_LINES;

  return pickFrom(pools[nudgeTier(seconds)] ?? [], seed);
}

function pickFrom(pool: readonly string[], seed: number): string {
  if (pool.length === 0) return "";

  return pool[Math.abs(Math.floor(seed)) % pool.length] ?? "";
}
