"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  MAX_INPUT_SHARES,
  capNumericInput,
  formatNumericInput,
  parseNumericInput,
} from "@/lib/format";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";

import { NumericKeypadInline } from "./numeric-keypad";

/** 한 줄 높이(px). 아래 `.picker-row`와 **같은 값이어야** 스크롤 위치로 고른 값을 되짚는다. */
const ROW_PX = 44;

/** 가운데 줄 위아래로 보이는 줄 수. 창 높이는 (VISIBLE_ROWS × ROW_PX)다. */
const VISIBLE_ROWS = 5;

/**
 * 피커에 올릴 수량. 1~20주는 한 주 단위로, 그 위로는 자릿수에 맞춰 성글게 벌린다.
 * 목록에 없는 수량은 휠 아래 **[직접입력]** 버튼이 받는다 — 소수점 수량(0.5주)도 그 길이다.
 *
 * 온보딩과 평단 바꾸기 시트가 **같은 목록**을 쓴다 — 두 벌이 되면 한쪽만 고쳐져 어긋난다.
 */
export const QUANTITY_OPTIONS = [
  ...Array.from({ length: 20 }, (_, index) => index + 1),
  25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
  100, 150, 200, 300, 400, 500, 700,
  1000, 1500, 2000, 3000, 5000, 10000,
];

/**
 * 수량 피커. **드롭다운이 아니라 바텀시트 휠**이다.
 *
 * `<select>`는 iOS에서만 바닥 휠로 열리고 데스크톱·안드로이드에서는 드롭다운으로 떨어져
 * 화면마다 다른 물건이 된다. 여기서 직접 그리면 어디서나 같은 모양이고, 굵은 손가락으로
 * 굴려 고르는 감각도 그대로 산다.
 *
 * 고른 값은 **가운데 칸에 놓인 줄**이다 — 스크롤 위치를 줄 높이로 나눠 되짚으므로
 * `ROW_PX`와 CSS의 줄 높이가 어긋나면 엉뚱한 값이 잡힌다.
 *
 * 시트 안에 길이 둘이다: 휠에서 고르거나, **[직접입력]으로 시트 안 입력 모드**에 들어가
 * 인라인 키패드로 적거나 (소수점 가능). 입력 모드의 [닫기]는 휠로 되돌아온다 — 어느
 * 길로 확정하든 `onSelect`에는 숫자 문자열 하나가 돌아간다.
 *
 * **여닫는 상태는 바깥이 쥔다.** 이 시트는 자기 버튼으로만 열리지 않는다 — 평단가를
 * 다 친 순간 이어서 뜨는 게 그 화면의 흐름이라, "언제 열리나"는 흐름을 아는 쪽이
 * 정해야 한다 (`onboarding.tsx`의 `PositionStep`).
 */
