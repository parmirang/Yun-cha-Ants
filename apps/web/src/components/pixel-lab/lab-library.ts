import { ANT_BIG_ROWS, ANT_POSE_IDS, antPoseRows } from "@/components/ant-sprite";
import { CAST_ART, CAST_IDS } from "@/components/meme/world-cast";

import { type PaletteId, labPalette } from "./lab-palette";
import { sameBody } from "./pixel-doc";

/**
 * 랩의 **그림 서랍** — 어떤 캐릭터에 어떤 그림이 있고, 그중 무엇이 대표이며, 대표를 고치면
 * 어떤 동작들이 따라 바뀌는지를 아는 자리.
 *
 * **원본은 코드에서 그때그때 읽는다** (`antPoseRows` · `CAST_ART`). 사본을 들고 있으면
 * 코드가 바뀌어도 랩이 옛 그림을 보여준다.
 *
 * 다만 **사람이 고친 그림만은 브라우저에 덮어쓰기로 쌓는다.** 자세를 오가며 고치려면 어딘가
 * 남겨야 하는데 파일에는 안 쓰기로 했기 때문이다 — 원래 "랩이 사본을 들고 있으면 안 된다"는
 * 규칙을 여기서만 푸는 셈이라, 덮어쓴 그림에는 **"코드에 아직 안 붙음" 표시**를 달아 원본과
 * 갈라져 있다는 걸 계속 보이게 한다.
 */

const OVERRIDE_KEY = "yca:pixel-lab:overrides:v1";

export interface LibPose {
  /** 캐릭터 안에서의 이름. 코드로 뽑을 때 그대로 자세 이름이 된다. */
  id: string;
  title: string;
  palette: PaletteId;
}

export interface LibChar {
  id: string;
  title: string;
  poses: LibPose[];
  /** 대표 자세 — 고치면 딸린 동작들이 따라 바뀐다 */
  masters: string[];
}

/**
 * 팔다리로 치는 글자. **캐릭터마다 다르다** — 개미는 `w`(팔)·`l`(다리)지만 부추의 `w`는
 * 알뿌리, 햄스터의 `w`는 주둥이다. 그래서 글자를 못박지 않고 **팔레트 이름표에서 뽑는다.**
 */
export function limbChars(palette: PaletteId): ReadonlySet<string> {
  const swatches = labPalette(palette, 38, []).swatches;

  return new Set(
    swatches.filter(({ label }) => label.includes("팔") || label.includes("다리")).map((s) => s.char),
  );
}

const ANT_TITLES: Record<string, string> = {
  crawl1: "기어가기 1",
  crawl2: "기어가기 2",
  stand: "서기",
  wave1: "손 흔들기 1",
  wave2: "손 흔들기 2",
  dig1: "땅파기 1",
  dig2: "땅파기 2",
  cry1: "울기 1",
  cry2: "울기 2",
  lookUp: "올려다보기",
  lookDown: "내려다보기",
  doze1: "졸기 1",
  doze2: "졸기 2",
  jump: "뛰기",
  shoot: "하트 발사",
  prone: "엎드리기",
  grip: "붙잡기",
  back1: "등지고 걷기 1",
  back2: "등지고 걷기 2",
  backFlail1: "버둥거리기 1",
  backFlail2: "버둥거리기 2",
};

const ANT_BIG_ID = "antBig";

export const LIB_CHARS: LibChar[] = [
  {
    id: "ant",
    title: "개미",
    poses: [
      ...ANT_POSE_IDS.map((id) => ({ id, title: ANT_TITLES[id] ?? id, palette: "body" as PaletteId })),
      { id: ANT_BIG_ID, title: "개미 몸 (32칸)", palette: "bodyBig" as PaletteId },
    ],
    /* 서기가 수직 몸을, 엎드리기가 수평 몸을 거느린다 (아래 `groupOf`가 실제로 재서 정한다) */
    masters: ["stand", "prone"],
  },
  /* 유인원은 팔이 따로 그려져 있어 한 캐릭터로 묶는다 (몸이 대표, 팔 둘은 딸린 그림) */
  {
    id: "ape",
    title: CAST_ART.ape.title,
    poses: (["ape", "apeArmOut", "apeArmUp"] as const).map((id) => ({
      id,
      title: CAST_ART[id].title,
      palette: id as PaletteId,
    })),
    masters: ["ape"],
  },
  ...CAST_IDS.filter((id) => !id.startsWith("flag") && !id.startsWith("ape")).map((id) => ({
    id,
    title: CAST_ART[id].title,
    poses: [{ id, title: CAST_ART[id].title, palette: id as PaletteId }],
    masters: [id],
  })),
  {
    id: "flags",
    title: "국기",
    poses: CAST_IDS.filter((id) => id.startsWith("flag")).map((id) => ({
      id,
      title: CAST_ART[id].title,
      palette: id as PaletteId,
    })),
    masters: CAST_IDS.filter((id) => id.startsWith("flag")),
  },
];

/** 코드에 적힌 그대로의 그림. 덮어쓰기를 거치지 않은 원본이다. */
export function sourceRows(charId: string, poseId: string): readonly string[] {
  if (charId === "ant") {
    if (poseId === ANT_BIG_ID) return ANT_BIG_ROWS;
    return antPoseRows(poseId as Parameters<typeof antPoseRows>[0]);
  }

  return CAST_ART[poseId as keyof typeof CAST_ART]?.rows ?? [];
}

