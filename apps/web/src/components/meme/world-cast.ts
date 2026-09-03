import type { Painter } from "@/lib/pixel-canvas";

/**
 * "세계의 개미들" 판에 나오는 **개미 아닌 것들** — 부추(중국) · 메뚜기(일본) ·
 * 정어리(브라질) · 유인원(미국) · 햄스터(러시아), 그리고 나라마다의 국기.
 *
 * **개미는 여기 없다.** 개미 몸은 `ant-sprite.tsx` 하나뿐이라는 규칙 그대로고, 이 판도
 * `antPixels()`를 그대로 끌어다 쓴다 — 몸을 딴 파일에서 다시 그리면 앱 개미와 짤 개미가
 * 서서히 다른 벌레가 된다.
 *
 * **몸은 32칸 격자에 그리고 배율 2로 찍는다** (16칸 × 3이 아니다). 화면에 찍히는 크기는
 * 비슷하고 **그 안의 도트만 잘아져서**, 눈·팔·잎처럼 한두 칸으로는 못 그리던 게 들어간다 —
 * 클로즈업 얼굴이 도트를 키우는 대신 쪼개는 것과 같은 손이다. 개미만은 16칸 몸이라 배율 4로
 * 키를 맞추는데, **그래서 개미 컷만 도트가 굵다** — 앱 개미와 같은 몸을 쓰는 값이다.
 *
 * **그리는 방식은 새싹(`SPROUT`)을 따른다** (`meme-scenes.ts`):
 * 문자맵 + 그림마다의 색 키(char → hex) + 정수 배율. 개미의 색 키가 팔레트 이름을 거치는
 * 것과 다른데, 개미는 단계마다 껍질 색이 변하지만 이 캐릭터들은 안 변하기 때문이다.
 *
 * **`p.sprite`를 쓰지 않는다.** `pixel-canvas.ts`의 `sprite`는 뒤집을 때 `15 - x`로
 * **개미 격자 폭(16)을 못박고 있어서**, 16칸이 아닌 그림을 뒤집으면 엉뚱한 축으로 뒤집힌다.
 * 새싹이 `p.rect`를 쓰는 이유가 이것이고, `drawRows`가 뒤집기를 직접 맡는 이유이기도 하다.
 */

/**
 * **눈은 캐릭터마다 흰자(`e`)와 눈동자(`E`) 두 칸으로 그린다.** 한 칸짜리 검은 점은 눈이
 * 아니라 얼굴에 뚫린 구멍으로 보인다 — 흰자가 있어야 어디를 보는지가 생기고, 그래야
 * 캐릭터로 읽힌다. 색은 껍질과 무관하므로 한 벌을 나눠 쓴다.
 */
const EYE_WHITE = "#f4f2ee";
const EYE_PUPIL = "#191b1f";

/**
 * 순검정(`K`). 눈동자(`#191b1f`)와 따로 두는 건 쓰임이 달라서다 — 이쪽은 **윤곽을 끊거나
 * 그늘을 박을 때** 쓰는 색이라 어느 그림에서든 같은 검정이어야 한다. 그림마다의 색표에
 * 전부 넣어두는데, **색표에 없는 글자로 찍으면 그 칸이 조용히 투명해지기 때문이다.**
 */
export const INK = "#000000";

/**
 * 문자맵 한 장을 찍는다. **이 파일의 그림은 전부 이걸 거친다** — 새싹·SPACEX 글자·물음표·
 * 하트가 각자 제 루프를 들고 있는 걸 여기서 되풀이하면 열두 벌이 된다.
 *
 * 키에 없는 글자는 **투명**이다 (`.`을 따로 적을 필요가 없다).
 */
export function drawRows(
  p: Painter,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  left: number,
  top: number,
  k: number,
  flipX = false,
): void {
  const width = rows[0]?.length ?? 0;

  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const color = key[char];
      if (!color) return;

      const col = flipX ? width - 1 - x : x;
      p.rect(left + col * k, top + y * k, k, k, color);
    });
  });
}

/* ── 국기 ──────────────────────────────────────────────
   15×10 도트. **나라마다 다른 빨강·파랑을 한 벌로 접었다** — 일장기의 진홍과 오성홍기의
   주홍은 이 크기에서 안 갈리고, 색을 여섯 벌 두면 고칠 자리만 는다.

   **성조기와 태극기는 단순화가 불가피하다.** 줄 열셋과 별 쉰, 태극과 괘 넷은 15칸에
   안 들어간다 — "그 국기인 줄 알아볼 정도"로만 남기고, 위에 붙는 나라 이름이 확인해 준다.
   ────────────────────────────────────────────────────── */

