"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { copyText } from "@/lib/clipboard";

import {
  ANT32_TITLE,
  LIB_CHARS,
  type LibChar,
  type Overrides,
  backupJson,
  currentRows,
  groupOf,
  limbChars,
  fetchFileOverrides,
  overrideKey,
  parseBackup,
  pruneApplied,
  readOverrides,
  sourceRows,
  writeOverrides,
} from "./lab-library";
import { type PaletteId, labPalette, paletteColors } from "./lab-palette";
import { FrameThumb, type OpenDoc, PixelLab } from "./pixel-lab";
import { NO_FIT, bodyFit, framesToCode, recomposeRows, rowsSize } from "./pixel-doc";

/**
 * 도트 랩의 **서랍(1depth)** — 캐릭터마다 대표 자세와 거기 딸린 동작들을 한눈에 두고,
 * 대표를 고쳐 **딸린 동작들을 한 번에 다시 합성하는** 자리.
 *
 * 화면이 두 층인 건 편집창을 자세마다 **새로 마운트하기 위해서**다. 편집창은 안쪽 상태가
 * 전부 "문서 한 벌"을 전제해서(되돌리기 기록·프레임 번호·고른 글자), 한 창을 재사용하며
 * 자세만 갈아끼우면 앞 자세의 기록이 뒤 자세에 얹힌다. 열 때마다 새로 마운트하면 그
 * 초기화가 공짜로 된다.
 */
