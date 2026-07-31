import { STAGE_COUNT } from "@yca/shared";

/**
 * 옆뷰 픽셀아트 개미. 16x16 그리드를 문자맵으로 정의하고 SVG <rect>로 찍는다.
 *
 * 오른쪽을 보고 있다 — 왼쪽에서 등장할 때는 `flip`으로 뒤집는다.
 * 기어올 때는 몸이 수평(배-가슴-머리)이고, 서면 수직으로 일어난다.
 *
 * **몸은 머리·가슴·배 세 덩이다.** 세 덩이는 1픽셀짜리 목과 자루마디로만 잇고,
 * 이 이음매를 덩이보다 반드시 얇게 그린다 — 같은 두께로 이으면 잘록한 허리가
 * 사라지고 통짜 한 덩이로 뭉쳐 보인다. 목과 자루마디는 가슴 색(t)을 그대로 쓴다.
 *
 * **머리가 셋 중 제일 크다.** 실제 개미는 배가 제일 크지만, 그렇게 그리면
 * 16픽셀에서는 머리가 혹처럼 보인다. 캐릭터로 읽히도록 머리 > 배 > 가슴으로 잡았다.
 *
 * **더듬이는 두 개, 다리는 여섯 개다.** 옆뷰라 반대쪽이 가려지지만 개미의 표식이라
 * 둘 다 세어지게 그린다. 기어갈 때는 여섯 다리를 세 쌍으로 묶어 나란히 두고,
 * 서 있을 때는 앞다리 한 쌍이 팔(w)이 되어 2팔 + 4다리로 여섯을 채운다.
 *
 * **입은 얼굴 앞쪽(오른쪽)으로 뾰족하게 튀어나온다.** 머리 앞모서리를 줄마다 한 칸씩
 * 내밀어 부리처럼 각을 세운다 — 이게 없으면 머리가 그냥 둥근 덩어리로만 보인다.
 * 그래서 팔은 머리 위로 들지 않고 앞뒤로 흔든다("영차" 동작). 위로 들면 팔이
 * 부리 옆을 지나면서 부리에 붙어 실루엣이 뭉갠다.
 *
 * **프레임 사이에 바뀌는 건 팔(w)과 다리(l)뿐이다.** 몸통 픽셀은 자세가 같으면
 * 좌표까지 같아야 한다 — 대문은 두 프레임을 겹쳐놓고 번갈아 보여주므로,
 * 몸통이 같이 흔들리면 춤이 아니라 화면이 떨리는 것처럼 보인다.
 *
 *  .  투명   n 더듬이   h 머리   e 눈
 *  t  가슴 (목·자루마디 포함)   w 팔(앞다리)
 *  g  배     G 배 광택          l 다리
 */

export type AntPose = "crawl1" | "crawl2" | "stand" | "wave1" | "wave2";

