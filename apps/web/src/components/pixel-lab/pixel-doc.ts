/**
 * 도트 랩의 그림 모델.
 *
 * 그림 한 장은 **문자맵 한 벌**이다 — [ant-sprite.tsx](../ant-sprite.tsx)의 POSES와
 * 똑같은 모양(한 줄이 문자열 하나, `.`이 투명)이라 랩에서 그린 걸 그대로 코드에 붙일 수
 * 있다. 화면용 자료구조를 따로 두고 마지막에 변환하지 말 것 — 변환이 끼는 순간 랩에서
 * 본 그림과 코드에 붙인 그림이 어긋날 수 있다.
 *
 * **여기는 글자만 다룬다.** 문자 → 색은 팔레트가 정한다 (`lab-palette.ts`). 그래서 개미
 * 단계를 바꿔 껍질 색이 통째로 달라져도 도트는 한 칸도 안 건드린다.
 *
 * 모든 함수는 **새 배열을 돌려준다** — 프레임을 제자리에서 고치면 어니언스킨이 참고할
 * 직전 그림이 같이 바뀌어, 되돌리기가 아무것도 되돌리지 못한다.
 */

/** 투명 칸 */
export const EMPTY = ".";

export interface LabFrame {
  id: number;
  /** 코드로 뽑을 때의 자세 이름 (`crawl1` 같은 것) */
  name: string;
  rows: string[];
}

export interface Cell {
  x: number;
  y: number;
}

export function emptyRows(w: number, h: number): string[] {
  return Array.from({ length: h }, () => EMPTY.repeat(w));
}

export function rowsSize(rows: readonly string[]): { w: number; h: number } {
  return { w: rows[0]?.length ?? 0, h: rows.length };
}

export function charAt(rows: readonly string[], x: number, y: number): string {
  return rows[y]?.[x] ?? EMPTY;
}

/** 격자 밖이거나 이미 같은 글자면 원본을 그대로 돌려준다 (헛된 히스토리를 안 쌓는다) */
export function paintCells(rows: readonly string[], cells: readonly Cell[], char: string): string[] {
  const grid = toGrid(rows);
  let touched = false;

  for (const { x, y } of cells) {
    const row = grid[y];
    if (!row || x < 0 || x >= row.length) continue;
    if (row[x] === char) continue;

    row[x] = char;
    touched = true;
  }

  return touched ? fromGrid(grid) : [...rows];
}

/** 같은 글자로 이어진 칸을 통째로 칠한다 (4방향 — 대각선으로 새면 도트 그림이 뭉갠다) */
export function floodFill(rows: readonly string[], x: number, y: number, char: string): string[] {
  const target = charAt(rows, x, y);
  if (target === char) return [...rows];

  const { w, h } = rowsSize(rows);
  if (x < 0 || y < 0 || x >= w || y >= h) return [...rows];

  const grid = toGrid(rows);
  const stack: Cell[] = [{ x, y }];

  while (stack.length > 0) {
    const cell = stack.pop();
    if (!cell) break;

    const row = grid[cell.y];
    if (!row || cell.x < 0 || cell.x >= w) continue;
    if (row[cell.x] !== target) continue;

    row[cell.x] = char;
    stack.push({ x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y });
    stack.push({ x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 });
  }

  return fromGrid(grid);
}

const SIDES: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const CORNERS: readonly Cell[] = [
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/**
 * 그려둔 도트 바깥에 **한 겹**을 두른다.
 *
 * 이미 둘러진 외곽선 글자는 씨앗으로 안 친다 — 안 그러면 누를 때마다 선이 한 겹씩
 * 자라 그림이 통째로 외곽선이 된다. 한 겹씩 더 두르고 싶으면 다른 글자로 다시 두르면 된다.
 *
 * 대각선까지 두르면(`diagonal`) 모서리가 둥글게 막히고, 안 두르면 계단이 살아 도트가
 * 더 각져 보인다 — 개미 몸은 각진 쪽이라 기본값은 4방향이다.
 */
export function addOutline(rows: readonly string[], char: string, diagonal: boolean): string[] {
  const around = diagonal ? [...SIDES, ...CORNERS] : SIDES;
  const grid = toGrid(rows);
  const { w, h } = rowsSize(rows);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (charAt(rows, x, y) !== EMPTY) continue;

      const touching = around.some((step) => {
        const near = charAt(rows, x + step.x, y + step.y);
        return near !== EMPTY && near !== char;
      });

      const row = grid[y];
      if (touching && row) row[x] = char;
    }
  }

  return fromGrid(grid);
}

