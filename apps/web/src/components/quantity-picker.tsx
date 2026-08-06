"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { formatNumericInput } from "@/lib/format";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";

/** 한 줄 높이(px). 아래 `.picker-row`와 **같은 값이어야** 스크롤 위치로 고른 값을 되짚는다. */
const ROW_PX = 44;

/** 가운데 줄 위아래로 보이는 줄 수. 창 높이는 (VISIBLE_ROWS × ROW_PX)다. */
const VISIBLE_ROWS = 5;

export const CUSTOM_QUANTITY = "custom";

/**
 * 피커에 올릴 수량. 1~20주는 한 주 단위로, 그 위로는 자릿수에 맞춰 성글게 벌린다.
 * 목록에 없는 수량을 가진 사람이 막히지 않도록 마지막에 직접 입력을 남겨둔다.
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
  title = "몇 주 샀어?",
}: {
  options: number[];
  /** 지금 고른 값. 숫자 문자열이거나 `CUSTOM_QUANTITY`. */
  value: string;
  onSelect: (next: string) => void;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 시트 제목. 온보딩은 산 걸 묻고(기본값), 평단 바꾸기는 살까 말까를 묻는다. */
  title?: string;
}) {
  return (
    <>
      <button className={className} type="button" onClick={() => onOpenChange(true)}>
        {value === CUSTOM_QUANTITY ? "직접" : formatNumericInput(value)}
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
  onConfirm,
}: {
  options: number[];
  value: string;
  title: string;
  onClose: () => void;
  onConfirm: (next: string) => void;
}) {
  // 마지막 줄은 "직접 적기"다 — 목록에 없는 수량을 가진 사람이 막히지 않게.
  const rows = [...options.map(String), CUSTOM_QUANTITY];
  const initial = Math.max(0, rows.indexOf(value));

  const wheelRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);

  useLockedBodyScroll();

  // 열자마자 지금 값이 가운데 오도록 맞춰둔다 (연출 없이 즉시 — 열면서 굴러가면 산만하다).
  useEffect(() => {
    const wheel = wheelRef.current;
    if (wheel) wheel.scrollTop = initial * ROW_PX;
  }, [initial]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button className="text-sm text-[color:var(--muted)]" type="button" onClick={onClose}>
            취소
          </button>
          <span className="text-sm font-semibold">{title}</span>
          <button
            className="text-sm font-bold"
            type="button"
            onClick={() => onConfirm(picked)}
          >
            완료
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
                {row === CUSTOM_QUANTITY ? "직접 적기" : `${formatNumericInput(row)}주`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
