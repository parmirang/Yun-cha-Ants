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

/* ── 몸통과 팔다리 가르기 ───────────────────────────────
   **한 캐릭터의 동작들은 몸통을 좌표까지 공유하고 팔다리만 다르다.** 개미 자세들이 지키는
   규칙이고(손 흔들기·울기·파기·뛰기·하트는 서기와 몸이 한 칸도 안 다르다), 그래서
   대표 자세의 몸을 고치면 **딸린 동작들을 다시 합성해낼 수 있다.**

   팔다리로 치는 글자는 **캐릭터마다 다르다** — 개미는 `w`(팔)·`l`(다리)지만 부추의 `w`는
   알뿌리, 햄스터의 `w`는 주둥이다. 그래서 글자를 여기 못박지 않고 부르는 쪽이 넘긴다.
   ────────────────────────────────────────────────────── */

/** 팔다리 글자를 지운 층. 두 자세가 같은 몸인지 재는 것도 이 층으로 한다. */
export function bodyLayer(rows: readonly string[], limbs: ReadonlySet<string>): string[] {
  return rows.map((row) => [...row].map((char) => (limbs.has(char) ? EMPTY : char)).join(""));
}

/** 같은 몸인가 — 격자가 다르면 볼 것도 없이 아니다 */
export function sameBody(
  a: readonly string[],
  b: readonly string[],
  limbs: ReadonlySet<string>,
): boolean {
  if (a.length !== b.length || (a[0]?.length ?? 0) !== (b[0]?.length ?? 0)) return false;

  const left = bodyLayer(a, limbs);
  const right = bodyLayer(b, limbs);

  return left.every((row, y) => row === right[y]);
}

/**
 * 대표의 몸에 그 동작의 팔다리를 다시 얹는다.
 *
 * **대표의 팔다리는 먼저 벗긴다.** 안 벗기면 대표가 서 있는 자세의 팔다리가 동작마다
 * 새어 들어가, 손 흔드는 개미 옆에 서 있는 개미의 팔이 하나 더 붙는다.
 *
 * **팔다리가 이긴다.** 몸을 넓게 다시 그려 팔이 앉던 자리를 덮게 되더라도 팔을 남긴다 —
 * 팔이 지워지면 그건 더 이상 그 동작이 아니다 (손 흔들기가 손을 안 흔든다).
 */
/**
 * 팔다리를 새 몸에 맞추는 자. **옛 몸이 차지하던 상자를 새 몸의 상자로 보내는 변환**이라,
 * 몸이 옮겨졌으면 팔다리도 옮겨가고 몸이 두툼해졌으면 팔다리도 그만큼 벌어진다.
 */
export interface LimbFit {
  x0: number;
  y0: number;
  X0: number;
  Y0: number;
  sx: number;
  sy: number;
}

export const NO_FIT: LimbFit = { x0: 0, y0: 0, X0: 0, Y0: 0, sx: 1, sy: 1 };

export function recomposeRows(
  master: readonly string[],
  pose: readonly string[],
  limbs: ReadonlySet<string>,
  fit: LimbFit = NO_FIT,
): string[] {
  const body = bodyLayer(master, limbs);
  const { w, h } = rowsSize(body);

  return Array.from({ length: h }, (_, y) => {
    const bodyRow = body[y] ?? EMPTY.repeat(w);

    return Array.from({ length: w }, (_, x) => {
      /*
       * **거꾸로 되짚어 뽑는다** — 옛 팔 칸을 새 자리에 뿌리면 몸이 커진 만큼 사이에 구멍이
       * 생긴다. 새 칸마다 "이 자리는 옛 그림의 어디였나"를 물어보면 구멍이 안 난다.
       */
      const sx = Math.round(fit.x0 + (x - fit.X0) / fit.sx);
      const sy = Math.round(fit.y0 + (y - fit.Y0) / fit.sy);
      const limb = pose[sy]?.[sx] ?? EMPTY;

      return limbs.has(limb) ? limb : (bodyRow[x] ?? EMPTY);
    }).join("");
  });
}

/**
 * 몸이 **어디로 옮겨졌는지** 잰다 — 고치기 전 몸과 고친 뒤 몸의 한가운데가 얼마나 밀렸는가.
 *
 * 팔다리를 그만큼 같이 옮겨주면, 몸을 다시 그렸을 때 팔이 허공에 뜨는 걸 막을 수 있다.
 * **자세를 지어내지는 못한다** — 어느 팔이 흔드는 팔인지는 그림에 안 적혀 있어서, 이건
 * 어디까지나 "붙어 있던 자리를 따라가게" 하는 것뿐이다.
 *
 * **도트 단위로 끊는다** (반올림). 소수로 옮기면 팔이 몸과 반 칸 어긋나 붙는다.
 */
export function bodyFit(
  before: readonly string[],
  after: readonly string[],
  limbs: ReadonlySet<string>,
): LimbFit {
  const box = (rows: readonly string[]) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;

    bodyLayer(rows, limbs).forEach((row, y) => {
      [...row].forEach((char, x) => {
        if (char === EMPTY) return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      });
    });

    return x1 < x0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  const a = box(before);
  const b = box(after);
  if (!a || !b) return NO_FIT;

  return { x0: a.x0, y0: a.y0, X0: b.x0, Y0: b.y0, sx: b.w / a.w, sy: b.h / a.h };
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
/**
 * 도트를 **쪼갠다** — 한 칸이 `n`×`n`이 되도록 격자를 그만큼 넓힌다.
 *
 * 그림은 그대로고 **격자만 잘아진다.** 배율(zoom)을 올리는 것과 다른데, 그건 같은 도트를
 * 크게 보여줄 뿐이라 새로 찍을 자리가 안 생긴다 — 이건 한 도트가 네 칸이 되어 그 안에
 * 눈동자나 팔 선처럼 못 넣던 걸 넣을 수 있다. 클로즈업 얼굴이 도트를 키우는 대신 쪼개는
 * 것과 같은 손이고, 되돌릴 수는 없으므로(쪼갠 뒤 찍은 도트는 절반으로 못 접는다) 랩에서도
 * 되돌리기로만 무른다.
 */
export function splitRows(rows: readonly string[], n: number): string[] {
  const out: string[] = [];

  for (const row of rows) {
    const wide = [...row].map((char) => char.repeat(n)).join("");
    for (let i = 0; i < n; i += 1) out.push(wide);
  }

  return out;
}

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
