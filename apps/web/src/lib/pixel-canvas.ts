/**
 * 도트 그림을 그리는 저해상도 캔버스.
 *
 * **무대는 108×192(9:16) 격자에 그리고, 화면·영상으로는 10배로 늘려 찍는다.**
 * 늘릴 때 `imageSmoothingEnabled = false`라 한 칸이 정확히 10×10 픽셀로 커진다 —
 * 곧 격자 한 칸이 도트 하나다. 처음부터 1080×1920에 그리면 선 하나 그을 때마다
 * 좌표를 10으로 나눠야 하고, 반올림이 어긋나는 순간 도트 크기가 들쭉날쭉해진다.
 *
 * 그래서 이 파일의 좌표는 전부 **격자 칸 단위**이고 정수로 반올림된다.
 * 화면에 찍히는 도트 크기가 하나뿐이어야 개미 스프라이트(16×16)와 배경이 같은
 * 해상도의 그림으로 읽힌다.
 *
 * 예외는 말풍선 글자뿐이다 — 픽셀 폰트는 11px 격자라 무대 격자에 안 맞고,
 * 무대 도트(10px)로 찍으면 한 글자가 110px가 된다. 글자는 늘린 뒤 원본 해상도에
 * 따로 얹는다 (`drawBubble`).
 */

/** 무대 격자. 9:16이라 그대로 세로 판형이다. */
export const GRID_W = 108;
export const GRID_H = 192;

/** 격자 한 칸이 몇 픽셀로 커지는가 — 1080×1920 (인스타 스토리 규격) */
export const DOT = 10;

export const CANVAS_W = GRID_W * DOT;
export const CANVAS_H = GRID_H * DOT;

export interface Painter {
  readonly w: number;
  readonly h: number;
  /** 무대 전체를 한 색으로 덮는다 */
  clear(color: string): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  dot(x: number, y: number, color: string): void;
  /** 꽉 찬 원. 줄마다 반지름을 다시 재서 계단이 고르게 진다. */
  disc(cx: number, cy: number, r: number, color: string): void;
  /** 두 점을 잇는 도트 선 */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void;
  /** 세로 그라데이션 — 줄 단위로 색을 섞어 칠한다 */
  vGradient(y0: number, y1: number, top: string, bottom: string): void;
  /** 개미 같은 문자맵 스프라이트를 배율만큼 키워 찍는다 */
  sprite(
    pixels: readonly { x: number; y: number; fill: string }[],
    left: number,
    top: number,
    scale: number,
    flip?: boolean,
  ): void;
  /** 네모 안으로만 그리게 잘라낸다 (하늘에만 비를 뿌릴 때처럼) */
  clipped(x: number, y: number, w: number, h: number, draw: () => void): void;
  /** 반투명하게 겹쳐 그린다 (물속·안개) */
  faded(alpha: number, draw: () => void): void;
}

export function createPainter(ctx: CanvasRenderingContext2D): Painter {
  const round = Math.round;

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    const left = round(x);
    const top = round(y);
    const right = round(x + w);
    const bottom = round(y + h);
    if (right <= left || bottom <= top) return;

    ctx.fillStyle = color;
    ctx.fillRect(left, top, right - left, bottom - top);
  };

  return {
    w: GRID_W,
    h: GRID_H,

    clear(color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, GRID_W, GRID_H);
    },

    rect,

    dot(x, y, color) {
      rect(x, y, 1, 1, color);
    },

    disc(cx, cy, r, color) {
      for (let dy = -r; dy <= r; dy += 1) {
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        rect(cx - half, cy + dy, half * 2, 1, color);
      }
    },

    line(x0, y0, x1, y1, color) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      if (steps === 0) {
        rect(x0, y0, 1, 1, color);
        return;
      }

      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        rect(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1, 1, color);
      }
    },

    vGradient(y0, y1, top, bottom) {
      const height = Math.max(1, round(y1) - round(y0));

      for (let i = 0; i < height; i += 1) {
        rect(0, round(y0) + i, GRID_W, 1, mixColor(top, bottom, i / Math.max(1, height - 1)));
      }
    },

    sprite(pixels, left, top, scale, flip = false) {
      for (const pixel of pixels) {
        // 뒤집을 때는 오른쪽 끝(16칸)에서 되짚는다 — 칸 폭(1)을 빼야 한 칸이 밀리지 않는다.
        const x = flip ? 15 - pixel.x : pixel.x;
        rect(left + x * scale, top + pixel.y * scale, scale, scale, pixel.fill);
      }
    },

    clipped(x, y, w, h, draw) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(round(x), round(y), round(w), round(h));
      ctx.clip();
      draw();
      ctx.restore();
    },

    faded(alpha, draw) {
      const previous = ctx.globalAlpha;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      draw();
      ctx.globalAlpha = previous;
    },
  };
}