/** 한 글자만 통째로 지운다 (외곽선 다시 두르기) */
export function clearChar(rows: readonly string[], char: string): string[] {
  return rows.map((row) => [...row].map((cell) => (cell === char ? EMPTY : cell)).join(""));
}

/** 그림을 밀어 옮긴다. 격자 밖으로 나간 도트는 **버린다** — 감아 돌면 반대쪽에서 튀어나온다. */
export function shiftRows(rows: readonly string[], dx: number, dy: number): string[] {
  const { w, h } = rowsSize(rows);

  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => charAt(rows, x - dx, y - dy)).join(""),
  );
}

export function flipX(rows: readonly string[]): string[] {
  return rows.map((row) => [...row].reverse().join(""));
}

export function flipY(rows: readonly string[]): string[] {
  return [...rows].reverse();
}

/** 격자 크기를 바꾼다. 왼쪽 위를 붙잡고 남는 자리는 비우며, 넘치는 쪽은 잘린다. */
export function resizeRows(rows: readonly string[], w: number, h: number): string[] {
  return Array.from({ length: h }, (_, y) => {
    const row = rows[y] ?? "";
    return (row.length >= w ? row.slice(0, w) : row + EMPTY.repeat(w - row.length));
  });
}

/**
 * 두 칸을 잇는 도트 선.
 *
 * 손가락이 빨리 지나가면 pointermove가 칸을 건너뛴다 — 지나온 칸을 이어 칠하지 않으면
 * 획에 구멍이 뚫린다. 캔버스의 `line()`과 같은 방식(가장 긴 축으로 나눠 걷기)이다.
 */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (steps === 0) return [{ x: x0, y: y0 }];

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t) };
  });
}

/** 빈 프레임인가 (미리보기에서 "아직 안 그림"을 표시할 때) */
export function isBlank(rows: readonly string[]): boolean {
  return rows.every((row) => [...row].every((cell) => cell === EMPTY));
}

/* ── 코드로 뽑기 · 코드에서 읽기 ────────────────────── */

export type CodeStyle = "pose" | "const";

/**
 * 프레임을 **붙여넣을 수 있는 코드**로 뽑는다.
 *
 * `pose`는 `ant-sprite.tsx`의 POSES 안에 그대로 들어가는 모양이고, `const`는 짤 무대처럼
 * 제 파일에 맵을 두는 자리에 쓴다. 들여쓰기까지 맞춰 내보내는 건 받는 쪽에서 손댈 일을
 * 없애기 위해서다 — 손으로 고르다 보면 한 줄이 어긋나고, 그 한 줄이 도트 한 칸이다.
 */
export function framesToCode(frames: readonly LabFrame[], style: CodeStyle): string {
  if (style === "const") {
    return frames
      .map((frame) => {
        const body = frame.rows.map((row) => `  "${row}",`).join("\n");
        return `const ${constName(frame.name)}: readonly string[] = [\n${body}\n];`;
      })
      .join("\n\n");
  }

  return frames
    .map((frame) => {
      const body = frame.rows.map((row) => `    "${row}",`).join("\n");
      return `  ${poseName(frame.name)}: [\n${body}\n  ],`;
    })
    .join("\n");
}

function poseName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_$]/g, "");
  return /^[A-Za-z_$]/.test(safe) ? safe : `pose${safe || "1"}`;
}

function constName(name: string): string {
  return poseName(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * 코드 조각을 붙여넣어 프레임으로 읽는다.
 *
 * `[ … ]` 덩이 하나가 프레임 하나다. 덩이가 없으면(따옴표 줄만 붙여넣은 경우) 통째로 한
 * 프레임으로 친다. **줄 길이가 다르면 제일 긴 줄에 맞춰 늘린다** — 손으로 지운 자국이
 * 있는 맵도 받아줘야 하고, 어긋난 채로 들이면 그리는 내내 칸이 밀린다.
 */
export function parseFrames(text: string): string[][] {
  const blocks = text.match(/\[[^[\]]*\]/g);
  const groups = blocks && blocks.length > 0 ? blocks : [text];

  return groups
    .map((block) => (block.match(/"([^"]*)"/g) ?? []).map((quoted) => quoted.slice(1, -1)))
    .filter((frame) => frame.length > 0)
    .map((frame) => {
      const width = frame.reduce((max, row) => Math.max(max, row.length), 0);
      return frame.map((row) => row.padEnd(width, EMPTY));
    });
}

/* ── 안쪽 살림 ─────────────────────────────────────── */

function toGrid(rows: readonly string[]): string[][] {
  return rows.map((row) => [...row]);
}

function fromGrid(grid: readonly (readonly string[])[]): string[] {
  return grid.map((row) => row.join(""));
}