export const FLAG_W = 15;
export const FLAG_H = 10;

const FLAG_KEY: Readonly<Record<string, string>> = {
  w: "#f2f4f7",
  r: "#d8232a",
  b: "#1f3f9c",
  y: "#ffd400",
  g: "#0e9b4a",
  k: "#22252b",
  K: INK,
};

/** 태극기 — 태극은 대각선으로 갈라 붉고 푸르게, 괘 넷은 모서리의 검은 덩이로 줄인다 */
const FLAG_KR: readonly string[] = [
  "wwwwwwwwwwwwwww",
  "wkkwwwwwwwwwkkw",
  "wkkwwwwwwwwwkkw",
  "wwwwwwrrrwwwwww",
  "wwwwwrrrbbwwwww",
  "wwwwwrrbbbwwwww",
  "wwwwwwbbbwwwwww",
  "wkkwwwwwwwwwkkw",
  "wkkwwwwwwwwwkkw",
  "wwwwwwwwwwwwwww",
];

/** 오성홍기 — 큰 별 하나와 작은 별 넷 */
const FLAG_CN: readonly string[] = [
  "rrrrrrrrrrrrrrr",
  "rrrrrrryrrrrrrr",
  "rrryrrrrrrrrrrr",
  "rryyyrrryrrrrrr",
  "ryyyyyrrrrrrrrr",
  "rryyyrrryrrrrrr",
  "rryryrrrrrrrrrr",
  "rrrrrrryrrrrrrr",
  "rrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrr",
];

/** 일장기 */
const FLAG_JP: readonly string[] = [
  "wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwww",
  "wwwwwwrrrwwwwww",
  "wwwwwrrrrrwwwww",
  "wwwwrrrrrrrwwww",
  "wwwwrrrrrrrwwww",
  "wwwwwrrrrrwwwww",
  "wwwwwwrrrwwwwww",
  "wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwww",
];

/** 브라질 — 초록 바탕, 노란 마름모, 파란 원 */
const FLAG_BR: readonly string[] = [
  "ggggggggggggggg",
  "gggggggyggggggg",
  "ggggggyyygggggg",
  "gggggybbbyggggg",
  "ggggybbbbbygggg",
  "ggggybbbbbygggg",
  "gggggybbbyggggg",
  "ggggggyyygggggg",
  "gggggggyggggggg",
  "ggggggggggggggg",
];

/** 성조기 — 줄은 다섯으로, 별은 파란 칸의 흰 점으로 줄인다 */
const FLAG_US: readonly string[] = [
  "bwbwbbrrrrrrrrr",
  "bbwbwbwwwwwwwww",
  "bwbwbbrrrrrrrrr",
  "bbwbwbwwwwwwwww",
  "bwbwbbrrrrrrrrr",
  "wwwwwwwwwwwwwww",
  "rrrrrrrrrrrrrrr",
  "wwwwwwwwwwwwwww",
  "rrrrrrrrrrrrrrr",
  "wwwwwwwwwwwwwww",
];

/** 러시아 — 흰·파랑·빨강 세 띠 (10줄이 셋으로 안 나뉘어 가운데를 한 줄 두껍게 둔다) */
const FLAG_RU: readonly string[] = [
  "wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwww",
  "bbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbb",
  "rrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrr",
];

export type FlagId = "kr" | "cn" | "jp" | "br" | "us" | "ru";

const FLAGS: Readonly<Record<FlagId, readonly string[]>> = {
  kr: FLAG_KR,
  cn: FLAG_CN,
  jp: FLAG_JP,
  br: FLAG_BR,
  us: FLAG_US,
  ru: FLAG_RU,
};

/**
 * 국기 하나. **테두리를 한 줄 두른다** — 일장기·태극기·성조기는 바탕이 흰색이라 밝은
 * 하늘 위에서는 국기가 아니라 허공에 뜬 무늬로 보인다.
 */
export function drawFlag(p: Painter, id: FlagId, left: number, top: number, k: number): void {
  p.rect(left - k, top - k, (FLAG_W + 2) * k, (FLAG_H + 2) * k, "#3b4453");
  drawRows(p, FLAGS[id], FLAG_KEY, left, top, k);
}

