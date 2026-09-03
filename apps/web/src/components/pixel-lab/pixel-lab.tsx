"use client";

import Link from "next/link";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STAGE_COUNT } from "@yca/shared";

import {
  ANT_BIG_ARMS,
  ANT_BIG_ROWS,
  ANT_FACE_ROWS,
  ANT_POSE_IDS,
  type AntPose,
  antPoseRows,
} from "@/components/ant-sprite";
import { CAST_ART, CAST_IDS } from "@/components/meme/world-cast";
import { copyText } from "@/lib/clipboard";
import { canRecordVideo, recordCanvas } from "@/lib/video-export";

import { FREE_DEFAULT, type PaletteId, type Swatch, labPalette, paletteColors } from "./lab-palette";
import {
  type Cell,
  type CodeStyle,
  EMPTY,
  type LabFrame,
  addOutline,
  charAt,
  clearChar,
  emptyRows,
  flipX,
  flipY,
  floodFill,
  framesToCode,
  lineCells,
  paintCells,
  parseFrames,
  resizeRows,
  rowsSize,
  shiftRows,
  splitRows,
} from "./pixel-doc";

/**
 * 도트 랩 — **도트를 그리고, 그 도트를 기준으로 프레임을 쌓아 움직이게 하는 자리.**
 *
 * 만드는 물건은 그림 파일이 아니라 **문자맵**이다. `ant-sprite.tsx`의 POSES와 같은 모양
 * (한 줄이 문자열 하나)이라, 여기서 그린 걸 그대로 코드에 붙이면 앱 개미와 짤 개미가
 * 같은 벌레로 남는다. 랩이 제 그림 형식을 따로 가지면 옮기는 길에서 도트가 어긋난다.
 *
 * 일하는 순서는 하나다.
 *
 * 1. **초안을 그린다** — 외곽선부터 두르고 안을 채우는 게 도트 그림의 보통 순서라,
 *    "외곽선 두르기"가 그려둔 덩이 바깥에 한 겹을 대신 둘러준다.
 * 2. **프레임을 복사한다** — 복사한 칸에서는 직전 프레임이 **어니언스킨**으로 비쳐서,
 *    팔다리만 옮기면 된다. 몸통은 손대지 않는다 (몸통이 같이 흔들리면 춤이 아니라
 *    화면이 떨리는 것으로 보인다 — 개미 자세들이 지키는 규칙이다).
 * 3. **재생해서 본다** — 미리보기가 도는 그 캔버스를 그대로 영상으로 굽는다.
 * 4. **코드로 뽑는다** — 붙여넣을 수 있는 모양으로 나온다.
 *
 * 이 화면은 **개발용이고 배포에는 안 실린다** (`app/pixel-lab/page.tsx`).
 */

const STORE_KEY = "yca:pixel-lab:v1";

const POSE_TITLES: Record<string, string> = {
  crawl1: "기어가기 1",
  crawl2: "기어가기 2",
  stand: "서기",
  wave1: "손 흔들기 1",
  wave2: "손 흔들기 2",
  dig1: "땅파기 1",
  dig2: "땅파기 2",
  cry1: "울기 1",
  cry2: "울기 2",
};

interface Source {
  id: string;
  title: string;
  rows: readonly string[];
  palette: PaletteId;
}

/** 늘 서 있는 팔레트. 캐릭터 것들은 그림을 열 때 딸려 온다. */
const BASE_PALETTES = ["body", "bodyBig", "face", "free"] as const;

const PALETTE_CHIP: Record<string, string> = {
  body: "개미 몸",
  bodyBig: "개미 32칸",
  face: "얼굴",
  free: "자유",
};

/**
 * 앱에 이미 있는 그림들. 새로 그리기 전에 **먼저 열어보라고** 목록으로 세워둔다.
 *
 * 개미 자세(16칸)와 클로즈업 얼굴에 더해, **짤 공장의 캐릭터들**(부추·메뚜기·정어리·
 * 유인원·햄스터)과 국기, 그리고 32칸으로 다시 뜬 큰 개미까지 여기서 연다. 목록은 전부
 * **원본을 그대로 읽어온다** — 랩이 사본을 들고 있으면 여기서 고친 도트와 코드의 도트가
 * 갈라진다.
 */
const SOURCES: Source[] = [
  ...ANT_POSE_IDS.map((pose: AntPose) => ({
    id: pose,
    title: POSE_TITLES[pose] ?? pose,
    rows: antPoseRows(pose),
    palette: "body" as const,
  })),
  { id: "antBig", title: "개미 몸 (32칸)", rows: ANT_BIG_ROWS, palette: "bodyBig" },
  ...ANT_BIG_ARMS.map((rows, i) => ({
    id: `antBigArm${i + 1}`,
    title: `개미 팔 (32칸) ${i + 1}`,
    rows,
    palette: "bodyBig" as const,
  })),
  { id: "cry", title: "우는 얼굴 (클로즈업)", rows: ANT_FACE_ROWS.cry, palette: "face" },
  { id: "shock", title: "놀란 얼굴 (클로즈업)", rows: ANT_FACE_ROWS.shock, palette: "face" },
  ...CAST_IDS.map((id) => ({
    id,
    title: CAST_ART[id].title,
    rows: CAST_ART[id].rows,
    palette: id,
  })),
];

type Tool = "pencil" | "eraser" | "bucket" | "picker";

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pencil", label: "연필", key: "B" },
  { id: "eraser", label: "지우개", key: "E" },
  { id: "bucket", label: "채우기", key: "G" },
  { id: "picker", label: "스포이드", key: "I" },
];

/** 되돌리기 깊이. 16×16 문자맵은 한 벌이 몇백 바이트라 넉넉히 쌓아도 된다. */
const HISTORY_MAX = 120;

/**
 * 서랍(1depth)에서 자세 하나를 열 때 넘어오는 것. **없으면 지금까지처럼 혼자 도는 편집창**이라
 * 브라우저에 저장해둔 문서를 복원한다.
 */
