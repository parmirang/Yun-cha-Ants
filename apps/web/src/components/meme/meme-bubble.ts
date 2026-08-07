import { CANVAS_H, CANVAS_W, DOT } from "@/lib/pixel-canvas";
import { BRAND } from "@/lib/share-copy";

import type { SceneBubble } from "./meme-scenes";

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
 * 큰 것부터 시도해서 **화면 폭에 들어가는 제일 큰 크기**를 고른다. 문구는 14자로 묶여
 * 있지만(`check-lines.mjs`) 한글은 한 자가 온폭이라 길이가 제각각이고, 제일 큰 크기로
 * 못 박아두면 긴 줄에서 상자가 화면 밖으로 나간다 — 그 한 줄만 한 칸 작게 그린다.
 */
const UNITS = [7, 6, 5] as const;

const INK = "#1a1410";
const PAPER = "#f3ece2";

const fontOf = (unit: number) => `${11 * unit}px "Galmuri11", monospace`;
/** 화면 좌우 여백 — 말풍선이 여기 밖으로 나가면 잘린다 */
const marginOf = (unit: number) => unit * 8;
const padXOf = (unit: number) => unit * 3;

/** 픽셀 폰트를 미리 깔아둘 때 쓰는 서체 목록 (크기마다 따로 실린다) */
export function memeFontFaces(): string[] {
  return UNITS.map(fontOf);
}

export function memeFontFace(): string {
  return fontOf(UNITS[0]);
}

/** 이 줄이 여백 안에 들어가는 제일 큰 크기 */
function fittingUnit(ctx: CanvasRenderingContext2D, text: string): number {
  for (const unit of UNITS) {
    ctx.font = fontOf(unit);
    const width = ctx.measureText(text).width + padXOf(unit) * 2 + marginOf(unit) * 2;
    if (width <= CANVAS_W) return unit;
  }

  return UNITS[UNITS.length - 1] as number;
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

  const textWidth = Math.ceil(ctx.measureText(bubble.text).width / UNIT) * UNIT;
  const boxW = textWidth + PAD_X * 2;
  const boxH = FONT_PX + PAD_Y * 2;

  const tipX = bubble.x * DOT;
  const tipY = bubble.y * DOT;

  // 화면 밖으로 나가지 않게 상자를 안쪽으로 밀어 넣는다. 꼬리는 개미 머리에 그대로 둔다.
  const left = snap(
    Math.min(Math.max(tipX - boxW / 2, MARGIN), CANVAS_W - MARGIN - boxW),
  );
  const top = snap(Math.max(MARGIN, tipY - UNIT * 3 - boxH));

  // 그림자 — 하늘·우주·물 위 어디에 떠도 글자가 배경에 묻히지 않게 한 겹 깐다.
  ctx.globalAlpha = bubble.alpha * 0.35;
  ctx.fillStyle = "#000000";
  ctx.fillRect(left + UNIT, top + UNIT, boxW, boxH + UNIT * 3);

  ctx.globalAlpha = bubble.alpha;
  ctx.fillStyle = PAPER;
  ctx.fillRect(left, top, boxW, boxH);

  // 꼬리 — 상자 아래에서 개미 머리로 좁아지며 내려간다 (계단 세 칸).
  const tailX = snap(Math.min(Math.max(tipX, left + PAD_X), left + boxW - PAD_X));
  for (let step = 0; step < 3; step += 1) {
    const width = UNIT * (6 - step * 2);
    ctx.fillRect(tailX - width / 2, top + boxH + step * UNIT, width, UNIT);
  }

  ctx.fillStyle = INK;
  ctx.fillText(bubble.text, left + PAD_X, top + PAD_Y);
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