/* ── 부추 (중국) ───────────────────────────────────────
   잘려도 또 자란다. **잎을 일곱 대로 빼곡히** 세우고, 잎마다 밝은 면과 어두운 면을 나눠
   한 대가 두 칸이 되게 했다 — 한 칸짜리 잎은 풀이 아니라 선으로 보인다.

   **자란 정도(`grown`)로 위에서부터 잘라 그린다** — 잘린 그림을 따로 두면 두 벌이 되고,
   자라는 도중의 중간 키가 안 나온다.
   ────────────────────────────────────────────────────── */

const CHIVE: readonly string[] = [
  "..........gG....................",
  "..........gG....................",
  "..........gG..gG................",
  "......gG..gG..gG................",
  "......gG..gG..gG................",
  "......gG..gG..gG..gG............",
  "......gG..gG..gG..gG............",
  "......gG..gG..gG..gG..gG........",
  "..gG..gG..gG..gG..gG..gG........",
  "..gG..gG..gG..gG..gG..gG........",
  "..gG..gG..gG..gG..gG..gG........",
  "..gG..gG..gG..gG..gG..gG........",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gG..gG..gG..gG..gG..gG..gG....",
  "..gGd.gGd.gGd.gGd.gGd.gGd.gGd...",
  "..gGd.gGd.gGd.gGd.gGd.gGd.gGd...",
  ".wwwwwwwwwwwwwwwwwwwwwwwwwwww...",
  ".wwwwwwwweeewwwwweeewwwwwwwww...",
  "..wwwwwwweEewwwwweEewwwwwwww....",
  "..wwwwwwwwwwwwwwwwwwwwwwwwww....",
  "...rrrrrrrrrrrrrrrrrrrrrrrr.....",
  "....rrrrrrrrrrrrrrrrrrrrrr......",
];

const CHIVE_KEY: Readonly<Record<string, string>> = {
  G: "#3da864",
  g: "#6fd68f",
  d: "#2b7a48",
  /* 알뿌리를 살짝 낮춰둔다 — 순백으로 두면 그 위의 흰자가 안 보인다 */
  w: "#e2ead6",
  r: "#c9d2b6",
  K: INK,
  e: EYE_WHITE,
  E: EYE_PUPIL,
};

export const CHIVE_W = 32;
export const CHIVE_H = 32;
/** 잎이 서 있는 줄 — 여기까지만 잘린다 (알뿌리는 안 잘린다) */
const CHIVE_LEAF_ROWS = 26;

/**
 * 부추 한 포기. `grown` 0이면 잎이 통째로 잘려 알뿌리만 남고, 1이면 다 자란다.
 * 자르는 자리는 **도트 단위로 끊는다** — 소수로 두면 잘린 끝이 프레임마다 흐릿하게 떤다.
 */
export function drawChive(p: Painter, left: number, top: number, k: number, grown: number): void {
  const cut = Math.round((1 - Math.max(0, Math.min(1, grown))) * CHIVE_LEAF_ROWS);
  const rows = CHIVE.map((row, y) => (y < cut ? "" : row));

  drawRows(p, rows, CHIVE_KEY, left, top, k);
}

/** 잘린 자리의 화면 높이 — 가위를 여기에 갖다 댄다 */
export function chiveCutY(top: number, k: number, grown: number): number {
  return top + Math.round((1 - Math.max(0, Math.min(1, grown))) * CHIVE_LEAF_ROWS) * k;
}

/* ── 메뚜기 (일본) ─────────────────────────────────────
   떼로 몰리는 판이라 화면에 찍히는 크기는 작지만, **격자를 16칸으로 넓혀 눈과 더듬이를
   넣었다** — 8칸에서는 몸통 말고 아무것도 안 들어가 초록 얼룩으로 보였다.
   ────────────────────────────────────────────────────── */

const LOCUST: readonly string[] = [
  "............nn..",
  "..........nn....",
  "....bbbbbbb.....",
  "...bbbbbbbbeE...",
  "..bbbbbbbbbeeb..",
  "..LLbbbbbbbbb...",
  ".LL.bbbbbbb.....",
  "LL..l..l........",
  "....l..l........",
  "................",
];

const LOCUST_KEY: Readonly<Record<string, string>> = {
  b: "#7cb342",
  L: "#4e7d26",
  l: "#3d5f1e",
  n: "#3d5f1e",
  K: INK,
  e: EYE_WHITE,
  E: EYE_PUPIL,
};

export const LOCUST_W = 16;
export const LOCUST_H = 10;

