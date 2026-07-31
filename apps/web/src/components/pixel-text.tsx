/**
 * 도트 글씨. 개미 스프라이트와 같은 방식으로 문자맵을 SVG <rect>로 찍는다.
 *
 * 대문 문구("영-차! 개미들아") 전용 서브셋이다. 픽셀 웹폰트를 얹지 않은 건
 * 단일 HTML 목업 때문이다 — 목업은 파일 하나로 끝나야 하는데 웹폰트는 외부 요청이
 * 필요하다. 로고 한 줄은 직접 찍는 쪽이 목업·OG 이미지에서 확실하다.
 *
 * 글자 하나는 11픽셀 높이에 폭은 제각각이고, 사이는 1픽셀씩 띄운다.
 * 새 문구를 그리려면 여기에 글리프를 추가한다 — 없는 글자는 두부(□)로 찍힌다.
 */

export const PIXEL_TEXT_HEIGHT = 11;

/** 글자 사이 간격 (픽셀) */
const LETTER_GAP = 1;

/** 낱말 사이 공백. 잉크는 없고 폭만 차지한다. */
const SPACE = Array.from({ length: PIXEL_TEXT_HEIGHT }, () => "...");

/** 글리프가 없는 글자. 빠진 걸 눈으로 바로 알아채라고 빈 네모로 찍는다. */
const TOFU = [
  ".....",
  ".###.",
  ".#.#.",
  ".#.#.",
  ".#.#.",
  ".#.#.",
  ".#.#.",
  ".#.#.",
  ".###.",
  ".....",
  ".....",
] as const;

const GLYPHS: Record<string, readonly string[]> = {
  " ": SPACE,

  // ㅇ + ㅕ + 받침 ㅇ
  영: [
    ".###....#",
    "#...#.###",
    "#...#...#",
    "#...#...#",
    "#...#.###",
    ".###....#",
    ".........",
    "...###...",
    "..#...#..",
    "..#...#..",
    "...###...",
  ],

  // ㅊ + ㅏ. ㅏ의 세로획은 x6이고 가로획이 오른쪽으로 뻗는다 —
  // 세로획을 끝(x8)에 두면 가로획이 왼쪽으로 붙어 ㅓ가 된다.
  차: [
    "......#..",
    ".##...#..",
    "......#..",
    "#####.#..",
    "......#..",
    "..#...###",
    ".#.#..#..",
    ".#.#..#..",
    "#...#.#..",
    "#...#.#..",
    "......#..",
  ],

  // ㄱ + ㅐ
  개: [
    ".....#..#",
    "####.#..#",
    "...#.#..#",
    "...#.#..#",
    "...#.#..#",
    "...#.####",
    "...#.#..#",
    "...#.#..#",
    ".....#..#",
    ".....#..#",
    ".....#..#",
  ],

  // ㅁ + ㅣ
  미: [
    "........#",
    "........#",
    "######..#",
    "#....#..#",
    "#....#..#",
    "#....#..#",
    "#....#..#",
    "#....#..#",
    "######..#",
    "........#",
    "........#",
  ],

  // ㄷ + ㅡ + 받침 ㄹ
  들: [
    ".#######.",
    ".#.......",
    ".#######.",
    ".........",
    "#########",
    ".........",
    ".#######.",
    ".......#.",
    ".#######.",
    ".#.......",
    ".#######.",
  ],

  // ㅇ + ㅏ
  아: [
    "......#..",
    "......#..",
    ".###..#..",
    "#...#.#..",
    "#...#.#..",
    "#...#.###",
    "#...#.#..",
    "#...#.#..",
    ".###..#..",
    "......#..",
    "......#..",
  ],

  "-": [
    ".....",
    ".....",
    ".....",
    ".....",
    ".....",
    "#####",
    ".....",
    ".....",
    ".....",
    ".....",
    ".....",
  ],

  "!": ["##", "##", "##", "##", "##", "##", "##", "##", "..", "##", "##"],
};

function glyphWidth(glyph: readonly string[]): number {
  return glyph[0]?.length ?? 0;
}

/** 글자마다 커서를 옮겨가며 잉크 칸의 좌표를 모은다. */
function pixels(text: string): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  let cursor = 0;

  for (const char of text) {
    const glyph = GLYPHS[char] ?? TOFU;

    glyph.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") dots.push({ x: cursor + x, y });
      });
    });

    cursor += glyphWidth(glyph) + LETTER_GAP;
  }

  return dots;
}

export function pixelTextWidth(text: string): number {
  let width = 0;
  for (const char of text) width += glyphWidth(GLYPHS[char] ?? TOFU) + LETTER_GAP;

  return Math.max(width - LETTER_GAP, 1);
}

/**
 * 색은 `currentColor`를 따른다 — 부르는 쪽에서 `color`로 정한다.
 * 높이만 주고 폭은 `w-auto`로 두면 viewBox 비율대로 늘어난다.
 */
export function PixelText({ text, className }: { text: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${pixelTextWidth(text)} ${PIXEL_TEXT_HEIGHT}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={text}
    >
      {pixels(text).map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
    </svg>
  );
}