export function QuantityPicker({
  options,
  value,
  onSelect,
  className,
  open,
  onOpenChange,
  onBack,
  title = "몇 주 샀어?",
}: {
  options: number[];
  /** 지금 고른 값 — 숫자 문자열. 직접입력으로 적은 소수점 값("3.5")일 수도 있다. */
  value: string;
  onSelect: (next: string) => void;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 헤더의 ‹(이전). **어디로 되돌아갈지는 부르는 쪽이 안다** — 평단가 키패드의
   * "다음"으로 들어왔으면 그 키패드를 다시 열어야 하고, 수량 칸을 직접 눌러 들어왔으면
   * 페이지로 돌아가면 된다. 없으면 그냥 닫는다 (딤 탭과 같다).
   */
  onBack?: () => void;
  /** 시트 제목. 온보딩은 산 걸 묻고(기본값), 평단 바꾸기는 살까 말까를 묻는다. */
  title?: string;
}) {
  return (
    <>
      <button className={className} type="button" onClick={() => onOpenChange(true)}>
        {formatNumericInput(value)}
      </button>

      {/*
        시트는 **body에 직접 건다.** 이 컴포넌트가 놓이는 자리는 라벨 안이라, 거기서
        그리면 시트 속 버튼을 누르는 것도 라벨을 누른 것으로 읽히고 조상의 쌓임 맥락에
        갇힌다 (fixed인데도 뒤 화면 위로 못 올라오는 경우가 생긴다).
      */}
      {open &&
        createPortal(
          <QuantitySheet
            options={options}
            value={value}
            title={title}
            onClose={() => onOpenChange(false)}
            onBack={onBack}
            onConfirm={(next) => {
              onSelect(next);
              onOpenChange(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}

function QuantitySheet({
  options,
  value,
  title,
  onClose,
  onBack,
  onConfirm,
}: {
  options: number[];
  value: string;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  onConfirm: (next: string) => void;
}) {
  const rows = options.map(String);
  const initial = Math.max(0, rows.indexOf(value));

  /*
   * 시트 안의 두 모드 — 휠(기본)과 직접입력. 입력 모드의 [닫기]는 시트를 닫지 않고
   * 휠로 되돌린다 ("이전으로 돌아갈 수 있는 경로").
   */
  const [mode, setMode] = useState<"wheel" | "input">("wheel");
  const [draft, setDraft] = useState("");

  const wheelRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);

  useLockedBodyScroll();

  // 열자마자 지금 값이 가운데 오도록 맞춰둔다 (연출 없이 즉시 — 열면서 굴러가면 산만하다).
  // 입력 모드에서 휠로 돌아올 때도 다시 돈다 (휠이 다시 마운트된다).
  useEffect(() => {
    const wheel = wheelRef.current;
    if (wheel) wheel.scrollTop = initial * ROW_PX;
  }, [initial, mode]);

  const syncIndex = () => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const centered = Math.round(wheel.scrollTop / ROW_PX);
    setIndex(Math.min(rows.length - 1, Math.max(0, centered)));
  };

  const scrollTo = (next: number) => {
    wheelRef.current?.scrollTo({ top: next * ROW_PX, behavior: "smooth" });
    setIndex(next);
  };

  const picked = rows[index] ?? String(options[0] ?? 1);

  // 치는 중인 "3."도 숫자로는 3이라, 확정 때만 꼬리 소수점을 털어낸다.
  const draftClean = draft.endsWith(".") ? draft.slice(0, -1) : draft;
  const draftValid = parseNumericInput(draftClean) > 0;

  const submitDraft = () => {
    if (draftValid) onConfirm(draftClean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "wheel" ? (
          <>
            {/* 제목 오른쪽이 직접입력(소수점)로 가는 길, 아래 왼쪽 [이전]이 온 길로
                되돌아가는 길이다. 제목은 가운데를 지키도록 버튼을 절대배치로 얹는다. */}
            <div className="relative">
              <span className="block text-center text-sm font-semibold">{title}</span>
              <button
                className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-sm font-semibold text-[color:var(--muted)]"
                type="button"
                onClick={() => {
                  // 지금 값이 목록에 없으면(예전에 직접 적은 값) 이어서 고치게 채워둔다.
                  setDraft(rows.includes(value) ? "" : value);
                  setMode("input");
                }}
              >
                직접입력
              </button>
            </div>

            <div className="picker" style={{ height: VISIBLE_ROWS * ROW_PX }}>
              {/* 가운데 칸. 여기 놓인 줄이 고른 값이다. */}
              <div className="picker-band" style={{ height: ROW_PX }} aria-hidden />

              <div
                ref={wheelRef}
                className="picker-wheel"
                style={{ paddingBlock: ((VISIBLE_ROWS - 1) / 2) * ROW_PX }}
                onScroll={syncIndex}
              >
                {rows.map((row, rowIndex) => (
                  <button
                    key={row}
                    className="picker-row"
                    style={{ height: ROW_PX }}
                    type="button"
                    data-picked={rowIndex === index ? "" : undefined}
                    onClick={() => scrollTo(rowIndex)}
                  >
                    {`${formatNumericInput(row)}주`}
                  </button>
                ))}
              </div>
            </div>

            {/* 왼쪽 [이전]은 온 길로 되돌아간다(onBack — 어디로 갈지는 부르는 쪽이 안다),
                오른쪽이 확정. 입력 모드의 [닫기][입력]과 같은 3열 그리드라 모드를 오가도
                버튼 모서리가 제자리에 선다. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="btn-ghost" type="button" onClick={onBack ?? onClose}>
                이전
              </button>
              <button
                className="btn-primary col-span-2"
                type="button"
                onClick={() => onConfirm(picked)}
              >
                입력완료
              </button>
            </div>
          </>
        ) : (
          /* form인 건 하드웨어 키보드의 엔터로도 확정되게 하기 위해서다. */
          <form
            onSubmit={(event) => {
              event.preventDefault();
              /*
               * **`stopPropagation`을 빼면 안 된다.** 이 시트는 `createPortal`로 body에
               * 걸리지만 React 이벤트는 DOM이 아니라 **React 트리**를 타고 올라간다 —
               * 이 form을 감싼 React 조상에는 부르는 쪽의 form(평단가 화면·물타기 시트)이
               * 있어서, 여기서 안 막으면 그쪽 `onSubmit`까지 함께 터진다.
               *
               * 그러면 확정과 동시에 바깥의 `advance()`가 돌고, 그때 바깥이 쥔
               * "수량 골랐나"는 아직 이번 확정 이전 값이라 **시트를 도로 연다** —
               * [입력]을 눌러도 시트가 안 닫히고, 한 번 더 누르면 다음 화면으로 건너뛴다.
               */
              event.stopPropagation();
              submitDraft();
            }}
          >
            <span className="block text-center text-sm font-semibold">{title}</span>

            <label className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-4 py-3">
              <input
                className="min-w-0 flex-1 bg-transparent text-right text-lg font-semibold tabular-nums outline-none"
                /* 네이티브 키보드를 안 부른다 — 아래 인라인 키패드가 대신한다. */
                inputMode="none"
                autoFocus
                placeholder="0.5"
                value={draft}
                onChange={(event) =>
                  setDraft(capNumericInput(event.target.value, MAX_INPUT_SHARES))
                }
              />
              <span className="shrink-0 text-sm text-[color:var(--muted)]">주</span>
            </label>

            <NumericKeypadInline
              className="mt-4"
              value={draft}
              onChange={(next) => setDraft(capNumericInput(next, MAX_INPUT_SHARES))}
            />

            {/* 위 숫자 패드와 같은 3열 그리드 — 버튼 모서리가 키 모서리와 나란히 선다. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {/* 휠로 되돌아가는 길이라 이름도 "이전" — 시트를 닫는 게 아니다.
                  "다시 입력"과 같은 라인 버튼(btn-ghost)을 입는다. */}
              <button className="btn-ghost" type="button" onClick={() => setMode("wheel")}>
                이전
              </button>
              <button className="btn-primary col-span-2" type="submit" disabled={!draftValid}>
                입력
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