const POSES: Record<AntPose, readonly string[]> = {
  /*
   * 기어가기 — 몸이 수평이다. 왼쪽부터 배·자루마디·가슴·목·머리 순이고,
   * 이음매(x5, x9)는 가운데 줄(10)에만 있어서 위아래 줄에 잘록한 틈이 생긴다.
   *
   * 다리 여섯은 전부 가슴에 붙는다 (배에 달면 세 덩이 경계가 다리에 묻힌다).
   * 나란한 두 픽셀이 한 쌍이고, 안쪽 다리가 한 줄 짧아 뒤에 있는 것처럼 보인다.
   * 발끝은 마지막 줄(15)에 닿는다 — 위로 띄우면 바닥선 위에 뜬 것처럼 보인다.
   */
  crawl1: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "............n.n.",
    "...........n.n..",
    "..........n.n...",
    "..........hhh...",
    ".gggg.ttt.hhhh..",
    "ggGGgttttthhehh.",
    ".gggg.ttt.hhhhhh",
    ".....llllllhhh..",
    "....ll.ll.ll....",
    "...ll..ll..ll...",
    "..l....l....l...",
  ],
  crawl2: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "............n.n.",
    "...........n.n..",
    "..........n.n...",
    "..........hhh...",
    ".gggg.ttt.hhhh..",
    "ggGGgttttthhehh.",
    ".gggg.ttt.hhhhhh",
    ".....llllllhhh..",
    ".....ll.ll.ll...",
    "....ll..ll..ll..",
    "....l...l....l..",
  ],
  /*
   * 서기 — 몸이 수직으로 선다. 위에서부터 더듬이(0~1) · 머리(2~5) · 목(6) ·
   * 가슴(7~8) · 자루마디(9) · 배(10~12)이고, 다리 넷은 그 아래 세 줄을 쓴다.
   * 앞다리 한 쌍은 몸 양옆으로 내린 팔(w)이다 — 팔 2 + 다리 4 = 여섯.
   */
  stand: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttw.....",
    "...w.ttttt.w....",
    "...w...t...w....",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  /*
   * 춤 — stand와 몸통은 같고 팔다리만 바뀐다. 한 팔을 앞으로 뻗으면 반대쪽 팔은
   * 내리고, 그에 맞춰 네 다리가 넓게 벌어졌다 좁아진다. 양팔이 같이 움직이면
   * 만세로 보인다 — 엇갈려야 "영차" 하고 밀어 올리는 동작이 된다.
   */
  wave1: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttww....",
    "...w.ttttt..w...",
    "...w...t........",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
    "..l...l.l...l...",
  ],
  wave2: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "...wwtttttw.....",
    "..w..ttttt.w....",
    ".......t...w....",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
};

export const ANT_GRID = 16;

/**
 * 자세마다 그림이 시작되는 줄이 다르다 (기어갈 때는 몸이 낮아 위가 비고,
 * 서면 팔이 맨 윗줄까지 올라간다). 말풍선을 머리 바로 위에 붙이려면
 * 그 빈 줄만큼 내려와야 한다 — 안 그러면 자세가 바뀔 때 말풍선이 붕 뜬다.
 */
const TOP_OFFSETS: Record<AntPose, number> = Object.fromEntries(
  (Object.keys(POSES) as AntPose[]).map((pose) => {
    const first = POSES[pose].findIndex((row) => [...row].some((char) => char !== "."));
    return [pose, (first < 0 ? 0 : first) / ANT_GRID];
  }),
) as Record<AntPose, number>;

/** 스프라이트 상자 위쪽에서 개미 꼭대기까지의 비율 (0~1) */
export function antTopOffset(pose: AntPose): number {
  return TOP_OFFSETS[pose];
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
  // 팔도 결국 앞다리라 다리 색(어두움)을 쓴다. 가슴 색으로 칠하면 가슴에 붙은
  // 팔이 몸통에 묻혀 그냥 넓은 가슴으로 보인다 — 어두워야 팔로 읽힌다.
  w: "limb",
  g: "gaster",
  G: "gloss",
  l: "limb",
  n: "limb",
  e: "eye",
};

function rects(stage: number, pose: AntPose): { x: number; y: number; fill: string }[] {
  const palette = antPalette(stage);
  const pixels: { x: number; y: number; fill: string }[] = [];

  POSES[pose].forEach((row, y) => {
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
export function antSvgMarkup(stage: number, pose: AntPose = "stand"): string {
  const body = rects(stage, pose)
    .map(({ x, y, fill }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANT_GRID} ${ANT_GRID}" shape-rendering="crispEdges">${body}</svg>`;
}

export function antDataUri(stage: number, pose: AntPose = "stand"): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(antSvgMarkup(stage, pose))}`;
}

export function AntSprite({
  stage,
  pose = "stand",
  flip = false,
  className,
}: {
  stage: number;
  pose?: AntPose;
  /** 왼쪽을 보게 뒤집는다 (기본은 오른쪽을 봄) */
  flip?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${ANT_GRID} ${ANT_GRID}`}
      shapeRendering="crispEdges"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      role="img"
      aria-label={`개미 상태 ${stage + 1}단계 / ${STAGE_COUNT}단계`}
    >
      {rects(stage, pose).map(({ x, y, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
      ))}
    </svg>
  );
}
