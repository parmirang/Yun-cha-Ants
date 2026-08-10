/**
 * 도트 랩의 팔레트 — **문자 하나가 색 하나**다.
 *
 * 개미 팔레트는 색을 여기서 새로 짓지 않고 [ant-sprite.tsx](../ant-sprite.tsx)의
 * `antPalette()` / `antFacePalette()`를 그대로 가져온다. 랩에서 고른 색이 앱에 붙였을 때
 * 달라지면 안 되기 때문이다 — 색을 두 곳에서 만들면 랩에서 잘 어울리던 도트가 앱에서만
 * 튄다. 그래서 랩에는 **단계 슬라이더**가 있다: 같은 도트를 창백한 개미부터 붉은 개미까지
 * 훑어보고, 어느 단계에서도 실루엣이 배경에 안 묻히는지 확인하는 자리다.
 *
 * 자유 팔레트만 색을 손으로 정한다 (개미가 아닌 걸 그릴 때). 이쪽은 문자에 뜻이 없으므로
 * 라벨도 사람이 붙인다.
 */

import {
  ANT_COLOR_KEY,
  ANT_FACE_H,
  ANT_FACE_KEY,
  ANT_FACE_W,
  ANT_GRID,
  antFacePalette,
  antPalette,
} from "@/components/ant-sprite";

export type PaletteId = "body" | "face" | "free";

export interface Swatch {
  char: string;
  color: string;
  label: string;
}

export interface LabPalette {
  id: PaletteId;
  title: string;
  swatches: Swatch[];
  /** 이 팔레트가 전제하는 격자. 자유 팔레트는 크기를 사람이 정하므로 없다. */
  grid: { w: number; h: number } | null;
  /** 외곽선을 두를 때 기본으로 쓰는 글자 */
  outlineChar: string;
  /** 색을 손으로 고칠 수 있는가 */
  editable: boolean;
}

/**
 * 몸(16×16)에 쓰는 글자들. **순서가 곧 팔레트 순서**라 자주 쓰는 덩이(머리·가슴·배)를
 * 앞에 둔다. 팔(w)·다리(l)·더듬이(n)는 색이 같지만 글자를 나눠 둔다 — 색은 같아도
 * 뜻이 달라서, 나중에 팔만 밝게 바꾸고 싶어질 때 도트를 다시 찍지 않아도 된다.
 */
const BODY_LABELS: Record<string, string> = {
  h: "머리",
  t: "가슴",
  g: "배",
  G: "배 광택",
  l: "다리",
  w: "팔",
  n: "더듬이",
  e: "눈",
};

const FACE_LABELS: Record<string, string> = {
  h: "얼굴",
  H: "이마(빛)",
  s: "턱 그늘",
  o: "윤곽",
  b: "눈꺼풀·큰턱",
  w: "흰자",
  p: "눈동자",
  g: "눈빛",
  m: "입술",
  M: "입술선",
  n: "더듬이",
  t: "몸",
  T: "몸 광택",
  q: "고인 눈물",
  Q: "눈물 깊이",
  L: "눈물 표면",
  u: "젖은 자리",
};

/** 자유 팔레트의 첫 색. 어두운 외곽선 → 밝은 하이라이트 순으로 한 줄 램프를 깔아둔다. */
export const FREE_DEFAULT: readonly Swatch[] = [
  { char: "o", color: "#1b1410", label: "외곽선" },
  { char: "d", color: "#4a3a2a", label: "그늘" },
  { char: "m", color: "#8a6a45", label: "바탕" },
  { char: "b", color: "#c49a63", label: "밝은 면" },
  { char: "H", color: "#f0d7a8", label: "하이라이트" },
  { char: "r", color: "#ff5c5c", label: "강조(빨강)" },
  { char: "u", color: "#5c9dff", label: "강조(파랑)" },
  { char: "W", color: "#ffffff", label: "흰색" },
];

function swatchesFrom(
  keys: Readonly<Record<string, string>>,
  colors: Readonly<Record<string, string>>,
  labels: Record<string, string>,
  order: readonly string[],
): Swatch[] {
  const chars = [...order, ...Object.keys(keys).filter((char) => !order.includes(char))];

  return chars
    .filter((char) => keys[char] !== undefined)
    .map((char) => ({
      char,
      color: colors[keys[char] ?? ""] ?? "#ff00ff",
      label: labels[char] ?? char,
    }));
}

export function labPalette(id: PaletteId, stage: number, free: readonly Swatch[]): LabPalette {
  if (id === "body") {
    return {
      id,
      title: "개미 몸",
      // 인터페이스(AntPalette)는 색인 접근을 안 받아준다 — 한 번 펼쳐 이름표로 만든다.
      swatches: swatchesFrom(
        ANT_COLOR_KEY,
        { ...antPalette(stage) },
        BODY_LABELS,
        Object.keys(BODY_LABELS),
      ),
      grid: { w: ANT_GRID, h: ANT_GRID },
      // 몸 맵에는 외곽선 글자가 없다 — 다리 색(제일 어둡다)이 그 자리를 대신한다.
      outlineChar: "l",
      editable: false,
    };
  }

  if (id === "face") {
    return {
      id,
      title: "클로즈업 얼굴",
      swatches: swatchesFrom(
        ANT_FACE_KEY,
        { ...antFacePalette(stage) },
        FACE_LABELS,
        Object.keys(FACE_LABELS),
      ),
      grid: { w: ANT_FACE_W, h: ANT_FACE_H },
      outlineChar: "o",
      editable: false,
    };
  }

  return {
    id,
    title: "자유",
    swatches: [...free],
    grid: null,
    outlineChar: free[0]?.char ?? "o",
    editable: true,
  };
}

/** 문자 → 색. 캔버스가 도트를 찍을 때 쓴다. */
export function paletteColors(palette: LabPalette): Record<string, string> {
  return Object.fromEntries(palette.swatches.map(({ char, color }) => [char, color]));
}
