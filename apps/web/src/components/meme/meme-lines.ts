/**
 * 짤 공장 개미의 말풍선.
 *
 * 앱 말풍선(`speech-lines.ts`)과 **목소리는 같고 축이 다르다** — 저쪽은 손익을 시급으로
 * 나눈 시간(`nudgeTier`)을 따라 세기가 갈리지만, 여기는 손익도 시급도 없다. 짤은
 * 장면이 곧 상황이라 **장면마다 풀 하나**로 끝난다.
 *
 * 그래서 구간도 손익 방향도 없다. 대신 지켜야 하는 건 둘이다.
 *
 * 1. **장면끼리 겹치지 않는다.** 세 장면은 한 화면에서 탭으로 오가므로, 파는 개미와
 *    우는 개미가 같은 말을 하면 문구가 몇 개 없어 보인다.
 * 2. **앱 말풍선과도 겹치지 않는다.** 같은 개미의 같은 자리(머리 위)라, 결과 화면에서
 *    본 말을 짤에서 또 만나면 한 벌을 돌려쓰는 것으로 읽힌다.
 *
 * 둘 다 `pnpm --filter @yca/web lines`가 검사한다.
 *
 * **말은 짧아야 한다 (14자 안쪽).** 9:16 한 칸에 한 줄로 들어가야 하고, 줄이 넘치면
 * 말풍선이 개미보다 커진다. 세로 판형이라 가로로 도망갈 자리가 없다.
 *
 * 이 파일의 글자도 픽셀 폰트 서브셋 범위다 (`speech-lines.ts`와 함께 굽는다) —
 * 문구를 고치면 `pnpm --filter @yca/web font`을 다시 돌린다.
 */

export type MemeSceneId = "dig" | "ride" | "flood";

/**
 * 1. 땅파기 — **왜 파고 있는지**를 답하는 줄이다. 해는 쨍쨍하고 땀은 흐르는데
 * 개미는 계속 판다. 이유가 딱하고 구체적일수록 웃긴다 (카드값·전세·평단).
 */
export const DIG_LINES: readonly string[] = [
  "이번 달 카드값이야",
  "평단 낮추려면 파야 해",
  "굴 전세가 올랐대",
  "여왕개미가 시켰어",
  "금이라도 나와라",
  "커피는 끊었어",
  "월요일부터 파는 중",
  "물린 주식 값이야",
  "여기 어딘가 내 돈이",
  "쉬면 굶어",
];

/**
 * 2. 탑승 — 산·구름·우주를 지나며 신이 난다. **고도가 올라갈수록 말도 붕 떠야** 해서,
 * 밑도 끝도 없는 낙관과 슬쩍 새어나오는 불안을 섞는다.
 */
export const RIDE_LINES: readonly string[] = [
  "유후 올라간다",
  "이거 어디까지 가",
  "안전벨트가 없는데",
  "구름 위다 구름",
  "달까지 가보자",
  "익절은 언제 하지",
  "고소공포증 나았어",
  "여왕개미 보고 있나",
  "손 흔들어 저 아래로",
  "내려달란 말 아니야",
];

/**
 * 3. 눈물바다 — 다 잃었다. **금액을 적지 않는다** (짤에는 숫자가 없고, 이 앱은 금액을
 * 화면 밖으로 안 내보낸다). 잃은 크기는 물이 차오르는 높이가 말한다.
 */
export const FLOOD_LINES: readonly string[] = [
  "다 잃었어 진짜 다",
  "전재산이 녹았어",
  "이거 다 내 눈물이야",
  "적금 깬 돈이었는데",
  "겨울 양식이 없어졌어",
  "여왕개미 볼 낯이 없어",
  "물 좀 퍼내줘",
  "굴까지 잠겼어",
  "숨 쉴 곳이 없어",
  "여기서 헤엄쳐 나가야 해",
];

export const MEME_LINES: Readonly<Record<MemeSceneId, readonly string[]>> = {
  dig: DIG_LINES,
  ride: RIDE_LINES,
  flood: FLOOD_LINES,
};

/**
 * 장면과 박자(beat)에 맞는 한마디.
 *
 * `seed`는 한 번의 촬영을 붙잡아두는 값이다 — 같은 seed면 같은 영상이 나와야
 * **미리보기에서 본 그 말이 그대로 녹화된다.** 박자마다 다른 줄을 뽑되, 바로 앞
 * 줄과는 겹치지 않게 한 칸 밀어준다 (같은 말이 두 번 이어지면 말풍선이 안 바뀐 줄 안다).
 */
export function pickMemeLine(scene: MemeSceneId, seed: number, beat: number): string {
  const pool = MEME_LINES[scene];
  if (pool.length === 0) return "";

  const start = Math.abs(Math.floor(seed));
  const index = (start + beat * step(start, pool.length)) % pool.length;

  return pool[index] ?? "";
}

/**
 * 박자마다 몇 칸씩 건너뛸지. **풀 길이와 서로소인 수**여야 한 바퀴를 다 돌기 전에
 * 같은 줄로 되돌아오지 않는다 — 10줄짜리 풀에 5칸씩 뛰면 두 줄만 번갈아 나온다.
 */
function step(seed: number, length: number): number {
  if (length <= 2) return 1;

  for (let offset = 0; offset < length; offset += 1) {
    const candidate = 1 + ((seed + offset) % (length - 1));
    if (gcd(candidate, length) === 1) return candidate;
  }

  return 1;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
