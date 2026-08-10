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

export type MemeSceneId =
  | "dig"
  | "ride"
  | "flood"
  | "face"
  | "cushion"
  | "coaster"
  | "train"
  | "rocket";

/**
 * 문구 풀의 이름. **장면 하나가 풀을 둘 이상 쓸 수 있다** — 만원 열차는 봉이 오를 때와
 * 내릴 때 하는 말이 달라야 해서, 장면 안에서 풀을 갈아 끼운다. 로켓도 같다 —
 * 오르는 동안(`rocket`)과 떨어지는 동안(`rocketDown`)의 말이 다르다.
 */
export type MemeLinePool = MemeSceneId | "trainUp" | "trainDown" | "rocketDown";

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

/**
 * 4. 얼굴 클로즈업 — 화면에 얼굴밖에 없다. **말이 상황을 혼자 설명해야** 하므로,
 * 눈물바다(다 잃은 뒤)와 달리 **떨어지는 중**을 말한다: 지금 파랗고, 지금 녹고 있다.
 *
 * 여기만 **개미 살림이 아니라 주식 용어로** 말한다 (저점·반등·물타기·손절). 얼굴이
 * 화면을 채워 배경이 상황을 못 알려주므로, 말이 "무엇 때문에 우는가"를 대신 세운다.
 */
export const FACE_LINES: readonly string[] = [
  "저점이 대체 어디야",
  "계좌가 녹아내려",
  "차트를 못 보겠어",
  "반등은 언제 오는데",
  "물타기도 못 하겠어",
  "여기가 바닥인 줄",
  "손절 각인가 이거",
  "빨간 날이 그리워",
  "파랗게 물들었어",
  "장 열리자마자 이래",
];

/**
 * 5. 돈방석 — 자랑이다. **액수는 말하지 않는다** (이 앱은 금액을 화면 밖으로 안 내보내고,
 * 짤에는 숫자가 없다). 얼마인지 대신 **얼마나 여유로운지**로 자랑한다.
 */
export const CUSHION_LINES: readonly string[] = [
  "훗 별거 아니야",
  "이게 바로 복리지",
  "돈방석 푹신하네",
  "앉을 자리가 넉넉해",
  "여왕개미도 부럽대",
  "일개미 아니고 사장",
  "이 정도는 돼야지",
  "더 사둘걸 그랬나",
  "곳간이 꽉 찼어",
  "빨간불이 예쁘다",
];

/**
 * 6. 롤러코스터 — 여러 마리가 함께 탄다. **개미 하나의 혼잣말이 아니라 서로 지르는 소리**라
 * 명령형이 많다 (붙잡아라·물타라·불타라). 장 시작부터 끝까지가 한 바퀴다.
 */
export const COASTER_LINES: readonly string[] = [
  "장 시작한다",
  "꽉 붙잡아",
  "물타라 물타라",
  "불타라 불타라",
  "손 놓으면 끝이야",
  "내려주세요 제발",
  "올라간다 올라가",
  "안전바는 어딨어",
  "다들 살아있지?",
  "이번 칸은 파랗다",
];

/**
 * 7-1. 만원 열차 — 역과 탑승. 아직 차트에 오르기 전이라 **정류장에서 할 말**이다
 * (자리·손잡이·막차). 종목 이름은 간판이 말해주므로 문구는 거들지 않는다.
 */
export const TRAIN_LINES: readonly string[] = [
  "이 열차 맞나요",
  "자리 없어도 타",
  "밀지 마 밀지 마",
  "놓치면 후회해",
  "다 탔으면 출발",
  "손잡이 꽉 잡아",
  "만석입니다",
  "막차는 아니겠지",
];

/**
 * 7-2. 양봉 구간 — 열차가 오르막을 달린다. **신났지만 아직 안 내렸다**는 게 이 풀의
 * 목소리다 (익절 얘기는 안 한다 — 그건 내리는 사람 말이고, 여긴 다 타고 있다).
 */
export const TRAIN_UP_LINES: readonly string[] = [
  "이 맛에 탄다",
  "가즈아",
  "역시 타길 잘했어",
  "더 밟아 주세요",
  "창밖 좀 봐",
  "이대로만 가자",
  "고점은 아직이야",
  "환승 안 해",
];

/**
 * 7-3. 음봉 구간 — 내리막. **내리고 싶지만 열차는 안 선다.**
 */
export const TRAIN_DOWN_LINES: readonly string[] = [
  "어어 내려간다",
  "브레이크 좀요",
  "여기서 내릴게요",
  "손잡이 놓치겠어",
  "이번 역 어디야",
  "다시 올라가겠지",
  "속이 안 좋아",
  "왜 후진해",
];

/**
 * 8-1. 로켓 발사 — 상승. 미장 로켓 코에 셋이 올라타고 화성으로 간다. **연료가 넉넉한 줄
 * 아는 목소리다** — 밑도 끝도 없는 확신일수록 뒤의 추락이 웃긴다.
 */
export const ROCKET_LINES: readonly string[] = [
  "와- 화성가자!!",
  "지구야 안녕",
  "달은 그냥 지나쳐",
  "연료는 가득이야",
  "미장 로켓은 달라",
  "별이 손에 잡힐 듯",
  "정거장 없이 직행",
  "여왕개미도 태울걸",
];

/**
 * 8-2. 로켓 하강 — 추진이 꺼졌다. **긴 말을 못 한다.** 떨어지는 중이라 짧은 탄식과
 * 다급한 한마디뿐이다.
 */
export const ROCKET_DOWN_LINES: readonly string[] = [
  "아...",
  "어? 어어??",
  "연료가 없대",
  "추진이 꺼졌어",
  "화성은 다음에..",
  "누가 좀 잡아줘",
  "이거 환불 되나",
  "내리막은 빠르네",
];

export const MEME_LINES: Readonly<Record<MemeLinePool, readonly string[]>> = {
  dig: DIG_LINES,
  ride: RIDE_LINES,
  flood: FLOOD_LINES,
  face: FACE_LINES,
  cushion: CUSHION_LINES,
  coaster: COASTER_LINES,
  train: TRAIN_LINES,
  trainUp: TRAIN_UP_LINES,
  trainDown: TRAIN_DOWN_LINES,
  rocket: ROCKET_LINES,
  rocketDown: ROCKET_DOWN_LINES,
};

/**
 * 장면과 박자(beat)에 맞는 한마디.
 *
 * `seed`는 한 번의 촬영을 붙잡아두는 값이다 — 같은 seed면 같은 영상이 나와야
 * **미리보기에서 본 그 말이 그대로 녹화된다.** 박자마다 다른 줄을 뽑되, 바로 앞
 * 줄과는 겹치지 않게 한 칸 밀어준다 (같은 말이 두 번 이어지면 말풍선이 안 바뀐 줄 안다).
 */
export function pickMemeLine(pool_: MemeLinePool, seed: number, beat: number): string {
  const pool = MEME_LINES[pool_];
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
