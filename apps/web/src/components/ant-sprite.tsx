import { STAGE_COUNT } from "@yca/shared";

/**
 * 탑뷰 픽셀아트 개미. 16x16 그리드를 문자맵으로 정의하고 SVG <rect>로 찍는다.
 * 위쪽(머리 방향)으로 걸어가는 모습이라 발자국이 아래로 흘러 나간다.
 *
 *  .  투명   n 더듬이   h 머리   e 눈
 *  t  가슴   l 다리     g 배     G 배 광택
 */

/** 더듬이는 상태에 따라 축 처지거나 쫑긋 선다 — 색만이 아니라 형태도 바뀐다. */
const ANTENNAE = {
  // 지쳐서 옆으로 늘어짐
  droop: [
    "................",
    "................",
    "...nn......nn...",
    "....nnhhhhnn....",
  ],
  neutral: [
    "................",
    "...n........n...",
    "....n......n....",
    ".....nhhhhn.....",
  ],
  // 신나서 위로 뻗음
  perk: [
    "..n..........n..",
    "...n........n...",
    "....n......n....",
    ".....nhhhhn.....",
  ],
} as const;

// 다리 세 쌍은 모두 가슴(t)에 붙고, 배(g)는 그 뒤로 떨어져 나온다.
const ANT_BODY = [
  "......hhhh......",
  ".....hehheh.....",
  "..llllttttllll..",
  "......tttt......",
  ".lllllttttlllll.",
  "......tttt......",
  "..llllttttllll..",
  ".......gg.......",
  "......gggg......",
  ".....gGGGGg.....",
  ".....gGGGGg.....",
  "......gggg......",
] as const;

export const ANT_GRID = 16;

function antMap(stage: number): readonly string[] {
  const antennae =
    stage < 17 ? ANTENNAE.droop : stage < 34 ? ANTENNAE.neutral : ANTENNAE.perk;

  return [...antennae, ...ANT_BODY];
}

export interface AntPalette {
  head: string;
  thorax: string;
  gaster: string;
  gloss: string;
  limb: string;
  eye: string;
}

/**
 * 단계(0~49)에 따라 개미 껍질 색을 창백한 회갈색 → 윤기나는 붉은 개미로 보간한다.
 * 손실이 클수록 탈진한 것처럼 채도가 빠지고, 수익이 클수록 불개미처럼 붉어진다.
 *
 * OG 이미지를 굽는 resvg의 hsl() 파서는 소수점 hue를 거부하고 fill을 검정으로
 * 떨군다(브라우저는 멀쩡히 그린다). 모든 성분을 정수로 반올림해서 넘긴다.
 */
export function antPalette(stage: number): AntPalette {
  const t = Math.min(1, Math.max(0, stage / (STAGE_COUNT - 1)));
  const hue = 30 - t * 18;
  const saturation = 8 + t * 54;
  const lightness = 33 + t * 13;

  const hsl = (h: number, s: number, l: number) =>
    `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

  return {
    head: hsl(hue, saturation, lightness - 5),
    thorax: hsl(hue, saturation, lightness),
    gaster: hsl(hue, saturation, lightness - 2),
    gloss: hsl(hue, saturation + 8, lightness + 11),
    limb: hsl(hue, saturation, lightness - 13),
    eye: hsl(45, 14 + t * 26, 68 + t * 17),
  };
}

const COLOR_KEY: Record<string, keyof AntPalette> = {
  h: "head",
  t: "thorax",
  g: "gaster",
  G: "gloss",
  l: "limb",
  n: "limb",
  e: "eye",
};

function rects(stage: number): { x: number; y: number; fill: string }[] {
  const palette = antPalette(stage);
  const pixels: { x: number; y: number; fill: string }[] = [];

  antMap(stage).forEach((row, y) => {
    [...row].forEach((char, x) => {
      const key = COLOR_KEY[char];
      if (key) pixels.push({ x, y, fill: palette[key] });
    });
  });

  return pixels;
}

/**
 * 같은 문자맵을 SVG 문자열로 뽑는다.
 * OG 이미지 렌더러(satori)는 SVG 엘리먼트를 직접 못 그리고 <img>만 받으므로,
 * 이걸 data URI로 감싸서 넘긴다.
 */
export function antSvgMarkup(stage: number): string {
  const body = rects(stage)
    .map(({ x, y, fill }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANT_GRID} ${ANT_GRID}" shape-rendering="crispEdges">${body}</svg>`;
}

export function antDataUri(stage: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(antSvgMarkup(stage))}`;
}

export function AntSprite({
  stage,
  className,
}: {
  stage: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${ANT_GRID} ${ANT_GRID}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`개미 상태 ${stage + 1}단계 / ${STAGE_COUNT}단계`}
    >
      {rects(stage).map(({ x, y, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
      ))}
    </svg>
  );
}