export interface OpenDoc {
  charId: string;
  poseId: string;
  title: string;
  rows: readonly string[];
  palette: PaletteId;
}

export function PixelLab({
  doc,
  onBack,
  onChange,
}: { doc?: OpenDoc; onBack?: () => void; onChange?: (rows: readonly string[]) => void } = {}) {
  const [size, setSize] = useState(() =>
    doc ? rowsSize(doc.rows) : { w: 16, h: 16 },
  );
  const [frames, setFrames] = useState<LabFrame[]>(() => [
    doc
      ? { id: 1, name: doc.poseId, rows: [...doc.rows] }
      : { id: 1, name: "stand", rows: [...antPoseRows("stand")] },
  ]);
  const [index, setIndex] = useState(0);
  const [baseId, setBaseId] = useState<number | null>(null);

  const [paletteId, setPaletteId] = useState<PaletteId>(doc?.palette ?? "body");
  const [stage, setStage] = useState(38);
  const [free, setFree] = useState<Swatch[]>([...FREE_DEFAULT]);
  const [char, setChar] = useState("h");

  const [pickedTool, setTool] = useState<Tool>("pencil");
  /** 스페이스를 누르고 있는 동안만 지우개 — 도구 자체는 안 바뀐다 */
  const [spaceErase, setSpaceErase] = useState(false);
  const tool: Tool = spaceErase ? "eraser" : pickedTool;
  const [mirror, setMirror] = useState(false);
  const [zoom, setZoom] = useState(24);
  const [showGrid, setShowGrid] = useState(true);
  /** 칸마다 글자를 겹쳐 보여준다 — 비슷한 갈색끼리 구별이 안 될 때 켠다 */
  const [showChars, setShowChars] = useState(false);
  const [onion, setOnion] = useState(true);
  const [diagonal, setDiagonal] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [playIndex, setPlayIndex] = useState(0);
  const [frameMs, setFrameMs] = useState(240);
  const [previewScale, setPreviewScale] = useState(12);
  const [previewBg, setPreviewBg] = useState<"dark" | "light" | "sky">("dark");
  const [flip, setFlip] = useState(false);

  const [codeStyle, setCodeStyle] = useState<CodeStyle>("pose");
  const [note, setNote] = useState("");
  const [importText, setImportText] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [canVideo, setCanVideo] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef(frames);
  const past = useRef<LabFrame[][]>([]);
  const future = useRef<LabFrame[][]>([]);
  const nextId = useRef(2);
  const loaded = useRef(false);

  const palette = useMemo(() => labPalette(paletteId, stage, free), [paletteId, stage, free]);
  const colors = useMemo(() => paletteColors(palette), [palette]);

  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];
  const rows = frame?.rows ?? emptyRows(size.w, size.h);
  const recording = progress !== null;

  /* ── 기억해두기 ─────────────────────────────────── */

  // 저장본은 마운트 뒤에 읽는다 — 서버가 그린 첫 화면과 달라지면 하이드레이션이 깨진다.
  useEffect(() => {
    setCanVideo(canRecordVideo());

    /*
     * **자세를 열고 들어왔으면 저장본을 안 읽는다.** 그 그림은 서랍이 쥐고 있고, 여기서
     * 옛 문서를 덮어씌우면 방금 연 자세가 엉뚱한 그림으로 바뀐다.
     */
    if (doc) {
      loaded.current = true;
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORE_KEY);
      if (!saved) return;

      const stored = JSON.parse(saved) as Partial<SavedDoc>;
      if (!Array.isArray(stored.frames) || stored.frames.length === 0) return;

      const w = stored.size?.w ?? 16;
      const h = stored.size?.h ?? 16;
      // 저장본과 격자가 어긋나도 열리게 맞춰 넣는다. **`framesRef`도 같은 걸 쥐어야 한다** —
      // 여기서 갈라지면 첫 획이 저장본의 옛 도트 위에 얹혀 방금 본 그림이 되돌아간다.
      const restored = stored.frames.map((item) => ({ ...item, rows: resizeRows(item.rows, w, h) }));

      setSize({ w, h });
      setFrames(restored);
      framesRef.current = restored;
      nextId.current = restored.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      setBaseId(stored.baseId ?? null);
      setPaletteId(stored.paletteId ?? "body");
      setStage(stored.stage ?? 38);
      if (stored.free) setFree(stored.free);
      setFrameMs(stored.frameMs ?? 240);
      setCodeStyle(stored.codeStyle ?? "pose");
    } catch {
      // 저장본이 깨졌으면 그냥 새 문서로 연다 — 랩은 결과물을 코드로 뽑는 자리라
      // 여기서 잃을 게 있어도 되돌릴 방법이 코드 쪽에 남아 있다.
    } finally {
      loaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!loaded.current || doc) return;

    const saving: SavedDoc = { size, frames, baseId, paletteId, stage, free, frameMs, codeStyle };
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(saving));
    } catch {
      // 용량이 찼거나 사생활 모드 — 저장을 못 해도 그리는 건 계속돼야 한다.
    }
  }, [doc, size, frames, baseId, paletteId, stage, free, frameMs, codeStyle]);

  /*
   * 자세를 열고 들어왔으면 **고칠 때마다 서랍에 넘긴다.** 나가는 순간에만 넘기면 탭을 닫거나
   * 새로고침했을 때 그린 게 통째로 날아간다.
   *
   * **넘기는 함수는 ref로 쥔다.** 부르는 쪽이 인라인 함수를 넘기면 렌더마다 새 함수라,
   * 이걸 의존성에 넣으면 `넘김 → 서랍이 저장 → 서랍 렌더 → 새 함수 → 다시 넘김`으로
   * 무한히 돈다. 넘길 때를 정하는 건 **그림이 바뀌었는지**뿐이다.
   */
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  useEffect(() => {
    if (!doc) return;
    changeRef.current?.(frames[0]?.rows ?? []);
  }, [doc, frames]);

  /* ── 고치기와 되돌리기 ──────────────────────────── */

  const applyFrames = useCallback((next: LabFrame[]) => {
    framesRef.current = next;
    setFrames(next);
  }, []);

  /**
   * 획을 시작하기 **전에** 지금 상태를 쌓아둔다. 획이 끝날 때 쌓으면 드래그 한 번이
   * 수십 칸으로 쪼개져, 되돌리기를 스무 번 눌러야 선 하나가 지워진다.
   */
  const pushHistory = useCallback(() => {
    past.current = [...past.current.slice(-(HISTORY_MAX - 1)), framesRef.current];
    future.current = [];
  }, []);

  const commit = useCallback(
    (make: (prev: LabFrame[]) => LabFrame[]) => {
      const prev = framesRef.current;
      const next = make(prev);
      if (next === prev) return;

      pushHistory();
      applyFrames(next);
    },
    [applyFrames, pushHistory],
  );

  /** 지금 프레임(또는 전체)의 도트를 고친다 */
  const editRows = useCallback(
    (make: (rows: string[]) => string[], all = false) => {
      commit((prev) =>
        prev.map((item, i) =>
          all || i === index ? { ...item, rows: make(item.rows) } : item,
        ),
      );
    },
    [commit, index],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;

    future.current = [...future.current.slice(-(HISTORY_MAX - 1)), framesRef.current];
    applyFrames(prev);
  }, [applyFrames]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;

    past.current = [...past.current.slice(-(HISTORY_MAX - 1)), framesRef.current];
    applyFrames(next);
  }, [applyFrames]);

  /* ── 그리기 ─────────────────────────────────────── */

  const paintAt = useCallback(
    (cells: readonly Cell[], phase: "start" | "move") => {
      if (tool === "picker") {
        const cell = cells[0];
        const picked = cell ? charAt(rows, cell.x, cell.y) : EMPTY;
        if (picked !== EMPTY) setChar(picked);
        return;
      }

      if (phase === "start") pushHistory();

      const paint = tool === "eraser" ? EMPTY : char;

      if (tool === "bucket") {
        const cell = cells[0];
        if (!cell) return;

        applyFrames(
          framesRef.current.map((item, i) =>
            i === index ? { ...item, rows: floodFill(item.rows, cell.x, cell.y, paint) } : item,
          ),
        );
        return;
      }

      // 좌우대칭은 칠하는 칸을 늘리는 것뿐이다 — 반대쪽을 따로 계산해두면 격자 폭이
      // 홀수일 때 한 칸이 어긋난다.
      const targets = mirror
        ? cells.flatMap((cell) => [cell, { x: size.w - 1 - cell.x, y: cell.y }])
        : cells;

      applyFrames(
        framesRef.current.map((item, i) =>
          i === index ? { ...item, rows: paintCells(item.rows, targets, paint) } : item,
        ),
      );
    },
    [applyFrames, char, index, mirror, pushHistory, rows, size.w, tool],
  );

  /* ── 프레임 ─────────────────────────────────────── */

  const addFrame = (copy: boolean) => {
    const source = copy ? rows : emptyRows(size.w, size.h);
    const id = nextId.current;
    nextId.current += 1;

    commit((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { id, name: nextName(prev, frame?.name ?? "pose"), rows: [...source] });
      return next;
    });

    setIndex(index + 1);
  };

  const removeFrame = () => {
    if (frames.length <= 1) return;

    commit((prev) => prev.filter((_, i) => i !== index));
    setIndex(Math.max(0, index - 1));
  };

  const moveFrame = (step: number) => {
    const to = index + step;
    if (to < 0 || to >= frames.length) return;

    commit((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });

    setIndex(to);
  };

  /** 앱에 있는 그림을 연다. 격자가 다르면 덧붙일 수 없어 **문서를 새로 연다.** */
  const loadSource = (id: string) => {
    const source = SOURCES.find((item) => item.id === id);
    if (!source) return;

    const loadedSize = rowsSize(source.rows);
    const fresh: LabFrame = { id: nextId.current, name: source.id, rows: [...source.rows] };
    nextId.current += 1;

    if (loadedSize.w === size.w && loadedSize.h === size.h) {
      commit((prev) => [...prev, fresh]);
      setIndex(frames.length);
      setNote(`${source.title}을(를) 프레임으로 더했어.`);
      return;
    }

    pushHistory();
    applyFrames([fresh]);
    setSize(loadedSize);
    setPaletteId(source.palette);
    /* 고른 글자도 새 팔레트 것으로 바꾼다 — "h"를 못박아두면 머리가 없는 그림(국기·물고기)에서
       첫 붓질이 아무 데도 안 찍힌다 */
    setChar(labPalette(source.palette, stage, free).swatches[0]?.char ?? "h");
    setBaseId(null);
    setIndex(0);
    setZoom(fitZoom(loadedSize.w, loadedSize.h));
    setNote(`격자가 ${loadedSize.w}×${loadedSize.h}라 문서를 새로 열었어.`);
  };

  /**
   * 도트를 2×2로 쪼갠다 — **그림은 그대로 두고 격자만 잘게 만든다.** 배율을 올리는 것과
   * 다르다: 그건 같은 도트를 크게 볼 뿐이라 새로 찍을 자리가 안 생긴다. 프레임을 전부 같이
   * 쪼개야 어니언스킨과 재생이 안 어긋난다.
   */
  const split = () => {
    const next = { w: size.w * 2, h: size.h * 2 };
    if (next.w > 128 || next.h > 128) {
      setNote("여기서 더 쪼개면 격자가 128칸을 넘어.");
      return;
    }

    setSize(next);
    commit((prev) => prev.map((item) => ({ ...item, rows: splitRows(item.rows, 2) })));
    setZoom(fitZoom(next.w, next.h));
    setNote(`한 도트가 네 칸이 됐어 (${next.w}×${next.h}). 되돌리려면 되돌리기(⌘Z).`);
  };

  const resize = (w: number, h: number) => {
    const next = { w: clamp(w, 4, 128), h: clamp(h, 4, 128) };
    setSize(next);
    commit((prev) => prev.map((item) => ({ ...item, rows: resizeRows(item.rows, next.w, next.h) })));
    setZoom(fitZoom(next.w, next.h));
  };

  /* ── 재생 ───────────────────────────────────────── */

  useEffect(() => {
    if (!playing || frames.length < 2) return;

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const next = Math.floor((now - start) / frameMs) % frames.length;
      // 프레임이 바뀔 때만 상태를 건드린다 — 매 rAF마다 setState하면 랩 전체가 60번 다시 그려진다.
      setPlayIndex((prev) => (prev === next ? prev : next));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, frameMs, frames.length, playKey]);

  const shown = playing ? (frames[playIndex % frames.length]?.rows ?? rows) : rows;

  /* ── 내보내기 ───────────────────────────────────── */

  const code = useMemo(() => framesToCode(frames, codeStyle), [frames, codeStyle]);

  const copyCode = async () => {
    setNote((await copyText(code)) ? "코드를 복사했어." : "복사가 막혔어 — 아래 상자에서 직접 골라.");
  };

  const importCode = () => {
    const parsed = parseFrames(importText);
    if (parsed.length === 0) {
      setNote("읽을 문자맵이 없어. 따옴표 줄이 들어 있는 코드를 붙여넣어.");
      return;
    }

    const first = parsed[0] ?? [];
    const next = { w: first[0]?.length ?? size.w, h: first.length };

    pushHistory();
    applyFrames(
      parsed.map((item, i) => ({
        id: nextId.current + i,
        name: `pose${i + 1}`,
        rows: resizeRows(item, next.w, next.h),
      })),
    );
    nextId.current += parsed.length;
    setSize(next);
    setIndex(0);
    setBaseId(null);
    setZoom(fitZoom(next.w, next.h));
    setImportText("");
    setNote(`${parsed.length}개 프레임을 읽었어.`);
  };

  /** 한 줄로 늘어놓은 스프라이트 시트. 영상을 못 굽는 자리에서 남는 길이기도 하다. */
  const savePng = useCallback(() => {
    const scale = 8;
    const canvas = document.createElement("canvas");
    canvas.width = size.w * scale * frames.length;
    canvas.height = size.h * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frames.forEach((item, i) => {
      paintRows(ctx, item.rows, colors, scale, i * size.w * scale, 0);
    });

    canvas.toBlob((blob) => {
      if (blob) download(URL.createObjectURL(blob), "pixel-lab-sheet.png", true);
    }, "image/png");
  }, [colors, frames, size.h, size.w]);

  const record = async () => {
    const canvas = previewRef.current;
    if (!canvas || recording) return;

    if (!canVideo || frames.length < 2) {
      savePng();
      return;
    }

    // 루프 첫 프레임부터 담아야 시작과 끝이 이어진다 (짤 공장과 같은 규칙).
    setPlaying(true);
    setPlayKey((key) => key + 1);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    setProgress(0);
    try {
      const take = await recordCanvas(canvas, frames.length * frameMs, "pixel-lab", setProgress);
      download(take.url, take.file.name, true);
    } catch {
      savePng();
    } finally {
      setProgress(null);
    }
  };

  /* ── 단축키 ─────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      const tools: Record<string, Tool> = { b: "pencil", e: "eraser", g: "bucket", i: "picker" };
      const picked = tools[key];
      if (picked) {
        setTool(picked);
        return;
      }

      /*
       * **스페이스는 누르고 있는 동안만 지우개다** (누른 채로 찍으면 지워진다). 재생/멈춤이
       * 여기 있었는데, 눌러 두는 손과 톡 누르는 손이 한 키에 겹치면 지우려고 누를 때마다
       * 재생이 켜졌다 꺼진다 — 재생은 `P`로 옮겼다.
       */
      if (key === " ") {
        event.preventDefault();
        setSpaceErase(true);
        return;
      }
      if (key === "p") {
        setPlaying((on) => !on);
        return;
      }
      if (key === "arrowleft") setIndex((i) => Math.max(0, i - 1));
      if (key === "arrowright") setIndex((i) => Math.min(framesRef.current.length - 1, i + 1));

      const slot = Number.parseInt(event.key, 10);
      const swatch = palette.swatches[slot - 1];
      if (swatch) setChar(swatch.char);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceErase(false);
    };
    /* 창 밖으로 나가면 키를 뗀 걸 못 받는다 — 안 풀어주면 지우개가 눌린 채로 남는다 */
    const release = () => setSpaceErase(false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [palette.swatches, redo, undo]);

  /* ── 화면 ───────────────────────────────────────── */

  const base = baseId === null ? null : frames.find((item) => item.id === baseId);
  const previous = index > 0 ? frames[index - 1] : null;

  const ghosts = [
    // 밑그림이 먼저(더 흐리게), 직전 프레임이 그 위. 순서가 바뀌면 방금 그린 자세가
    // 밑그림에 덮여 어디를 옮겼는지가 안 보인다.
    ...(base && base.id !== frame?.id ? [{ rows: base.rows, alpha: 0.16 }] : []),
    ...(onion && previous ? [{ rows: previous.rows, alpha: 0.3 }] : []),
  ];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-[color:var(--muted)]">
          ← 돌아가기
        </Link>
        <h1 className="text-base font-bold">도트 랩</h1>
        {doc && (
          <>
            <button type="button" className="btn-outline px-2.5 py-1 text-xs" onClick={onBack}>
              ← 서랍으로
            </button>
            <span className="text-xs font-bold">{doc.title}</span>

            {/*
              **자동으로 저장되지만 버튼을 둔다.** 저장이 보이지 않으면 사람은 저장됐는지
              알 수가 없고, 그리다 나가는 게 매번 도박이 된다 — 버튼은 저장을 시키는 게
              아니라 **저장돼 있음을 확인시키는** 자리다.
            */}
            <button
              type="button"
              className="btn-primary px-2.5 py-1 text-xs"
              onClick={() => {
                changeRef.current?.(framesRef.current[0]?.rows ?? []);
                setNote("저장했어 — 그리는 동안에도 계속 저장되고 있어.");
              }}
            >
              저장
            </button>
            <span className="text-[11px] text-[color:var(--muted)]">그리는 대로 자동 저장돼</span>
          </>
        )}
        <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[11px] text-[color:var(--muted)]">
          개발용 · 배포에는 안 실려
        </span>
        <span className="ml-auto text-xs text-[color:var(--muted)]">{note}</span>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        {/* ── 왼쪽: 도구와 색 ── */}
        <section className="flex flex-col gap-4">
          <Panel title="도구">
            <div className="grid grid-cols-2 gap-1.5">
              {TOOLS.map((item) => (
                <Chip key={item.id} on={tool === item.id} onClick={() => setTool(item.id)}>
                  {item.label}
                  <span className="ml-1 opacity-50">{item.key}</span>
                </Chip>
              ))}
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--muted)]">
              <b className="text-[color:var(--fg)]">스페이스</b>를 누른 채로 찍으면 지워져 (떼면
              고른 도구로 돌아와). 재생/멈춤은 <b className="text-[color:var(--fg)]">P</b>.
            </p>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Chip on={mirror} onClick={() => setMirror(!mirror)}>
                좌우대칭
              </Chip>
              <Chip on={showGrid} onClick={() => setShowGrid(!showGrid)}>
                격자선
              </Chip>
              <Chip on={showChars} onClick={() => setShowChars(!showChars)}>
                글자 보기
              </Chip>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Chip onClick={undo}>되돌리기</Chip>
              <Chip onClick={redo}>다시하기</Chip>
            </div>
          </Panel>

          <Panel title="색 (문자 하나 = 색 하나)">
            <div className="flex flex-wrap gap-1.5">
              {palette.swatches.map((swatch, i) => (
                <button
                  key={swatch.char}
                  type="button"
                  title={`${swatch.label} · ${swatch.char}${i < 9 ? ` · ${i + 1}` : ""}`}
                  onClick={() => setChar(swatch.char)}
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-md border text-[10px] font-bold"
                  style={{
                    background: swatch.color,
                    borderColor: char === swatch.char ? "var(--fg)" : "transparent",
                    color: readable(swatch.color),
                  }}
                >
                  {swatch.char}
                </button>
              ))}
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--muted)]">
              고른 색: <b className="text-[color:var(--fg)]">{labelOf(palette.swatches, char)}</b> (
              {char})
            </p>

            {/*
              캐릭터 팔레트는 **칩으로 안 늘어놓는다** — 열넷이라 줄이 길어지고, 어차피 그림을
              열면 그 그림의 팔레트가 딸려 온다. 대신 지금 열린 게 캐릭터면 그 이름을 칩 하나로
              보여줘 어느 팔레트로 찍고 있는지가 남게 한다.
            */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                ...BASE_PALETTES,
                ...(BASE_PALETTES.some((base) => base === paletteId) ? [] : [paletteId]),
              ].map((id: PaletteId) => (
                <Chip
                  key={id}
                  on={paletteId === id}
                  onClick={() => {
                    setPaletteId(id);
                    const next = labPalette(id, stage, free);
                    setChar(next.swatches[0]?.char ?? "h");
                  }}
                >
                  {PALETTE_CHIP[id as string] ?? labPalette(id, stage, free).title}
                </Chip>
              ))}
            </div>

            {palette.grid && (palette.grid.w !== size.w || palette.grid.h !== size.h) && (
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-[color:var(--accent)] px-2 py-1.5 text-[11px] text-[color:var(--accent)]"
                onClick={() => resize(palette.grid?.w ?? size.w, palette.grid?.h ?? size.h)}
              >
                이 팔레트의 격자({palette.grid.w}×{palette.grid.h})로 맞추기
              </button>
            )}

            {!palette.editable && (
              <label className="mt-3 block text-[11px] text-[color:var(--muted)]">
                개미 단계 {stage} — 창백함 ↔ 붉음
                <input
                  type="range"
                  min={0}
                  max={STAGE_COUNT - 1}
                  value={stage}
                  onChange={(event) => setStage(Number(event.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            )}

            {palette.editable && (
              <div className="mt-3 flex flex-col gap-1">
                {free.map((swatch, i) => (
                  <div key={swatch.char} className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={swatch.color}
                      onChange={(event) =>
                        setFree(free.map((s, j) => (j === i ? { ...s, color: event.target.value } : s)))
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="w-4 text-center text-[11px] font-bold">{swatch.char}</span>
                    <input
                      value={swatch.label}
                      onChange={(event) =>
                        setFree(free.map((s, j) => (j === i ? { ...s, label: event.target.value } : s)))
                      }
                      className="min-w-0 flex-1 rounded border border-[color:var(--line)] bg-transparent px-1.5 py-0.5 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="외곽선">
            <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
              그려둔 덩이 <b className="text-[color:var(--fg)]">바깥에 한 겹</b>을 두른다. 지금 고른
              색({char})으로 두르고, 같은 색을 지우면 선만 깔끔히 걷힌다.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Chip onClick={() => editRows((r) => addOutline(r, char, diagonal))}>두르기</Chip>
              <Chip onClick={() => editRows((r) => clearChar(r, char))}>이 색 지우기</Chip>
            </div>
            <div className="mt-1.5">
              <Chip on={diagonal} onClick={() => setDiagonal(!diagonal)}>
                {diagonal ? "8방향 (모서리도)" : "4방향 (각지게)"}
              </Chip>
            </div>
          </Panel>

          <Panel title="옮기기">
            <div className="grid grid-cols-4 gap-1.5">
              <Chip onClick={() => editRows((r) => shiftRows(r, -1, 0))}>←</Chip>
              <Chip onClick={() => editRows((r) => shiftRows(r, 1, 0))}>→</Chip>
              <Chip onClick={() => editRows((r) => shiftRows(r, 0, -1))}>↑</Chip>
              <Chip onClick={() => editRows((r) => shiftRows(r, 0, 1))}>↓</Chip>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <Chip onClick={() => editRows(flipX)}>좌우 반전</Chip>
              <Chip onClick={() => editRows(flipY)}>상하 반전</Chip>
              <Chip onClick={() => editRows(() => emptyRows(size.w, size.h))}>비우기</Chip>
            </div>
          </Panel>
        </section>

        {/* ── 가운데: 격자 ── */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
            <label className="flex items-center gap-1">
              격자
              <NumberBox value={size.w} onChange={(v) => resize(v, size.h)} />×
              <NumberBox value={size.h} onChange={(v) => resize(size.w, v)} />
            </label>

            <label className="flex items-center gap-1">
              배율
              <input
                type="range"
                min={4}
                max={48}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-24"
              />
            </label>

            <Chip on={onion} onClick={() => setOnion(!onion)}>
              어니언스킨
            </Chip>

            {/* 한 도트 → 네 칸. 그림은 그대로고 찍을 자리만 잘아진다. */}
            <Chip on={false} onClick={split}>
              도트 쪼개기 ×2
            </Chip>

            <select
              value=""
              onChange={(event) => loadSource(event.target.value)}
              className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-1.5 text-xs"
            >
              <option value="">앱에서 불러오기…</option>
              {SOURCES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-auto rounded-xl border border-[color:var(--line)] bg-[#161109] p-4">
            <GridCanvas
              rows={rows}
              ghosts={ghosts}
              colors={colors}
              zoom={zoom}
              showGrid={showGrid}
              showChars={showChars}
              onStroke={paintAt}
            />
          </div>

          <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
            초안을 그리고 → <b className="text-[color:var(--fg)]">프레임 복사</b>를 누르면 직전
            그림이 비쳐 보여. 그 위에서 팔다리만 옮기면 애니메이션이 된다 — 몸통은 좌표까지
            그대로 두는 게 규칙이야.
          </p>
        </section>

        {/* ── 오른쪽: 프레임과 재생 ── */}
        <section className="flex flex-col gap-4">
          <Panel title="미리보기">
            <div className="flex justify-center rounded-lg p-2" style={{ background: bgOf(previewBg) }}>
              <PreviewCanvas
                canvasRef={previewRef}
                rows={shown}
                colors={colors}
                scale={previewScale}
                flip={flip}
                background={bgOf(previewBg)}
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Chip on={playing} onClick={() => setPlaying(!playing)}>
                {playing ? "멈춤" : "재생"}
              </Chip>
              <Chip on={flip} onClick={() => setFlip(!flip)}>
                뒤집기
              </Chip>
              <Chip
                onClick={() =>
                  setPreviewBg(previewBg === "dark" ? "light" : previewBg === "light" ? "sky" : "dark")
                }
              >
                배경
              </Chip>
            </div>

            <label className="mt-2 block text-[11px] text-[color:var(--muted)]">
              한 컷 {frameMs}ms · 한 바퀴 {((frames.length * frameMs) / 1000).toFixed(2)}초
              <input
                type="range"
                min={60}
                max={600}
                step={20}
                value={frameMs}
                onChange={(event) => setFrameMs(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>

            <label className="block text-[11px] text-[color:var(--muted)]">
              미리보기 크기 ×{previewScale}
              <input
                type="range"
                min={2}
                max={24}
                step={2}
                value={previewScale}
                onChange={(event) => setPreviewScale(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </Panel>

          <Panel title={`프레임 ${index + 1} / ${frames.length}`}>
            <div className="flex flex-wrap gap-1.5">
              {frames.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setPlaying(false);
                  }}
                  onDoubleClick={() => setBaseId(baseId === item.id ? null : item.id)}
                  title={`${item.name} — 두 번 누르면 밑그림으로 고정`}
                  className="relative rounded-md border p-1"
                  style={{
                    borderColor: i === index ? "var(--fg)" : "var(--line)",
                    background: "#161109",
                  }}
                >
                  <FrameThumb rows={item.rows} colors={colors} box={44} />
                  {item.id === baseId && (
                    <span className="absolute -top-1 -left-1 rounded bg-[color:var(--accent)] px-1 text-[9px] font-bold text-black">
                      밑
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Chip onClick={() => addFrame(true)}>프레임 복사</Chip>
              <Chip onClick={() => addFrame(false)}>빈 프레임</Chip>
              <Chip onClick={() => moveFrame(-1)}>◀ 앞으로</Chip>
              <Chip onClick={() => moveFrame(1)}>뒤로 ▶</Chip>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={frame?.name ?? ""}
                onChange={(event) =>
                  commit((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                  )
                }
                className="min-w-0 flex-1 rounded border border-[color:var(--line)] bg-transparent px-2 py-1 text-xs"
                placeholder="자세 이름"
              />
              <Chip onClick={removeFrame}>삭제</Chip>
            </div>

            <p className="mt-2 text-[11px] text-[color:var(--muted)]">
              프레임을 두 번 누르면 <b className="text-[color:var(--accent)]">밑그림</b>으로 고정돼 —
              어느 칸에서 그리든 그 도트가 비쳐 보인다.
            </p>
          </Panel>

          <Panel title="내보내기">
            <div className="grid grid-cols-2 gap-1.5">
              <Chip onClick={record}>
                {recording ? `${Math.round((progress ?? 0) * 100)}%` : canVideo ? "영상" : "PNG"}
              </Chip>
              <Chip onClick={savePng}>PNG 시트</Chip>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--muted)]">
              미리보기에 도는 그 캔버스를 한 바퀴만 굽는다. 프레임이 하나뿐이면 PNG로 떨어져.
            </p>
          </Panel>
        </section>
      </div>

      {/* ── 아래: 코드 ── */}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="코드로 뽑기">
          <div className="flex items-center gap-1.5">
            <Chip on={codeStyle === "pose"} onClick={() => setCodeStyle("pose")}>
              POSES 항목
            </Chip>
            <Chip on={codeStyle === "const"} onClick={() => setCodeStyle("const")}>
              const 선언
            </Chip>
            <button type="button" className="ml-auto btn-primary px-3 py-1.5 text-xs" onClick={copyCode}>
              복사
            </button>
          </div>
          <textarea
            readOnly
            value={code}
            spellCheck={false}
            className="mt-2 h-64 w-full resize-y rounded-lg border border-[color:var(--line)] bg-[#161109] p-3 font-mono text-[11px] leading-[1.35]"
          />
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">
            POSES 항목은 <code>ant-sprite.tsx</code>의 <code>POSES</code> 안에 그대로 들어간다 —
            새 자세라면 <code>AntPose</code> 유니온에 이름도 같이 더할 것.
          </p>
        </Panel>

        <Panel title="코드에서 읽기">
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
            placeholder={'["................",\n ".....hhhh......."]'}
            className="h-64 w-full resize-y rounded-lg border border-[color:var(--line)] bg-[#161109] p-3 font-mono text-[11px] leading-[1.35]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={importCode}>
              불러오기
            </button>
            <span className="text-[11px] text-[color:var(--muted)]">
              대괄호 덩이 하나가 프레임 하나. 문서를 통째로 갈아끼운다.
            </span>
          </div>
        </Panel>
      </section>
    </main>
  );
}

interface SavedDoc {
  size: { w: number; h: number };
  frames: LabFrame[];
  baseId: number | null;
  paletteId: PaletteId;
  stage: number;
  free: Swatch[];
  frameMs: number;
  codeStyle: CodeStyle;
}

/* ── 격자 캔버스 ───────────────────────────────────── */

/**
 * 도트를 찍는 판.
 *
 * **좌표는 캔버스 크기가 아니라 격자 칸으로 되짚는다** — 화면에서 CSS로 줄여 보여줘도
 * 같은 칸이 잡히게 하려면 화면 상자 크기로 나눠야 한다.
 *
 * 빠르게 그으면 pointermove가 칸을 건너뛴다. 지나온 칸을 `lineCells`로 이어 칠하지
 * 않으면 획에 구멍이 뚫린다 — 도트 그림에서는 그 구멍이 곧 실수한 도트로 보인다.
 */
function GridCanvas({
  rows,
  ghosts,
  colors,
  zoom,
  showGrid,
  showChars,
  onStroke,
}: {
  rows: readonly string[];
  ghosts: readonly { rows: readonly string[]; alpha: number }[];
  colors: Record<string, string>;
  zoom: number;
  showGrid: boolean;
  showChars: boolean;
  onStroke: (cells: Cell[], phase: "start" | "move") => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<Cell | null>(null);
  const { w, h } = rowsSize(rows);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = w * zoom;
    canvas.height = h * zoom;
    ctx.imageSmoothingEnabled = false;

    // 투명한 칸이 보이도록 바둑판을 깐다 — 배경을 한 색으로 칠하면 그 색으로 칠한
    // 도트와 빈 칸이 구별되지 않는다. **바둑판 한 칸을 격자 한 칸에 맞춘다**: 절반으로
    // 잘게 깔면 빈 자리가 자글자글해서 도트 하나가 몇 칸인지 눈으로 못 센다.
    const box = Math.max(4, zoom);
    for (let y = 0; y < canvas.height; y += box) {
      for (let x = 0; x < canvas.width; x += box) {
        ctx.fillStyle = (x / box + y / box) % 2 === 0 ? "#241d16" : "#1b1610";
        ctx.fillRect(x, y, box, box);
      }
    }

    for (const ghost of ghosts) {
      ctx.globalAlpha = ghost.alpha;
      paintRows(ctx, ghost.rows, colors, zoom);
    }

    ctx.globalAlpha = 1;
    paintRows(ctx, rows, colors, zoom);

    // 8칸마다 진한 선을 둔다 — 옅은 선만 있으면 "왼쪽에서 몇 번째 칸"을 셀 수가 없다.
    if (showGrid && zoom >= 6) {
      for (let x = 0; x <= w; x += 1) {
        ctx.fillStyle = x % 8 === 0 ? "rgba(243,236,226,0.34)" : "rgba(243,236,226,0.13)";
        ctx.fillRect(x * zoom, 0, 1, canvas.height);
      }
      for (let y = 0; y <= h; y += 1) {
        ctx.fillStyle = y % 8 === 0 ? "rgba(243,236,226,0.34)" : "rgba(243,236,226,0.13)";
        ctx.fillRect(0, y * zoom, canvas.width, 1);
      }
    }

    /*
     * **칸마다 글자를 겹쳐 찍는다.** 개미 색은 머리·가슴·배·다리가 전부 비슷한 갈색이라
     * 눈으로는 어느 글자인지 못 가린다 — 특히 팔(w)·다리(l)를 몸통 색으로 잘못 찍으면
     * 반영할 때 팔이 두 벌이 되는데, 그리는 동안에는 그게 안 보인다.
     *
     * 칸이 좁으면 글자가 도트를 덮으므로 **넉넉할 때만** 찍고, 바탕색의 밝기를 보고
     * 글자색을 뒤집어 어느 색 위에서도 읽히게 한다.
     */
    if (showChars && zoom >= 12) {
      ctx.globalAlpha = 1;
      ctx.font = `bold ${Math.floor(zoom * 0.5)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      rows.forEach((row, y) => {
        [...row].forEach((char, x) => {
          if (char === EMPTY) return;
          ctx.fillStyle = readable(colors[char] ?? "#000000");
          ctx.fillText(char, x * zoom + zoom / 2, y * zoom + zoom / 2);
        });
      });
    }
  }, [colors, ghosts, h, rows, showChars, showGrid, w, zoom]);

  const cellAt = (event: ReactPointerEvent<HTMLCanvasElement>): Cell => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - box.left) / box.width) * w),
      y: Math.floor(((event.clientY - box.top) / box.height) * h),
    };
  };

  return (
    <canvas
      ref={ref}
      className="block cursor-crosshair touch-none select-none"
      style={{ width: w * zoom, height: h * zoom, imageRendering: "pixelated" }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const cell = cellAt(event);
        last.current = cell;
        onStroke([cell], "start");
      }}
      onPointerMove={(event) => {
        if (!last.current) return;

        const cell = cellAt(event);
        if (cell.x === last.current.x && cell.y === last.current.y) return;

        onStroke(lineCells(last.current.x, last.current.y, cell.x, cell.y), "move");
        last.current = cell;
      }}
      onPointerUp={() => {
        last.current = null;
      }}
      onPointerCancel={() => {
        last.current = null;
      }}
    />
  );
}

/* ── 미리보기 · 썸네일 ─────────────────────────────── */

/**
 * 실제 크기에 가까운 미리보기. **녹화되는 것도 이 캔버스다** — 내보내기용으로 다시
 * 그리면 눌러 받아보기 전에는 뭐가 나올지 알 수 없게 된다 (짤 공장과 같은 규칙).
 *
 * 크기는 짝수로 잡는다 — h.264는 홀수 폭·높이를 못 받아 녹화가 통째로 실패한다.
 */
function PreviewCanvas({
  canvasRef,
  rows,
  colors,
  scale,
  flip,
  background,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rows: readonly string[];
  colors: Record<string, string>;
  scale: number;
  flip: boolean;
  background: string;
}) {
  const { w, h } = rowsSize(rows);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = even(w * scale);
    canvas.height = even(h * scale);
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (flip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    paintRows(ctx, rows, colors, scale);
    ctx.restore();
  }, [background, canvasRef, colors, flip, h, rows, scale, w]);

  return <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />;
}

export function FrameThumb({
  rows,
  colors,
  box,
}: {
  rows: readonly string[];
  colors: Record<string, string>;
  box: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = rowsSize(rows);
  const scale = Math.max(1, Math.floor(box / Math.max(w, h)));

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || w === 0 || h === 0) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintRows(ctx, rows, colors, scale);
  }, [colors, h, rows, scale, w]);

  /*
   * **크기는 JSX에서 못박는다.** 효과 안에서만 정하면 효과가 안 도는 동안 캔버스가 기본
   * 300×150으로 서서, 빈 상자가 화면을 뒤덮는다 (그림이 없는 것과 구별도 안 된다).
   * 격자 크기가 그림마다 다르므로(16칸·32칸·15×10) CSS 크기까지 같이 준다.
   */
  return (
    <canvas
      ref={ref}
      width={Math.max(1, w * scale)}
      height={Math.max(1, h * scale)}
      className="block"
      style={{ imageRendering: "pixelated", width: w * scale, height: h * scale }}
    />
  );
}

/**
 * 문자맵을 도트로 찍는다. **팔레트에 없는 글자는 자홍색**으로 나온다 — 조용히 안 그리면
 * 팔레트를 바꿨을 때 그림이 슬금슬금 사라지고 어디가 빠졌는지 알 수 없다.
 */
function paintRows(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  colors: Record<string, string>,
  scale: number,
  offsetX = 0,
  offsetY = 0,
): void {
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === EMPTY) return;

      ctx.fillStyle = colors[cell] ?? "#ff00ff";
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
    });
  });
}

/* ── 자잘한 것들 ───────────────────────────────────── */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
      <h2 className="mb-2 text-[11px] font-bold tracking-wide text-[color:var(--muted)]">{title}</h2>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-md border px-2 py-1.5 text-[11px] font-semibold"
      style={{
        borderColor: on ? "var(--fg)" : "var(--line)",
        color: on ? "var(--bg)" : "var(--fg)",
        background: on ? "var(--fg)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function NumberBox({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={4}
      max={128}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-14 rounded border border-[color:var(--line)] bg-transparent px-1.5 py-1 text-xs"
    />
  );
}

function nextName(frames: readonly LabFrame[], base: string): string {
  const stem = base.replace(/\d+$/, "") || "pose";
  const used = new Set(frames.map((frame) => frame.name));

  for (let i = 1; i < 99; i += 1) {
    if (!used.has(`${stem}${i}`)) return `${stem}${i}`;
  }

  return stem;
}

/** 격자가 커지면 배율을 줄여 한 화면에 들어오게 한다 (얼굴 52×80은 24배로 못 본다) */
function fitZoom(w: number, h: number): number {
  return clamp(Math.floor(Math.min(640 / w, 620 / h)), 4, 32);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value) || min));
}

function even(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}

function bgOf(kind: "dark" | "light" | "sky"): string {
  return kind === "dark" ? "#161109" : kind === "light" ? "#e8ddcb" : "#7fb4e8";
}

function labelOf(swatches: readonly Swatch[], char: string): string {
  return swatches.find((swatch) => swatch.char === char)?.label ?? "없는 글자";
}

/**
 * 스와치 글자가 배경색에 묻히지 않게 밝기로 갈라 칠한다.
 *
 * **개미 팔레트는 `hsl()` 문자열로 온다** (자유 팔레트만 `#rrggbb`다) — hex만 읽으면
 * 개미 스와치의 글자가 전부 검정으로 떨어져 어두운 색 위에서 안 보인다.
 */
function readable(color: string): string {
  const hsl = /hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%/.exec(color);
  if (hsl?.[1]) return Number(hsl[1]) > 55 ? "#000" : "#fff";

  const hex = color.replace("#", "");
  if (hex.length !== 6) return "#fff";

  const value = Number.parseInt(hex, 16);
  const light = (((value >> 16) & 255) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;

  return light > 140 ? "#000" : "#fff";
}

function download(url: string, name: string, revoke: boolean): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();

  if (revoke) URL.revokeObjectURL(url);
}
