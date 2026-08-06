"use client";

import { type RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { scrollableAncestor } from "@/lib/keyboard-inset";

/** 입력칸이 키패드에 딱 붙으면 잘린 것처럼 보인다 — 이만큼 띄워 굴린다. */
const REVEAL_MARGIN_PX = 12;

/** ⌫를 이만큼 누르고 있으면 연속 삭제가 시작된다. */
const REPEAT_DELAY_MS = 450;

/** 연속 삭제 간격. */
const REPEAT_INTERVAL_MS = 70;

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * 화면에 직접 그리는 숫자 키패드. 숫자 입력칸은 네이티브 키보드를 부르지 않고
 * (`inputMode="none"`) 이걸 띄운다.
 *
 * 네이티브를 버린 이유는 둘이다. **iOS 숫자 키패드에는 엔터 키가 없다** — 확인 버튼을
 * 키보드 위에 띄우거나(kb-bar) 굴려서 보여주는(useRevealOnKeyboard) 우회로가 화면마다
 * 필요했다. 그리고 **iOS가 키보드 옆에 띄우는 자동완성 알약(비밀번호·카드·주소)을 웹이
 * 못 끈다** — 연봉을 적는 칸에 카드 자동입력이 뜬다. 키보드를 안 부르면 둘 다 사라지고,
 * 맨 아랫줄 [지우기][0][확인]으로 입력과 확정이 키패드 안에서 끝난다.
 *
 * 값 편집은 **끝자리에서만** 한다 (숫자는 뒤에 붙이고 ⌫는 뒤에서 지운다). 상한과 쉼표는
 * 부르는 쪽이 입력칸 onChange와 같은 `capNumericInput`으로 맡는다 — 어느 길로 들어와도
 * 같은 규칙을 타야 한다.
 *
 * **여닫는 상태는 부르는 쪽이 쥔다** (수량 피커와 같은 이유). 밖을 눌러도 닫히지 않고
 * ▾나 흐름(수량 시트 열기, 제출)이 닫는다 — 블러에 닫기를 걸면 VoiceOver처럼
 * pointerdown 없이 클릭이 오는 경로에서 키가 눌리기 전에 키패드가 사라진다.
 */
export function NumericKeypad({
  value,
  onChange,
  submitLabel,
  submitDisabled = false,
  onSubmit,
  onDismiss,
  revealRef,
}: {
  /** 편집 중인 칸의 값 — 쉼표 붙은 표시 문자열 그대로. */
  value: string;
  /** 키 하나를 반영한 다음 문자열. 부르는 쪽이 `capNumericInput`을 씌워 담는다. */
  onChange: (draft: string) => void;
  /** 확인 키에 적히는 글자 — 화면 아래 실제 버튼과 같은 말을 해야 한다. */
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
  /** ▾로 접을 때. 포커스도 여기서 거둬야 다시 눌렀을 때 focus 이벤트가 온다. */
  onDismiss: () => void;
  /** 키패드가 가리면 안 되는 묶음 — 뜰 때 이 아래끝이 키패드 위로 오도록 굴린다. */
  revealRef?: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * 연속 삭제 타이머가 부르는 삭제는 **렌더 사이**에 돌므로 props 클로저가 낡는다 —
   * 최신 값을 ref로 쥐고 타이머는 이쪽만 읽는다.
   */
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const deleteLast = () => {
    if (valueRef.current.length > 0) {
      onChangeRef.current(valueRef.current.slice(0, -1));
    }
  };

  const repeatTimer = useRef<{ delay: number; tick: number } | null>(null);
  /** 이번 누름에서 연속 삭제가 돌았나 — 돌았다면 뒤따르는 click은 소비된 것이다. */
  const repeated = useRef(false);

  const startRepeat = () => {
    repeated.current = false;
    const delay = window.setTimeout(() => {
      repeated.current = true;
      deleteLast();
      if (repeatTimer.current) {
        repeatTimer.current.tick = window.setInterval(deleteLast, REPEAT_INTERVAL_MS);
      }
    }, REPEAT_DELAY_MS);
    repeatTimer.current = { delay, tick: 0 };
  };

  const stopRepeat = () => {
    if (!repeatTimer.current) return;
    clearTimeout(repeatTimer.current.delay);
    clearInterval(repeatTimer.current.tick);
    repeatTimer.current = null;
  };

  useEffect(() => stopRepeat, []);

  /*
   * 뜰 때 한 번, 가려지면 안 되는 묶음을 키패드 위로 굴려 보여준다.
   * 네이티브 키보드 시절의 `useRevealOnKeyboard`가 하던 일 — 이제 키보드가 화면 요소라
   * 시각 뷰포트를 잴 것 없이 키패드 높이를 직접 잰다.
   */
  useEffect(() => {
    const target = revealRef?.current;
    if (!target) return;

    // 키패드가 그려진 다음 프레임에 재야 실제 높이가 잡힌다.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      /*
       * 키패드 윗변을 getBoundingClientRect로 재면 안 된다 — 등장 애니메이션이
       * translateY(100%)에서 시작하므로 그 순간엔 아직 화면 밖에 있는 걸로 읽혀
       * 굴림이 통째로 무산된다. offsetHeight는 transform과 무관하다.
       */
      const keypadTop = window.innerHeight - panel.offsetHeight;
      const overflow =
        target.getBoundingClientRect().bottom - keypadTop + REVEAL_MARGIN_PX;
      if (overflow <= 0) return;

      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : ("smooth" as const);

      // 시트처럼 안쪽에서 스크롤되는 화면은 그 스크롤러를 민다 (뒤 화면은 잠겨 있다).
      scrollableAncestor(target)?.scrollBy({ top: overflow, behavior }) ??
        window.scrollBy({ top: overflow, behavior });
    });

    return () => cancelAnimationFrame(frame);
  }, [revealRef]);

  /*
   * 눌림 표시는 JS가 단다 — 아래에서 pointerdown을 preventDefault(입력칸 포커스 유지)
   * 하면 :active가 안 서는 브라우저가 있다. 동작 자체는 click에 걸어 VoiceOver처럼
   * pointerdown 없이 클릭만 합성하는 경로에서도 키가 눌린다.
   */
  const pressKey = (event: React.PointerEvent) => {
    const key = (event.target as HTMLElement).closest("button");
    if (key) key.dataset.pressed = "";
  };
  const releaseKeys = () => {
    stopRepeat();
    panelRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-pressed]")
      .forEach((key) => delete key.dataset.pressed);
  };

  return createPortal(
    <div
      ref={panelRef}
      className="keypad"
      role="group"
      aria-label="숫자 키패드"
      /* 키를 눌러도 입력칸의 포커스(커서)를 뺏지 않는다. */
      onPointerDown={(event) => {
        event.preventDefault();
        pressKey(event);
      }}
      onPointerUp={releaseKeys}
      onPointerCancel={releaseKeys}
      onPointerLeave={releaseKeys}
    >
      <div className="keypad-inner">
        <button className="keypad-dismiss" type="button" aria-label="키패드 접기" onClick={onDismiss}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="m5 8 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="keypad-grid">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              className="keypad-key"
              type="button"
              onClick={() => onChange(value + digit)}
            >
              {digit}
            </button>
          ))}

          <button
            className="keypad-key keypad-fn"
            type="button"
            aria-label="지우기"
            onPointerDown={startRepeat}
            onClick={() => {
              // 길게 눌러 이미 지워졌으면 손을 뗄 때의 click은 한 번 더 지우지 않는다.
              if (repeated.current) {
                repeated.current = false;
                return;
              }
              deleteLast();
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 5h10.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-5.8-6.4a1 1 0 0 1 0-1.3L9 5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="m11.8 9.5 5 5m0-5-5 5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button className="keypad-key" type="button" onClick={() => onChange(value + "0")}>
            0
          </button>

          <button
            className="keypad-key keypad-submit"
            type="button"
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