export function PixelLibrary() {
  const [charId, setCharId] = useState(LIB_CHARS[0]?.id ?? "ant");
  /** 캐릭터 하나가 아니라 그림 전부를 늘어놓는다 — 어디까지 그렸는지 재는 자리 */
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<OpenDoc | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [stage, setStage] = useState(38);
  const [note, setNote] = useState("");
  const [applying, setApplying] = useState<number | null>(null);
  /** 반영 직전 그림들 — "반영 취소"가 되돌릴 한 벌 (1회) */
  const [undoable, setUndoable] = useState<{ masterId: string; before: Overrides } | null>(null);
  /** 대표를 고치고 돌아온 자리 — 여기에만 "전체 반영하기"가 뜬다 */
  const [touched, setTouched] = useState<Set<string>>(new Set());
  /**
   * 반영할 때 팔다리를 어떻게 할지.
   *
   * - `keep`  동작이 갖고 있던 팔다리를 그대로 둔다 (기본).
   * - `master` 대표의 팔다리로 통일한다 — 몸을 새로 그려 옛 팔이 허공에 뜰 때, 동작마다
   *   팔을 **다시 옮길 출발점**을 만들어준다.
   * - `fit`   옛 몸이 차지하던 상자를 새 몸의 상자로 보내 팔다리를 따라 옮긴다.
   *   **몸을 옮기거나 크기만 바꿨을 때만 쓸모 있다** — 모양을 새로 그리면 팔이 두꺼워지고
   *   오히려 더 뜬다 (재봤다).
   */
  const [limbMode, setLimbMode] = useState<"keep" | "master" | "fit">("keep");

  /*
   * 덮어쓰기는 마운트 뒤에 읽는다 — 서버가 그린 첫 화면과 달라지면 하이드레이션이 깨진다.
   *
   * **브라우저가 비어 있으면 저장소 안 파일에서 되살린다.** 다른 브라우저로 열었거나
   * 사이트 데이터를 지운 경우가 여기에 걸린다 — 예전엔 그대로 "그림이 사라진" 것으로
   * 보였다. 브라우저에 뭔가 있으면 그쪽이 최신이므로 파일이 덮지 않는다.
   */
  useEffect(() => {
    const stored = readOverrides();
    const local = pruneApplied(stored);
    setOverrides(local);

    // 걷어낸 게 있으면 저장한 것도 줄여 둔다 — 안 그러면 열 때마다 같은 걸 다시 걷는다.
    if (Object.keys(local).length !== Object.keys(stored).length) writeOverrides(local);

    if (Object.keys(local).length > 0) return;

    void fetchFileOverrides().then((fromFile) => {
      const pruned = pruneApplied(fromFile);
      const count = Object.keys(pruned).length;
      if (count === 0) return;

      setOverrides(pruned);
      writeOverrides(pruned);
      setNote(`저장소에 남아 있던 그림 ${count}장을 되살렸어.`);
    });
  }, []);

  const char = LIB_CHARS.find((item) => item.id === charId) ?? LIB_CHARS[0];

  const save = useCallback((next: Overrides) => {
    setOverrides(next);
    writeOverrides(next);
  }, []);

  const saveBackup = () => {
    const blob = new Blob([backupJson(overrides)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pixel-lab-백업.json";
    link.click();
    URL.revokeObjectURL(url);
    setNote("백업을 내려받았어.");
  };

  const loadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const parsed = parseBackup(await file.text());
    if (!parsed) {
      // 모양이 아니면 **지금 것을 안 건드린다** — 잘못 고른 파일이 작업을 지우면 안 된다.
      setNote("백업 파일 모양이 아니야 — 아무것도 안 바꿨어.");
      return;
    }

    save({ ...overrides, ...parsed });
    setNote(`백업에서 ${Object.keys(parsed).length}장을 되살렸어.`);
  };

  if (open) {
    return (
      <PixelLab
        // 자세가 바뀌면 통째로 새로 마운트한다 (위 주석 참고)
        key={`${open.charId}:${open.poseId}`}
        doc={open}
        onBack={() => setOpen(null)}
        onChange={(rows) => {
          const key = overrideKey(open.charId, open.poseId);
          const source = sourceRows(open.charId, open.poseId);
          const same = rows.length === source.length && rows.every((row, y) => row === source[y]);

          const next = { ...overrides };
          // 원본과 같아지면 덮어쓰기를 지운다 — 안 그러면 손 안 댄 그림에도 표시가 남는다.
          if (same) delete next[key];
          else next[key] = [...rows];

          save(next);
          if (!same) setTouched((prev) => new Set(prev).add(open.poseId));
        }}
      />
    );
  }

  if (!char) return null;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-[color:var(--muted)]">
          ← 돌아가기
        </Link>
        <h1 className="text-base font-bold">도트 랩 · 서랍</h1>

        {/*
          **전체 보기는 드롭다운을 대신하지 않고 옆에 선다.** 한 캐릭터를 여는 건 고치러
          들어가는 길이고, 전체는 "어디까지 그렸나"를 한눈에 재는 자리라 하는 일이 다르다 —
          전체에서는 대표/딸린 동작 구분도, 반영 버튼도 없이 그림만 늘어놓는다.
        */}
        {!all && (
          <select
            value={charId}
            onChange={(event) => {
              setCharId(event.target.value);
              setTouched(new Set());
              setUndoable(null);
            }}
            className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-1.5 text-xs"
          >
            {LIB_CHARS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className={all ? "btn-primary px-2.5 py-1 text-xs" : "btn-outline px-2.5 py-1 text-xs"}
          onClick={() => setAll(!all)}
        >
          {all ? "한 캐릭터만" : "전체 보기"}
        </button>

        <label className="flex items-center gap-1 text-xs text-[color:var(--muted)]">
          단계
          <input
            type="range"
            min={0}
            max={49}
            value={stage}
            onChange={(event) => setStage(Number(event.target.value))}
            className="w-24"
          />
        </label>

        <button type="button" className="btn-outline px-2.5 py-1 text-xs" onClick={saveBackup}>
          백업 내려받기
        </button>
        <label className="btn-outline cursor-pointer px-2.5 py-1 text-xs">
          백업 올리기
          <input type="file" accept="application/json" className="hidden" onChange={loadBackup} />
        </label>

        <span className="ml-auto text-xs text-[color:var(--muted)]">{note}</span>
      </header>

      {all && <AllPoses overrides={overrides} stage={stage} onOpen={setOpen} />}

      {!all &&
        char.masters.map((masterId) => (
        <MasterSection
          key={masterId}
          char={char}
          masterId={masterId}
          overrides={overrides}
          stage={stage}
          touched={touched.has(masterId)}
          applying={applying}
          undoable={undoable?.masterId === masterId ? undoable : null}
          onOpen={setOpen}
          onNote={setNote}
          limbMode={limbMode}
          onLimbMode={setLimbMode}
          onApply={async (members, limbs) => {
            const before: Overrides = { ...overrides };
            const master = currentRows(overrides, char.id, masterId);
            const next = { ...overrides };
            /*
             * 몸이 옮겨졌으면 팔다리도 그만큼 따라가게 한다 — 안 그러면 몸을 다시 그렸을 때
             * 팔이 옛 자리에 남아 허공에 뜬다. **자세를 지어내지는 못한다** (아래 `bodyShift`).
             */
            const fit =
              limbMode === "fit" ? bodyFit(sourceRows(char.id, masterId), master, limbs) : NO_FIT;

            setApplying(0);
            for (let i = 0; i < members.length; i += 1) {
              const poseId = members[i] as string;
              // 대표의 팔다리로 통일할 땐 대표를 팔다리 원본으로 삼는다
              const pose = limbMode === "master" ? master : currentRows(overrides, char.id, poseId);
              next[overrideKey(char.id, poseId)] = recomposeRows(master, pose, limbs, fit);

              setApplying((i + 1) / members.length);
              // 한 칸씩 보여주려고 쉰다 — 스무 장이 한 프레임에 끝나면 진행바가 안 보인다.
              await new Promise((resolve) => window.setTimeout(resolve, 90));
            }

            save(next);
            setApplying(null);
            setUndoable({ masterId, before });
            setTouched((prev) => {
              const cut = new Set(prev);
              cut.delete(masterId);
              return cut;
            });
            setNote(
              `${members.length}개 동작에 새 몸을 반영했어.` +
                (limbMode === "master"
                  ? " 팔다리는 대표 것으로 통일했어 — 동작마다 팔을 옮겨줘."
                  : limbMode === "fit"
                    ? ` 팔다리는 몸 상자(가로 ${fit.sx.toFixed(2)}배 · 세로 ${fit.sy.toFixed(2)}배)에 맞춰 옮겼어.`
                    : ""),
            );
          }}
          onUndoApply={(before) => {
            save(before);
            setUndoable(null);
            setNote("반영을 되돌렸어.");
          }}
        />
      ))}
    </main>
  );
}

/**
 * **그림 전부를 한 화면에** — 캐릭터를 하나씩 골라 들어가지 않고 어디까지 그렸는지 재는 자리.
 *
 * 여기서는 **대표와 딸린 동작을 구분하지 않는다.** 그 구분은 "고치면 뭐가 따라오나"를 위한
 * 것이라 고치러 들어갈 때 필요하고, 훑어볼 때는 오히려 같은 캐릭터의 그림이 두 덩이로
 * 갈려 세기가 어려워진다. 반영·복사 버튼도 두지 않는다 — 누르면 그림이 바뀌는 것은
 * 캐릭터 하나를 열고 나서 할 일이다.
 *
 * **격자 크기를 같이 적는다.** 16칸과 32칸이 섞여 있고 썸네일은 같은 상자에 맞춰 그려져서
 * 그림만 봐서는 어느 쪽이 잘아진 그림인지 안 갈린다.
 */
function AllPoses({
  overrides,
  stage,
  onOpen,
}: {
  overrides: Overrides;
  stage: number;
  onOpen: (doc: OpenDoc) => void;
}) {
  /* 팔레트는 열넷이라 그림마다 새로 만들면 한 화면에 마흔 번 넘게 계산한다 — 한 번만 만든다 */
  const colorsOf = useMemo(() => {
    const cache: Record<string, Record<string, string>> = {};
    return (id: PaletteId) => (cache[id] ??= paletteColors(labPalette(id, stage, [])));
  }, [stage]);

  return (
    <div className="mt-5 space-y-4">
      {LIB_CHARS.map((char) => (
        <section key={char.id} className="rounded-xl border border-[color:var(--line)] p-4">
          <h2 className="text-xs font-bold">
            {char.title}
            <span className="ml-1.5 font-normal text-[color:var(--muted)]">
              {char.poses.length}장
            </span>
          </h2>

          <div className="mt-2 flex flex-wrap gap-2">
            {char.poses.map((pose) => {
              const rows = currentRows(overrides, char.id, pose.id);
              const size = rowsSize(rows);
              const edited = overrideKey(char.id, pose.id) in overrides;

              return (
                <button
                  key={pose.id}
                  type="button"
                  onClick={() =>
                    onOpen({
                      charId: char.id,
                      poseId: pose.id,
                      title: `${char.title} · ${pose.title}`,
                      rows,
                      palette: pose.palette,
                    })
                  }
                  className="flex w-[92px] flex-col items-center gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-2"
                >
                  <FrameThumb rows={rows} colors={colorsOf(pose.palette)} box={56} />
                  <span className="text-[10px] leading-tight">{pose.title}</span>
                  <span className="text-[9px] text-[color:var(--muted)]">
                    {size.w}×{size.h}
                  </span>
                  {edited && (
                    <span className="text-[9px] text-[color:var(--up)]">코드에 아직 안 붙음</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MasterSection({
  char,
  masterId,
  overrides,
  stage,
  touched,
  applying,
  limbMode,
  onLimbMode,
  undoable,
  onOpen,
  onNote,
  onApply,
  onUndoApply,
}: {
  char: LibChar;
  masterId: string;
  overrides: Overrides;
  stage: number;
  touched: boolean;
  applying: number | null;
  limbMode: "keep" | "master" | "fit";
  onLimbMode: (mode: "keep" | "master" | "fit") => void;
  undoable: { masterId: string; before: Overrides } | null;
  onOpen: (doc: OpenDoc) => void;
  onNote: (note: string) => void;
  onApply: (members: string[], limbs: ReadonlySet<string>) => void;
  onUndoApply: (before: Overrides) => void;
}) {
  const master = char.poses.find((pose) => pose.id === masterId);
  const group = useMemo(() => groupOf(char, masterId), [char, masterId]);
  const limbs = useMemo(() => limbChars(master?.palette ?? "body"), [master?.palette]);
  const colors = useMemo(
    () => paletteColors(labPalette(master?.palette ?? "body", stage, [])),
    [master?.palette, stage],
  );

  if (!master) return null;

  const masterRows = currentRows(overrides, char.id, masterId);
  const edited = overrideKey(char.id, masterId) in overrides;

  /*
   * **격자가 원본과 달라지면 그 그림은 코드로 돌아갈 수 없다.** 도트 쪼개기로 16칸 서기를
   * 32칸까지 올려 그려도 `POSES.stand`는 16칸이라 안 들어간다 — 예전엔 아무도 안 알려줘서
   * 하루를 그리고 나서야 갈 곳이 없다는 걸 알았다. 32칸 자세를 담는 표는 따로 있다
   * (`BIG_POSES` = 서랍의 "개미 (32칸)").
   */
  const sourceSize = rowsSize(sourceRows(char.id, masterId));
  const masterSize = rowsSize(masterRows);
  const gridMismatch = masterSize.w !== sourceSize.w || masterSize.h !== sourceSize.h;

  /*
   * 대표에 **팔·다리 색으로 찍은 칸이 몇이나 되는가.** 0이면 그린 팔이 전부 몸통으로
   * 취급돼, 동작마다 제 팔다리가 그 위에 또 얹혀 **팔이 두 벌**로 흩어진다 — 화면에서
   * 제일 흔히 "팔이 날아다닌다"로 보이는 원인이라 미리 알린다.
   */
  const masterLimbCells = masterRows.reduce(
    (n, row) => n + [...row].filter((char) => limbs.has(char)).length,
    0,
  );

  const copyGroup = async () => {
    const frames = [masterId, ...group.members].map((id, i) => ({
      id: i,
      name: id,
      rows: [...currentRows(overrides, char.id, id)],
    }));
    // 묶음은 늘 POSES 항목 모양으로 낸다 — const 스타일은 이름을 대문자로 바꿔버린다.
    onNote((await copyText(framesToCode(frames, "pose"))) ? "묶음 코드를 복사했어." : "복사가 막혔어.");
  };

  return (
    <section className="mt-5 rounded-xl border border-[color:var(--line)] p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onOpen({
                charId: char.id,
                poseId: masterId,
                title: `${char.title} · ${master.title}`,
                rows: masterRows,
                palette: master.palette,
              })
            }
            className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-2"
          >
            <FrameThumb rows={masterRows} colors={colors} box={72} />
          </button>

          <span className="text-xs font-bold">{master.title}</span>
          {edited && <span className="text-[10px] text-[color:var(--up)]">코드에 아직 안 붙음</span>}
          {gridMismatch && (
            <span className="text-[10px] font-bold text-[color:var(--down)]">
              격자 {masterSize.w}×{masterSize.h} · 원본 {sourceSize.w}×{sourceSize.h}
            </span>
          )}
          <span className="text-[10px] text-[color:var(--muted)]">
            팔·다리 색 {masterLimbCells}칸
          </span>
        </div>

        <div className="min-w-[220px] flex-1">
          <p className="text-xs text-[color:var(--muted)]">
            {group.members.length > 0
              ? `이 대표의 몸을 쓰는 동작 ${group.members.length}개`
              : /*
                 * 대표가 여럿인 캐릭터(32칸 개미)에서 "동작이 하나야"는 거짓말이다 —
                 * 그림은 여덟인데 이 몸에서 갈라져 나온 동작이 아직 없을 뿐이다.
                 */
                char.masters.length > 1
                ? "이 몸에서 갈라져 나온 동작이 아직 없어."
                : "이 캐릭터는 아직 동작이 하나야 — 반영할 데가 없어."}
          </p>

          {gridMismatch && (
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--down)]">
              <b>격자가 원본과 달라 이 그림은 코드로 돌아갈 수 없어.</b> {sourceSize.w}칸짜리
              자리에 {masterSize.w}칸 그림은 안 들어가 — 32칸으로 그리는 개미는 목록 위쪽에서{" "}
              <b>&quot;{ANT32_TITLE}&quot;</b>을 골라야 갈 곳이 있어. 지금 것은 백업으로
              내려받아 두고, 그쪽을 열어 이어 그려.
            </p>
          )}

          {edited && masterLimbCells === 0 && !gridMismatch && group.members.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--up)]">
              대표에 <b>팔·다리 색으로 찍은 칸이 없어.</b> 그러면 그린 팔이 전부 몸통으로
              취급돼서, 동작이 원래 갖고 있던 팔다리가 그 위에 또 얹혀 <b>팔이 두 벌</b>로
              흩어져 보여. 편집창에서 팔·다리는 <b>`팔`·`다리` 색</b>으로 찍어줘.
            </p>
          )}

          {/*
            **코드로 꺼내는 버튼은 늘 있어야 한다.** 예전엔 딸린 동작이 있을 때만 떠서, 동작이
            없는 대표(32칸 개미의 기본 자세 여덟)는 다 그려놓고도 코드에 붙일 길이 없었다 —
            브라우저에만 남은 그림은 언젠가 잃는 그림이다.
          */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={copyGroup}>
              {group.members.length > 0 ? "묶음 코드 복사" : "코드 복사"}
            </button>
          </div>

          {group.members.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/*
                **대표에 고친 자국이 남아 있으면 뜬다** — 이번 판에 고쳤는지(`touched`)로만
                판정하면 새로고침 한 번에 버튼이 사라져, 어제 고쳐둔 대표를 반영할 길이 없다.
              */}
              {(edited || touched) && applying === null && !undoable && (
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-xs"
                  onClick={() => onApply(group.members, limbs)}
                >
                  프레임에 반영하기
                </button>
              )}

              {applying !== null && (
                <div className="flex w-48 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--line)]">
                    <i
                      className="block h-full bg-[color:var(--fg)] transition-[width]"
                      style={{ width: `${Math.round(applying * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[color:var(--muted)]">
                    {Math.round(applying * 100)}%
                  </span>
                </div>
              )}

              {undoable && applying === null && (
                <button
                  type="button"
                  className="btn-outline px-3 py-1.5 text-xs"
                  onClick={() => onUndoApply(undoable.before)}
                >
                  반영 취소
                </button>
              )}

              {/* 팔다리를 어떻게 할지는 **고르는 사람 몫이다** — 그림을 어떻게 고쳤는지에 달렸다 */}
              <select
                value={limbMode}
                onChange={(event) => onLimbMode(event.target.value as "keep" | "master" | "fit")}
                className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-1 text-[11px]"
              >
                <option value="keep">팔다리: 동작 것 그대로</option>
                <option value="master">팔다리: 대표 것으로 통일 (다시 옮길 출발점)</option>
                <option value="fit">팔다리: 새 몸 크기에 맞춰 옮기기</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {group.members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {group.members.map((poseId) => {
            const pose = char.poses.find((item) => item.id === poseId);
            const rows = currentRows(overrides, char.id, poseId);

            return (
              <button
                key={poseId}
                type="button"
                onClick={() =>
                  onOpen({
                    charId: char.id,
                    poseId,
                    title: `${char.title} · ${pose?.title ?? poseId}`,
                    rows,
                    palette: pose?.palette ?? master.palette,
                  })
                }
                className="flex flex-col items-center gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-2"
              >
                <FrameThumb rows={rows} colors={colors} box={44} />
                <span className="text-[10px] text-[color:var(--muted)]">{pose?.title ?? poseId}</span>
              </button>
            );
          })}
        </div>
      )}

      {group.outsiders.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-[color:var(--muted)]">
          <b className="text-[color:var(--fg)]">따로 그린 자세</b> — 몸이 달라 자동 반영에서 빠져:{" "}
          {group.outsiders
            .map(({ id }) => char.poses.find((pose) => pose.id === id)?.title ?? id)
            .join(" · ")}
        </p>
      )}
    </section>
  );
}
