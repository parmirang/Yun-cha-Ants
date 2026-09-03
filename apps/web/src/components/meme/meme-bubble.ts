import { CANVAS_H, CANVAS_W, DOT } from "@/lib/pixel-canvas";
import { BRAND } from "@/lib/share-copy";

import type { SceneBubble, SceneLabel } from "./meme-scenes";

/**
 * 말풍선과 서명은 **늘린 뒤 원본 해상도에 얹는다.**
 *
 * 무대는 격자 한 칸이 10px인 저해상도 그림이지만, 픽셀 폰트(Galmuri11)는 11px 격자다.
 * 무대 격자에 태우면 한 글자가 110px가 되어 화면을 다 먹는다. 그래서 글자는 늘린
 * 캔버스 위에 따로 그리고, 대신 **글자 크기를 11의 배수로만** 잡는다 — 그래야 폰트의
 * 도트 하나가 정확히 정수 픽셀(여기서는 4px)로 떨어져 흐려지지 않는다.
 *
 * 말풍선 상자·꼬리도 같은 4px 눈금에 맞춘다. 무대(10px)와 눈금이 다르지만, 글자보다
 * 굵은 테두리는 오히려 말풍선을 그림처럼 보이게 만든다 — 앱 화면의 말풍선도 개미보다
 * 고운 글씨로 떠 있다.
 */

/**
 * 폰트 도트 하나가 몇 픽셀인가 (11px 격자 × UNIT = 글자 크기).
 *
 * **11의 배수만 쓴다** — 그래야 폰트의 도트 하나가 정수 픽셀로 떨어져 안 흐려진다.
 * 그래서 "1.5배"처럼 어중간한 배율은 없고, 한 칸씩 오르내린다 (55 → 66 → 77px).
 *
 * **긴 문구는 글자를 줄이지 않고 줄을 바꾼다.** 예전엔 화면 폭에 들어가는 제일 큰 크기를
 * 골랐는데, 그러면 긴 줄만 글씨가 작아져 판을 넘길 때마다 말풍선 크기가 널뛰었다. 지금은
 * 제일 큰 크기로 두고 띄어쓰기에서 접는다 — 크기를 낮추는 건 **한 낱말이 통째로 폭을
 * 넘길 때뿐**이다 (그건 접을 자리가 없다).
 */
const UNITS = [7, 6, 5] as const;

/**
 * 꼬리 계단 수. **개미 머리와 상자 사이가 이만큼(UNIT × 계단) 벌어진다** — 짧게 두면
 * 말풍선이 개미 머리에 얹힌 것처럼 보여서, 머리 위 한 뼘을 비우도록 길게 잡았다.
 */
const TAIL_STEPS = 6;

const INK = "#1a1410";
const PAPER = "#f3ece2";

const fontOf = (unit: number) => `${11 * unit}px "Galmuri11", monospace`;
/** 화면 좌우 여백 — 말풍선이 여기 밖으로 나가면 잘린다 */
const marginOf = (unit: number) => unit * 8;
const padXOf = (unit: number) => unit * 3;

/**
 * 무대에 박히는 글자가 쓰는 크기 (역 이름 간판 · 하늘 자막 · 하락률).
 * **말풍선 크기와 따로 적어둬야 미리 깔린다** — 안 깔면 첫 프레임에서 그 글자만
 * 시스템 폰트로 떴다가 뒤늦게 픽셀 폰트로 바뀐다.
 */
const LABEL_UNITS = [12, 11, 8, 7] as const;

/** 픽셀 폰트를 미리 깔아둘 때 쓰는 서체 목록 (크기마다 따로 실린다) */
export function memeFontFaces(): string[] {
  return [...new Set([...UNITS, ...LABEL_UNITS])].map(fontOf);
}

export function memeFontFace(): string {
  return fontOf(UNITS[0]);
}

/**
 * 말풍선 안에 박히는 **그림글자**.
 *
 * 이모지를 시스템 폰트에 맡기지 않는다 — 픽셀 폰트(Galmuri11)에 없는 글자라 캔버스가
 * 그 자리를 빈칸으로 그려버렸고(실제로 아무것도 안 나왔다), 컬러 이모지로 떨어지는
 * 환경에서도 도트 글씨 옆에서 혼자 매끈해 튄다. 그래서 **11×11 도트로 직접 그린다** —
 * 폰트와 같은 격자라 한글 한 자와 폭이 정확히 같고(=`ICON_GRID * UNIT`), 크기를 키워도
 * 도트가 글씨와 함께 굵어진다.
 *
 * 글에는 이모지 글자를 그대로 적는다 (`"...귀여워 ❤️"`). 문구 파일을 읽는 사람에게는
 * 그게 제일 잘 읽히고, 글자 수 검사도 한 글자로 세어준다 — 그리는 쪽만 도트로 바꿔 끼운다.
 */