export function drawLocust(p: Painter, left: number, top: number, k: number, flipX = false): void {
  drawRows(p, LOCUST, LOCUST_KEY, left, top, k, flipX);
}

/* ── 정어리 (브라질) ───────────────────────────────────
   물빛 위에 뜨므로 **은빛으로 밝게** 잡는다 — 푸른 몸으로 그리면 물에 묻힌다.
   지느러미와 눈이 들어가도록 격자를 22칸으로 넓혔다.
   ────────────────────────────────────────────────────── */

const SARDINE: readonly string[] = [
  "......................",
  ".........ddd..........",
  "tt......ddddd.........",
  "ttt...ssssssssssss....",
  "tttt.sssssssssssssss..",
  "ttttssssssssssssseEs..",
  "tttssssssssssssssees..",
  "ttttsssssssssssssss...",
  "tttt.SSSSSSSSSSSSSS...",
  "ttt...SSSSSSSSSSSS....",
  "tt......fffff.........",
  ".........fff..........",
];

const SARDINE_KEY: Readonly<Record<string, string>> = {
  s: "#c8d8e4",
  S: "#93a9bb",
  t: "#7d93a6",
  d: "#7d93a6",
  f: "#7d93a6",
  K: INK,
  e: EYE_WHITE,
  E: EYE_PUPIL,
};

export const SARDINE_W = 22;
export const SARDINE_H = 12;

export function drawSardine(p: Painter, left: number, top: number, k: number, flipX = false): void {
  drawRows(p, SARDINE, SARDINE_KEY, left, top, k, flipX);
}

/* ── 유인원 (미국) ─────────────────────────────────────
   **팔은 문자맵에 없다.** "여기로 모여"라 팔을 들었다 내렸다 하는데, 몸에 붙여두면 자세마다
   몸을 한 벌씩 더 그려야 한다 — 개미가 "프레임 사이에 바뀌는 건 팔뿐"인 것과 같은 자리라
   팔만 따로 두고 어깨에 붙였다 머리 옆으로 옮긴다.
   ────────────────────────────────────────────────────── */

const APE: readonly string[] = [
  "................................",
  ".........hhhhhhhhhhhhhh.........",
  ".......hhhhhhhhhhhhhhhhhh.......",
  "......hhhhhhhhhhhhhhhhhhhh......",
  ".....hhhhhhhhhhhhhhhhhhhhhh.....",
  ".....hhhhffffffffffffhhhhhh.....",
  ".....hhhffffffffffffffhhhhh.....",
  ".....hhhffeeffffffeeffhhhh......",
  ".....hhhffeEffffffeEffhhhh......",
  ".....hhhffffffffffffffhhhh......",
  "......hhhffffffnnffffhhhh.......",
  "......hhhhffffffffffhhhh........",
  ".......hhhhffffffffhhhh.........",
  "........hhhhhhhhhhhhhh..........",
  "..........hhhhhhhhhh............",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  "......hhhhhhhhhhhhhhhhhh........",
  ".......hhhhhhhhhhhhhhhh.........",
  ".......hhhhhhhhhhhhhhhh.........",
  "........hhhhhhhhhhhhhh..........",
  "........hhhhhh..hhhhhh..........",
  ".......hhhhhh....hhhhhh.........",
  "......hhhhhh......hhhhhh........",
  "......hhhhh........hhhhh........",
  ".....hhhhhh........hhhhhh.......",
  ".....hhhhh..........hhhhh.......",
  "................................",
];

/** 옆으로 뻗은 팔 */
const APE_ARM_OUT: readonly string[] = [
  "..AAAAAA",
  ".AAAAAAA",
  "AAAAAAAA",
  ".AAAAAAA",
  "..AAAA..",
];

/** 들어올린 팔 */
const APE_ARM_UP: readonly string[] = [
  ".AAA.",
  "AAAAA",
  "AAAAA",
  "AAAAA",
  "AAAAA",
  "AAAAA",
  ".AAAA",
  ".AAAA",
  "..AAA",
];

const APE_KEY: Readonly<Record<string, string>> = {
  h: "#6b4a35",
  A: "#54392a",
  f: "#c99a72",
  K: INK,
  e: EYE_WHITE,
  E: EYE_PUPIL,
  n: "#8a5f47",
};

export const APE_W = 32;
export const APE_H = 32;