/* ── 색 ─────────────────────────────────────────────── */

/** `#rrggbb` 두 색을 t(0~1)로 섞는다. 하늘색이 고도에 따라 넘어갈 때 쓴다. */
export function mixColor(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const k = Math.max(0, Math.min(1, t));

  const channel = (index: number) =>
    Math.round((a[index] ?? 0) + ((b[index] ?? 0) - (a[index] ?? 0)) * k);

  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * 여러 색을 정거장(stop)으로 두고 그 사이를 잇는다. 산 → 구름 → 우주처럼
 * 색이 세 번 넘어가는 배경은 두 색 보간만으로는 안 나온다. 범위 밖은 양 끝 색이다.
 *
 * **오름차순·내림차순을 둘 다 받는다.** 하늘 정거장은 "위로 갈수록 어둡다"처럼
 * 세계를 위에서 아래로 적는 게 자연스러운데, 오름차순만 받으면 그렇게 적은 배열이
 * 조용히 **첫 색 하나로 고정**된다 — 색이 안 변하는 걸 눈으로 보기 전에는 모른다.
 */
export function gradientAt(stops: readonly [number, string][], at: number): string {
  const head = stops[0];
  const tail = stops[stops.length - 1];
  if (!head || !tail) return "#000000";

  // 내림차순으로 적혔으면 뒤에서부터 읽는다 (배열을 뒤집으면 매 호출 새 배열이 생긴다).
  const ascending = head[0] <= tail[0];
  const stop = (index: number) => stops[ascending ? index : stops.length - 1 - index];

  const first = stop(0);
  const last = stop(stops.length - 1);
  if (!first || !last) return "#000000";
  if (at <= first[0]) return first[1];
  if (at >= last[0]) return last[1];

  for (let i = 1; i < stops.length; i += 1) {
    const previous = stop(i - 1);
    const current = stop(i);
    if (!previous || !current) continue;

    if (at <= current[0]) {
      const span = current[0] - previous[0] || 1;
      return mixColor(previous[1], current[1], (at - previous[0]) / span);
    }
  }

  return last[1];
}

function parseHex(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? [...hex].map((char) => char + char).join("")
      : hex.padEnd(6, "0").slice(0, 6);

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/* ── 난수 ───────────────────────────────────────────── */

/**
 * 씨앗을 고정한 난수. 별자리·흙 얼룩처럼 **매 프레임 같은 자리에 있어야 하는 것**은
 * `Math.random()`으로 뽑으면 안 된다 — 1초에 60번 자리를 바꿔 화면이 지글거린다.
 */
export function seededRandom(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 2147483647 || 1;

  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/* ── 시간 ───────────────────────────────────────────── */

/** 0~1로 자른다 */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

/** 뒤로 갈수록 느려진다 — 카메라 줌·물 차오름처럼 "도착"이 있는 움직임에 쓴다 */
export function easeOut(t: number): number {
  const k = clamp01(t);
  return 1 - (1 - k) * (1 - k);
}

/** 양끝이 느리다 */
export function easeInOut(t: number): number {
  const k = clamp01(t);
  return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
}
