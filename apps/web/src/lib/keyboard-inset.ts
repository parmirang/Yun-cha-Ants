"use client";

import { useEffect } from "react";

/**
 * 소프트 키보드가 가린 높이를 `--keyboard-inset`에 담아둔다.
 *
 * **iOS 숫자 키패드에는 엔터(확인) 키가 아예 없다.** 그래서 "다음"을 누르는 것 말고는
 * 입력을 끝낼 방법이 없는데, 정작 그 버튼이 키보드 뒤에 깔려 안 보인다. 가려진 높이를
 * 알아야 버튼을 그 위로 올릴 수 있다 (globals.css의 `.kb-sticky` / `.kb-pad`).
 *
 * 키보드가 올라와도 **레이아웃 뷰포트는 그대로**라 CSS만으로는 이 높이를 알 수 없다.
 * 줄어드는 건 시각 뷰포트뿐이고, 그 차이가 곧 키보드가 먹은 높이다.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const update = () => {
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      // 주소창이 접혔다 펴질 때도 몇 px씩 흔들린다 — 키보드로 볼 만큼만 반영한다.
      root.style.setProperty("--keyboard-inset", `${hidden > 80 ? Math.round(hidden) : 0}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