export function drawApe(
  p: Painter,
  left: number,
  top: number,
  k: number,
  calling: boolean,
  flipX = false,
): void {
  drawRows(p, APE, APE_KEY, left, top, k, flipX);

  if (calling) {
    drawRows(p, APE_ARM_UP, APE_KEY, left + 1 * k, top + 6 * k, k);
    drawRows(p, APE_ARM_UP, APE_KEY, left + 26 * k, top + 6 * k, k);
  } else {
    drawRows(p, APE_ARM_OUT, APE_KEY, left - 2 * k, top + 15 * k, k);
    drawRows(p, APE_ARM_OUT, APE_KEY, left + 26 * k, top + 15 * k, k, true);
  }
}

/* ── 햄스터 (러시아) ───────────────────────────────────
   볼이 부푸는 게 이 캐릭터의 전부다. **볼은 문자맵에 없다** — 크기가 계속 변하는 그림이라
   프레임을 몇 벌 두면 그만큼만 부풀고, 중간 크기가 안 나온다 (눈물·하트와 같은 자리).

   **팔은 몸보다 밝게 칠하고 어두운 선을 두른다** — 몸통 색 그대로 두면 통째로 묻혀 팔이
   있는지도 모른다 (빈 지갑 판에서 한 번 헛디딘 자리와 같다).
   ────────────────────────────────────────────────────── */

const HAMSTER: readonly string[] = [
  "................................",
  "................................",
  ".....RRR..............RRR.......",
  "....RRRRR............RRRRR......",
  "....RRRRR............RRRRR......",
  ".....RRR...hhhhhhh....RRR.......",
  "........hhhhhhhhhhhhhh..........",
  "......hhhhhhhhhhhhhhhhhh........",
  ".....hhhhhhhhhhhhhhhhhhhh.......",
  "....hhhhhhhhhhhhhhhhhhhhhh......",
  "....hhhheeehhhhhhheeehhhhh......",
  "....hhhheEehhhhhhheEehhhhh......",
  "....hhhheeehhhhhhheeehhhhh......",
  "....hhhhhhhhhhhhhhhhhhhhhh......",
  ".....hhhhhhwwwwwwwwhhhhhhh......",
  ".....hhhhhwwwwnnwwwwhhhhhh......",
  "......hhhhwwwwnnwwwwhhhhh.......",
  "......hhhhhwwwwwwwwhhhhhh.......",
  ".......hhhhhhhhhhhhhhhh.........",
  "........hhhhhhhhhhhhhh..........",
  ".......hhhhhhhhhhhhhhhh.........",
  "......hhhhhhhhhhhhhhhhhh........",
  "....aaahhhhhhhhhhhhhhhhaaa......",
  "...aAAAhhhhhhhhhhhhhhAAAa.......",
  "...aAAAhhhhhhhhhhhhhhAAAa.......",
  "....aaahhhhhhhhhhhhhhaaa........",
  "......hhhhhhhhhhhhhhhhhh........",
  ".......hhhhhhhhhhhhhhhh.........",
  ".......hhhhhhhhhhhhhhhh.........",
  "........ffff....ffff............",
  ".......ffffff..ffffff...........",
  "................................",
];

const HAMSTER_KEY: Readonly<Record<string, string>> = {
  h: "#c9a06a",
  R: "#a8804f",
  a: "#7d5c34",
  A: "#e6c493",
  K: INK,
  e: EYE_WHITE,
  E: EYE_PUPIL,
  w: "#f0e2cc",
  n: "#d4738a",
  f: "#e8c9a0",
};

export const HAMSTER_W = 32;
export const HAMSTER_H = 32;
/** 볼이 붙는 줄 (문자맵 좌표) */
const CHEEK_TOP = 10;
const CHEEK_ROWS = 9;

/**
 * 햄스터 한 마리. `puff` 0~1로 볼이 부푼다 — **양옆으로 도트 단위로 자란다** (소수로 두면
 * 볼 가장자리가 프레임마다 흐릿해진다). 볼은 몸 **뒤에** 깔아 얼굴 윤곽이 안 먹히게 한다.
 */
