import { nudgeTier } from "./nudge-lines";

/**
 * 카운터의 "{시간} 만큼 ___"에서 뒤에 붙는 한마디.
 *
 * **일해야 하는 시간의 크기**로 세기를 정한다 — 시간 구간(1시간·하루노동·하루·닷새)이
 * 올라갈수록 세진다. 10분이면 "더 일하면 돼", 며칠이면 "뼈를 갈아야 해". 손익 방향만
 * 보고 "더 일해야 해 / 안 일해도 돼" 두 갈래만 내던 걸, 시간축으로 편 것이다.
 * 구간은 하단 한마디(`nudge-lines.ts`)와 **같은 축**을 쓰므로 `nudgeTier`를 그대로 가져온다.
 *
 * 그럼에도 풀을 하단과 따로 두는 건 **역할이 다르기 때문**이다 — 이쪽은 "{시간} 만큼"에
 * 이어 문장을 끝맺는 서술어라 짧고 직설적이고("만큼 더 일해야 해"), 하단 한마디는
 * 화면 밑에서 등을 떠미는 배경 문장이다. 한 풀을 공유하면 위아래가 같은 말을 되풀이한다.
 *
 * 본문 폰트로 그리므로 픽셀 폰트 서브셋 대상이 아니다 — 고쳐도 `font`를 다시 굽지 않는다.
 */

/** 구간이 낮은 것부터. 배열 길이는 `nudgeTier`가 내는 구간 수(5)와 같아야 한다. */
const LOSS_LINES: readonly (readonly string[])[] = [
  ["더 일하면 돼", "금방 메꿔", "조금만 더 벌면 돼"],
  ["더 일해야 해", "오늘 야근이면 돼", "점심시간 반납이면 돼"],
  ["바짝 일해야 해", "하루를 갈아 넣어야 해", "정신 차리고 벌어야 해"],
  ["며칠은 갈아 넣어야 해", "휴가는 접어야 해", "주말도 반납이야"],
  ["뼈를 갈아야 해", "회사에 뼈를 묻어야 해", "이번 생은 노동이야"],
];

const PROFIT_LINES: readonly (readonly string[])[] = [
  ["안 일해도 돼", "살짝 벌었어", "커피값은 굳었어"],
  ["안 일해도 돼!", "점심은 공짜야", "반나절은 굳었어"],
  ["안 나가도 돼!", "하루는 굳었어", "내일 쉬어도 돼"],
  ["며칠은 놀아도 돼", "휴가 신청서 꺼낼까", "이 맛에 하는 거지"],
  ["평생 안 나가도 돼!", "사표 써도 돼", "노동은 끝이야"],
];

/**
 * 시간 구간에 맞는 한마디 하나. `even`은 "{시간} 만큼"이 성립하지 않으니 호출부가
 * 따로 처리한다 — 여기는 손익이 있는 두 방향만 받는다.
 *
 * `seed`는 호출부가 붙잡아두는 값이다 — 매 렌더 새로 뽑으면 시세가 들어올 때마다
 * (1초에 한 번) 문장이 갈린다. 구간이나 손익 방향이 바뀔 때만 새로 뽑을 것.
 */
export function pickWorkLine(mood: "loss" | "profit", seconds: number, seed: number): string {
  const pools = mood === "loss" ? LOSS_LINES : PROFIT_LINES;

  return pickFrom(pools[nudgeTier(seconds)] ?? [], seed);
}

function pickFrom(pool: readonly string[], seed: number): string {
  if (pool.length === 0) return "";

  return pool[Math.abs(Math.floor(seed)) % pool.length] ?? "";
}

// 상단 문장도 하단 한마디와 같은 시간 구간 위에서 뽑힌다 — 구간 경계를 한 곳
// (nudge-lines)에 두고 이름만 바꿔 내보낸다. 호출부의 seed 재추첨 조건에 쓴다.
export { nudgeTier as workTier } from "./nudge-lines";