/* ── 덮어쓰기 ────────────────────────────────────────── */

export type Overrides = Record<string, string[]>;

export const overrideKey = (charId: string, poseId: string) => `${charId}:${poseId}`;

export function readOverrides(): Overrides {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Overrides) : {};
  } catch {
    // 깨졌으면 없는 셈 친다 — 원본이 코드에 남아 있어 잃을 게 없다.
    return {};
  }
}

export function writeOverrides(next: Overrides): void {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  } catch {
    // 용량이 찼거나 사생활 모드 — 저장을 못 해도 그리는 건 계속돼야 한다.
  }
}

/* ── 옛 편집창이 쓰던 저장 칸 ────────────────────────
   서랍이 생기기 전, 편집창은 **문서 한 벌**을 이 칸에 쌓았다. 서랍은 이 칸을 안 쓰지만
   **지우지도 않는다** — 그때 그리던 그림이 아직 남아 있고, 화면에서 꺼낼 길이 없으면
   사람에게는 "리셋됐다"로 보인다.
   ────────────────────────────────────────────────────── */

const LEGACY_KEY = "yca:pixel-lab:v1";

export interface LegacyFrame {
  name: string;
  rows: string[];
}

/** 옛 칸에 남아 있는 그림들. 없으면 빈 배열. */
export function readLegacyFrames(): LegacyFrame[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { frames?: unknown };
    if (!Array.isArray(parsed.frames)) return [];

    return parsed.frames
      .filter(
        (item): item is LegacyFrame =>
          !!item && Array.isArray((item as LegacyFrame).rows) && (item as LegacyFrame).rows.length > 0,
      )
      .map((item) => ({ name: String(item.name ?? "pose"), rows: [...item.rows] }));
  } catch {
    return [];
  }
}

/* ── 통째로 백업 ─────────────────────────────────────
   브라우저 저장은 사이트 데이터를 지우면 같이 날아간다. **밖으로 꺼낼 길**을 둬야
   "리셋됐다"가 되돌릴 수 있는 일이 된다.
   ────────────────────────────────────────────────────── */

export function backupJson(overrides: Overrides): string {
  return JSON.stringify({ kind: "yca-pixel-lab", version: 1, overrides }, null, 2);
}

/** 백업 파일을 읽어 덮어쓰기로 되돌린다. 모양이 아니면 null (지금 것을 안 건드린다). */
export function parseBackup(text: string): Overrides | null {
  try {
    const parsed = JSON.parse(text) as { overrides?: unknown };
    const table = parsed.overrides;
    if (!table || typeof table !== "object") return null;

    const out: Overrides = {};
    for (const [key, rows] of Object.entries(table as Record<string, unknown>)) {
      if (Array.isArray(rows) && rows.every((row) => typeof row === "string")) out[key] = [...rows];
    }

    return out;
  } catch {
    return null;
  }
}

/** 지금 화면에 보여야 할 그림 — 고친 게 있으면 그것, 없으면 코드의 원본 */
export function currentRows(
  overrides: Overrides,
  charId: string,
  poseId: string,
): readonly string[] {
  return overrides[overrideKey(charId, poseId)] ?? sourceRows(charId, poseId);
}

/* ── 대표에 딸린 동작 묶기 ───────────────────────────── */

export interface PoseGroup {
  /** 대표의 몸을 그대로 쓰는 동작들 — 반영이 여기에 걸린다 */
  members: string[];
  /** 몸이 달라 자동 반영에서 빠지는 자세와 그 까닭 */
  outsiders: { id: string; reason: string }[];
}

/**
 * **묶음은 코드에 적힌 원본으로 판정한다.** 고친 그림으로 재면, 대표를 고치는 순간 몸이
 * 달라져 묶음이 통째로 비어버린다 — 반영을 누르기도 전에 반영할 대상이 사라지는 셈이다.
 * 원본 기준이면 묶음이 그림 자체의 성질로 고정되고, 반영한 뒤에도 그대로 남는다.
 */
export function groupOf(char: LibChar, masterId: string): PoseGroup {
  const master = sourceRows(char.id, masterId);
  const limbs = limbChars(char.poses.find((p) => p.id === masterId)?.palette ?? "body");

  const members: string[] = [];
  const outsiders: { id: string; reason: string }[] = [];

  for (const pose of char.poses) {
    if (pose.id === masterId || char.masters.includes(pose.id)) continue;

    const rows = sourceRows(char.id, pose.id);
    if (rows.length === 0) continue;

    if (sameBody(rows, master, limbs)) members.push(pose.id);
  }

  /* 어느 대표에도 안 걸리는 자세는 "따로 그린 그림"으로 한 번만 모아 알린다 */
  if (masterId === char.masters[0]) {
    for (const pose of char.poses) {
      if (char.masters.includes(pose.id)) continue;

      const belongs = char.masters.some((id) =>
        sameBody(sourceRows(char.id, pose.id), sourceRows(char.id, id), limbs),
      );
      if (!belongs) outsiders.push({ id: pose.id, reason: "몸이 달라 자동 반영 안 됨" });
    }
  }

  return { members, outsiders };
}