export function drawHamster(p: Painter, left: number, top: number, k: number, puff: number): void {
  const bulge = Math.round(Math.max(0, Math.min(1, puff)) * 5);

  if (bulge > 0) {
    const fur = HAMSTER_KEY.h ?? "#c9a06a";
    const line = HAMSTER_KEY.a ?? "#7d5c34";

    for (const side of [-1, 1] as const) {
      const x = side < 0 ? left + (4 - bulge) * k : left + 26 * k;
      p.rect(x, top + CHEEK_TOP * k, bulge * k, CHEEK_ROWS * k, fur);
      p.rect(x, top + CHEEK_TOP * k, bulge * k, k, line);
      p.rect(x, top + (CHEEK_TOP + CHEEK_ROWS - 1) * k, bulge * k, k, line);
      p.rect(side < 0 ? x : x + (bulge - 1) * k, top + CHEEK_TOP * k, k, CHEEK_ROWS * k, line);
    }
  }

  drawRows(p, HAMSTER, HAMSTER_KEY, left, top, k);
}

/* ── 도트 랩이 읽어가는 창구 ────────────────────────────
   `/pixel-lab`이 이 표를 그대로 열어 고친다. **랩이 그림 사본을 들고 있으면 안 된다** —
   개미 자세들이 `antPoseRows()`를 거쳐 가는 것과 같은 규칙이다: 사본을 두면 여기서 고친
   도트와 랩에서 고친 도트가 갈라진다.

   글자마다의 이름표도 여기서 낸다. 랩의 팔레트는 색만 있으면 찍히긴 하지만, 뜻을 모르면
   "이 회색이 꼬리인지 지느러미인지"를 매번 도로 세어봐야 한다.
   ────────────────────────────────────────────────────── */

export type CastId =
  | "chive"
  | "locust"
  | "sardine"
  | "ape"
  | "apeArmOut"
  | "apeArmUp"
  | "hamster"
  | "flagKr"
  | "flagCn"
  | "flagJp"
  | "flagBr"
  | "flagUs"
  | "flagRu";

export interface CastArt {
  title: string;
  rows: readonly string[];
  key: Readonly<Record<string, string>>;
  labels: Readonly<Record<string, string>>;
}

const EYE_LABELS = { e: "흰자", E: "눈동자", K: "검정" } as const;

const FLAG_LABELS: Readonly<Record<string, string>> = {
  w: "흰색",
  r: "빨강",
  b: "파랑",
  y: "노랑",
  g: "초록",
  k: "검정(태극·괘)",
  K: "검정",
};

const flagArt = (title: string, rows: readonly string[]): CastArt => ({
  title,
  rows,
  key: FLAG_KEY,
  labels: FLAG_LABELS,
});

export const CAST_ART: Readonly<Record<CastId, CastArt>> = {
  chive: {
    title: "부추 (중국)",
    rows: CHIVE,
    key: CHIVE_KEY,
    labels: { G: "잎(어두운 면)", g: "잎(밝은 면)", d: "잎 끝", w: "알뿌리", r: "뿌리", ...EYE_LABELS },
  },
  locust: {
    title: "메뚜기 (일본)",
    rows: LOCUST,
    key: LOCUST_KEY,
    labels: { b: "몸", L: "뒷다리", l: "다리", n: "더듬이", ...EYE_LABELS },
  },
  sardine: {
    title: "정어리 (브라질)",
    rows: SARDINE,
    key: SARDINE_KEY,
    labels: { s: "몸", S: "배", t: "꼬리", d: "등지느러미", f: "배지느러미", ...EYE_LABELS },
  },
  ape: {
    title: "유인원 (미국)",
    rows: APE,
    key: APE_KEY,
    labels: { h: "털", A: "팔", f: "얼굴", n: "코", ...EYE_LABELS },
  },
  apeArmOut: { title: "유인원 팔 (내림)", rows: APE_ARM_OUT, key: APE_KEY, labels: { A: "팔", K: "검정" } },
  apeArmUp: { title: "유인원 팔 (듦)", rows: APE_ARM_UP, key: APE_KEY, labels: { A: "팔", K: "검정" } },
  hamster: {
    title: "햄스터 (러시아)",
    rows: HAMSTER,
    key: HAMSTER_KEY,
    labels: {
      h: "털",
      R: "귀",
      A: "팔",
      a: "팔 선",
      w: "주둥이",
      n: "코",
      f: "발",
      ...EYE_LABELS,
    },
  },
  flagKr: flagArt("국기 · 한국", FLAG_KR),
  flagCn: flagArt("국기 · 중국", FLAG_CN),
  flagJp: flagArt("국기 · 일본", FLAG_JP),
  flagBr: flagArt("국기 · 브라질", FLAG_BR),
  flagUs: flagArt("국기 · 미국", FLAG_US),
  flagRu: flagArt("국기 · 러시아", FLAG_RU),
};

export const CAST_IDS = Object.keys(CAST_ART) as CastId[];