const ICON_GRID = 11;

const ICON_KEY: Readonly<Record<string, string>> = {
  r: "#e2445c",
  p: "#ff9aa8",
  c: "#c9962a",
  y: "#ffd24a",
  h: "#fff3b0",
  L: "#4ec07a",
  l: "#8fe0a0",
  s: "#3f8f3f",
  /* 모자이크 세 겹 — 회색끼리 명도만 갈라 판때기가 아니라 뭉갠 자국으로 읽힌다 */
  d: "#3a3a44",
  m: "#5e5e6b",
  v: "#8b8b98",
};

const ICONS: Readonly<Record<string, readonly string[]>> = {
  "❤️": [
    "...........",
    "..rr...rr..",
    ".rrrr.rrrr.",
    "rrpprrrrrrr",
    "rrprrrrrrrr",
    ".rrrrrrrrr.",
    "..rrrrrrr..",
    "...rrrrr...",
    "....rrr....",
    ".....r.....",
    "...........",
  ],
  /* 돈주머니 — 목이 잘록해야 지폐 뭉치가 아니라 주머니로 읽힌다 */
  "💰": [
    "...........",
    "....ccc....",
    "...c...c...",
    "..ccccccc..",
    ".cyyyyyyyc.",
    "cyyyyyyyyyc",
    "cyyyhyyyyyc",
    "cyyyyyyyyyc",
    "cyyyyyyyyyc",
    ".cyyyyyyyc.",
    "..ccccccc..",
  ],
  /*
   * 모자이크 — **가려진 욕이다.** 무슨 말인지 적지 않고 뭉개는 게 이 글자의 일이라,
   * 셋을 나란히 붙여 한 낱말처럼 쓴다. 격자를 3~4칸짜리 덩이로 나눠 명도를 엇갈리게
   * 깔았다 — 대각선으로 규칙이 서면 무늬로 보이고, 무늬는 안 가려진 것처럼 읽힌다.
   */
  "🤬": [
    "dddvvvmmmdd",
    "dddvvvmmmdd",
    "dddvvvmmmdd",
    "mmmdddvvvvv",
    "mmmdddvvvvv",
    "mmmdddvvvvv",
    "vvvmmmdddmm",
    "vvvmmmdddmm",
    "vvvmmmdddmm",
    "dddmmmvvvdd",
    "dddmmmvvvdd",
  ],
  "🌱": [
    "...........",
    "..ll...ll..",
    ".lLLl.lLLl.",
    ".lLLLsLLLl.",
    "..lLLsLLl..",
    "....lsl....",
    ".....s.....",
    ".....s.....",
    ".....s.....",
    "...........",
    "...........",
  ],
};

/** 글자 토막과 그림글자 토막. 재는 것도 그리는 것도 이 단위로 한다. */
type Run = { text: string; icon?: undefined } | { text?: undefined; icon: readonly string[] };

function splitRuns(line: string): Run[] {
  const runs: Run[] = [];
  let text = "";

  for (let i = 0; i < line.length; ) {
    const key = Object.keys(ICONS).find((candidate) => line.startsWith(candidate, i));
    if (key) {
      if (text) runs.push({ text });
      text = "";
      runs.push({ icon: ICONS[key] as readonly string[] });
      i += key.length;
      continue;
    }

    text += line[i];
    i += 1;
  }

  if (text) runs.push({ text });

  return runs;
}

/** 그림글자를 섞어 잰 줄 너비 */
function measureLine(ctx: CanvasRenderingContext2D, line: string, unit: number): number {
  return splitRuns(line).reduce(
    (total, run) =>
      total + (run.icon ? ICON_GRID * unit : ctx.measureText(run.text ?? "").width),
    0,
  );
}

/** 가운데 맞춰 한 줄을 그린다 — 글자는 폰트로, 그림글자는 도트로 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  centerX: number,
  top: number,
  unit: number,
): void {
  let x = Math.round((centerX - measureLine(ctx, line, unit) / 2) / unit) * unit;

  for (const run of splitRuns(line)) {
    if (run.icon) {
      run.icon.forEach((row, dy) => {
        [...row].forEach((char, dx) => {
          const color = ICON_KEY[char];
          if (!color) return;

          ctx.fillStyle = color;
          ctx.fillRect(x + dx * unit, top + dy * unit, unit, unit);
        });
      });
      x += ICON_GRID * unit;
      continue;
    }

    ctx.fillStyle = INK;
    ctx.fillText(run.text ?? "", x, top);
    x += ctx.measureText(run.text ?? "").width;
  }
}

/**
 * 이 문구를 담을 크기. **재는 건 문구 전체가 아니라 제일 긴 낱말**이다 — 나머지는
 * 줄바꿈이 알아서 접으므로, 낱말 하나가 폭을 넘길 때만 크기를 한 칸 낮춘다.
 */
