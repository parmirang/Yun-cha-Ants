import { STAGE_COUNT } from "@yca/shared";

/**
 * 탑뷰 픽셀아트 엔트. 16x16 그리드를 문자맵으로 정의하고 SVG <rect>로 찍는다.
 *
 *  .  투명   c 잎(중간)   l 잎(밝음)   a 가지팔
 *  b  몸통   e 눈         m 입         f 뿌리발
 */
const ENT_MAP = [
  "......cccc......",
  "....ccllllcc....",
  "..cclllllllcc...",
  "..cclllllllllcc.",
  ".ccclllllllllccc",
  "acccllllllllccca",
  "acccllllllllccca",
  ".ccclllllllllcc.",
  "..ccclllllllcc..",
  "...ccclllllccc..",
  "....ccbbbbbcc...",
  "....cbebbebc....",
  ".....bbmmbb.....",
  ".....bbbbbb.....",
  "....ff....ff....",
  "................",
] as const;

export const ENT_GRID = 16;

export interface EntPalette {
  leaf: string;
  leafLight: string;
  branch: string;
  body: string;
  eye: string;
  mouth: string;
  root: string;
}

/**
 * 단계(0~49)에 따라 잎 색을 마른 갈색 → 무성한 초록으로 연속 보간한다.
 * 50단계를 5색 버킷으로 끊으면 계단이 눈에 보여서, 색상/채도/명도를 함께 민다.
 */
export function entPalette(stage: number): EntPalette {
  const t = Math.min(1, Math.max(0, stage / (STAGE_COUNT - 1)));
  const hue = 26 + t * 96;
  const saturation = 32 + t * 38;
  // 어두운 배경(#14100c)에 묻히지 않도록 최저 명도를 34%로 잡는다.
  // 0단계는 검정이 아니라 "마른 갈색"이어야 시든 상태로 읽힌다.
  const lightness = 34 + t * 20;

  // OG 이미지를 굽는 resvg의 hsl() 파서는 소수점 hue를 거부하고 fill을 검정으로
  // 떨군다(브라우저는 멀쩡히 그린다). 모든 성분을 정수로 반올림해서 넘긴다.
  const hsl = (h: number, s: number, l: number) =>
    `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

  return {
    leaf: hsl(hue, saturation, lightness),
    leafLight: hsl(hue, saturation + 6, lightness + 12),
    branch: hsl(24, 30, 30 + t * 8),
    body: hsl(26, 34, 32 + t * 8),
    // 시들수록 눈빛이 흐려진다.
    eye: hsl(200, 12 + t * 34, 14 + t * 8),
    mouth: hsl(12, 26, 20 + t * 6),
    root: hsl(26, 28, 26 + t * 6),
  };
}

const COLOR_KEY: Record<string, keyof EntPalette> = {
  c: "leaf",
  l: "leafLight",
  a: "branch",
  b: "body",
  e: "eye",
  m: "mouth",
  f: "root",
};

/**
 * 같은 문자맵을 SVG 문자열로 뽑는다.
 * OG 이미지 렌더러(satori)는 SVG 엘리먼트를 직접 못 그리고 <img>만 받으므로,
 * 이걸 data URI로 감싸서 넘긴다.
 */
export function entSvgMarkup(stage: number): string {
  const palette = entPalette(stage);
  const rects: string[] = [];

  ENT_MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const key = COLOR_KEY[char];
      if (!key) return;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[key]}"/>`);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ENT_GRID} ${ENT_GRID}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

export function entDataUri(stage: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(entSvgMarkup(stage))}`;
}

export function EntSprite({
  stage,
  className,
}: {
  stage: number;
  className?: string;
}) {
  const palette = entPalette(stage);
  const pixels: React.ReactElement[] = [];

  ENT_MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const key = COLOR_KEY[char];
      if (!key) return;

      pixels.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={palette[key]}
        />,
      );
    });
  });

  return (
    <svg
      viewBox={`0 0 ${ENT_GRID} ${ENT_GRID}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`엔트 상태 ${stage + 1}단계 / ${STAGE_COUNT}단계`}
    >
      {pixels}
    </svg>
  );
}