function fittingUnit(ctx: CanvasRenderingContext2D, text: string): number {
  const words = text.split(/[\s\n]/);

  for (const unit of UNITS) {
    ctx.font = fontOf(unit);
    const room = CANVAS_W - padXOf(unit) * 2 - marginOf(unit) * 2;
    if (words.every((word) => measureLine(ctx, word, unit) <= room)) return unit;
  }

  return UNITS[UNITS.length - 1] as number;
}

/**
 * 줄을 **고르게** 접는다.
 *
 * 앞에서부터 채우기만 하면 마지막 줄에 한 낱말만 떨어져 ("눈 뜨면 올라 있을 / 거다")
 * 말풍선이 삐뚜름해진다. 그래서 접고 난 뒤, **줄 수가 늘지 않는 선에서 제일 좁은 폭**을
 * 찾아 한 번 더 접는다 — 같은 줄 수를 유지하는 가장 좁은 폭이 곧 제일 고른 줄이다.
 *
 * 한 문구는 늘 같은 결과라 캐시해 둔다 (1초에 60번 재는 자리다).
 */
const layoutCache = new Map<string, string[]>();

function layoutLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  unit: number,
  room: number,
): string[] {
  const key = `${unit}:${room}:${text}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;

  const greedy = wrapText(ctx, text, room, unit);
  let lines = greedy;

  if (greedy.length > 1) {
    let tooNarrow = 0;
    let fits = room;
    while (fits - tooNarrow > unit) {
      const middle = (tooNarrow + fits) / 2;
      if (wrapText(ctx, text, middle, unit).length > greedy.length) tooNarrow = middle;
      else fits = middle;
    }
    lines = wrapText(ctx, text, fits, unit);
  }

  layoutCache.set(key, lines);

  return lines;
}

/**
 * 띄어쓰기에서 접는다. 낱말 하나가 폭을 넘기면 그 줄은 그대로 둔다 (쪼갤 자리가 없다).
 *
 * 문구에 **줄바꿈(`\n`)이 박혀 있으면 거기서 먼저 끊는다** — 접히는 모양이 농담의
 * 일부인 줄이 있어서다 ("아직 월급 / 더 타야해"). 나머지 접기는 그 안에서 한다.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  room: number,
  unit: number,
): string[] {
  if (text.includes("\n")) {
    return text.split("\n").flatMap((part) => wrapText(ctx, part, room, unit));
  }

  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureLine(ctx, candidate, unit) > room) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines.length > 0 ? lines : [text];
}

export function drawBubble(ctx: CanvasRenderingContext2D, bubble: SceneBubble): void {
  if (bubble.alpha <= 0 || !bubble.text) return;

  ctx.save();
  ctx.globalAlpha = bubble.alpha;

  const UNIT = fittingUnit(ctx, bubble.text);
  const FONT_PX = 11 * UNIT;
  const PAD_X = padXOf(UNIT);
  const PAD_Y = UNIT * 2;
  const MARGIN = marginOf(UNIT);
  const snap = (value: number) => Math.round(value / UNIT) * UNIT;

  ctx.font = fontOf(UNIT);
  ctx.textBaseline = "top";

  /*
   * 접는 폭은 **화면 폭의 3분의 2**다. 여백까지 꽉 채워 접으면 한 줄짜리 긴 띠가 되어
   * 말풍선이 아니라 자막처럼 보인다 — 두어 줄로 접힌 네모라야 개미가 하는 말로 읽힌다.
   */
  const lines = layoutLines(ctx, bubble.text, UNIT, Math.round(CANVAS_W * 0.66) - PAD_X * 2);
  /* 줄 사이는 한 도트만 띄운다 — 픽셀 폰트라 넓게 벌리면 두 문장처럼 읽힌다 */
  const lineHeight = FONT_PX + UNIT;
  const textWidth = lines.reduce(
    (widest, line) => Math.max(widest, Math.ceil(measureLine(ctx, line, UNIT) / UNIT) * UNIT),
    0,
  );
  const boxW = textWidth + PAD_X * 2;
  const boxH = lines.length * lineHeight - UNIT + PAD_Y * 2;

  const tipX = bubble.x * DOT;
  const tipY = bubble.y * DOT;

  // 화면 밖으로 나가지 않게 상자를 안쪽으로 밀어 넣는다. 꼬리는 개미 머리에 그대로 둔다.
  const left = snap(
    Math.min(Math.max(tipX - boxW / 2, MARGIN), CANVAS_W - MARGIN - boxW),
  );
  const top = snap(Math.max(MARGIN, tipY - UNIT * TAIL_STEPS - boxH));

  // 그림자 — 하늘·우주·물 위 어디에 떠도 글자가 배경에 묻히지 않게 한 겹 깐다.
  ctx.globalAlpha = bubble.alpha * 0.35;
  ctx.fillStyle = "#000000";
  ctx.fillRect(left + UNIT, top + UNIT, boxW, boxH + UNIT * TAIL_STEPS);

  ctx.globalAlpha = bubble.alpha;
  ctx.fillStyle = PAPER;
  ctx.fillRect(left, top, boxW, boxH);

  // 꼬리 — 상자 아래에서 개미 머리로 좁아지며 내려간다.
  const tailX = snap(Math.min(Math.max(tipX, left + PAD_X), left + boxW - PAD_X));
  for (let step = 0; step < TAIL_STEPS; step += 1) {
    const width = UNIT * (TAIL_STEPS - step);
    ctx.fillRect(tailX - width / 2, top + boxH + step * UNIT, width, UNIT);
  }

  lines.forEach((line, index) => {
    drawLine(ctx, line, left + boxW / 2, top + PAD_Y + index * lineHeight, UNIT);
  });
  ctx.restore();
}

/**
 * 무대에 박히는 글자 (역 이름 간판). **상자를 안 그린다** — 간판 판때기는 무대가
 * 도트로 그리고 여기서는 그 위에 글자만 얹는다. 판때기까지 여기서 그리면 도트 그림과
 * 다른 해상도의 네모가 무대 한가운데에 서게 된다.
 */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: readonly SceneLabel[] | undefined,
): void {
  if (!labels?.length) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (const label of labels) {
    if (label.alpha <= 0 || !label.text) continue;

    ctx.globalAlpha = label.alpha;
    ctx.font = fontOf(label.unit);

    const x = Math.round(label.x * DOT);
    const y = Math.round(label.y * DOT);
    /*
     * 굵게 — **브라우저의 bold를 쓰지 않는다.** 픽셀 폰트에는 굵은 자체가 없어서
     * 합성 볼드가 획을 문질러 흐려진다. 대신 **도트 하나(=unit)만큼 옆으로 겹쳐 찍어**
     * 획을 한 도트 불린다. 폰트 격자에 딱 떨어지므로 도트가 안 흐려진다.
     */
    const stamp = (dx: number, dy: number) => {
      ctx.fillText(label.text, x + dx, y + dy);
      if (label.bold) ctx.fillText(label.text, x + dx - label.unit, y + dy);
    };

    /*
     * 외곽선도 같은 눈금이다 — **도트 하나(=unit)만큼 밀어** 여덟 방향으로 깔고 그 위에
     * 글자를 얹는다. 1픽셀씩 밀면 글자 도트보다 가는 선이 생겨 해상도가 어긋나 보인다
     * (개미에 테두리를 두를 때와 같은 규칙). 배경색을 못 고르는 자리에서만 쓴다.
     */
    if (label.outline) {
      ctx.fillStyle = label.outline;
      const u = label.unit;
      for (const [dx, dy] of [
        [-u, 0],
        [u, 0],
        [0, -u],
        [0, u],
        [-u, -u],
        [u, -u],
        [-u, u],
        [u, u],
      ] as const) {
        stamp(dx, dy);
      }
    }

    ctx.fillStyle = label.color ?? INK;
    stamp(0, 0);
  }

  ctx.restore();
}

/**
 * 오른쪽 아래 서명. **주소는 안 적는다** — 영상 속 글자는 눌리지 않아서 주소를 적어봐야
 * 옮겨 적을 사람이 없고, 대신 이름만 남긴다 (인스타 스토리 카드와 같은 규칙).
 */
export function drawBrand(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = fontOf(3);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";

  const margin = marginOf(5);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#000000";
  ctx.fillText(BRAND, CANVAS_W - margin + 3, CANVAS_H - margin + 3);
  ctx.fillStyle = PAPER;
  ctx.fillText(BRAND, CANVAS_W - margin, CANVAS_H - margin);
  ctx.restore();
}
