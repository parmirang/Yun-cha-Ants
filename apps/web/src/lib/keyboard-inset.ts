"use client";

import { type RefObject, useEffect } from "react";

/** 이 높이를 넘게 가려지면 키보드로 본다 — 주소창이 접혔다 펴질 때도 몇 px씩 흔들린다. */
const KEYBOARD_THRESHOLD_PX = 80;

/** 키보드 위로 얼마나 띄워 보여줄지. 버튼이 키보드에 딱 붙으면 눌리기 직전처럼 보인다. */
const REVEAL_MARGIN_PX = 12;

/**
 * 소프트 키보드가 가린 높이. 그만큼 화면 아래를 늘려둬야(`globals.css`의 `.kb-pad`)
 * 버튼이 키보드 위로 올라올 만큼 굴릴 자리가 생긴다.
 *
 * 키보드가 올라와도 **레이아웃 뷰포트는 그대로**라 CSS만으로는 이 높이를 알 수 없다.
 * 줄어드는 건 시각 뷰포트뿐이고, 그 차이가 곧 키보드가 먹은 높이다.
 */
function hiddenByKeyboard(viewport: VisualViewport): number {
  const hidden = window.innerHeight - viewport.height - viewport.offsetTop;

  return hidden > KEYBOARD_THRESHOLD_PX ? Math.round(hidden) : 0;
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--keyboard-inset", `${hiddenByKeyboard(viewport)}px`);
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

/** 실제로 굴릴 수 있는 가장 가까운 조상. 없으면(=페이지가 굴러야 하면) null. */
function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    const scrolls = overflowY === "auto" || overflowY === "scroll";

    if (scrolls && node.scrollHeight > node.clientHeight) return node;
  }

  return null;
}

/**
 * 키보드가 올라오는 순간 `target`이 보이도록 화면을 굴린다.
 *
 * **iOS 숫자 키패드에는 엔터 키가 없다.** 웹은 네이티브 키보드에 키를 못 붙이므로
 * (`enterkeyhint`는 있는 리턴 키의 이름표만 바꾼다) 확인 버튼을 눌러 끝내는 수밖에
 * 없는데, 그 버튼이 키보드 뒤에 깔려 안 보이면 진행이 통째로 막힌다.
 *
 * 버튼을 화면에 붙여 띄우는 방법도 있지만 입력하는 내내 따라다녀 어수선하다.
 * 그래서 **올라오는 그 한 번만** 굴려서 보여주고, 그다음은 손에 맡긴다.
 *
 * 브라우저가 알아서 해주지 않는 이유는 레이아웃 뷰포트가 그대로이기 때문이다 —
 * 브라우저 눈에는 버튼이 멀쩡히 화면 안에 있다. 그래서 보이는 영역(시각 뷰포트)
 * 밖으로 밀려난 만큼을 직접 재서 굴린다.
 */
export function useRevealOnKeyboard(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let wasOpen = hiddenByKeyboard(viewport) > 0;

    const update = () => {
      const isOpen = hiddenByKeyboard(viewport) > 0;
      const justOpened = isOpen && !wasOpen;
      wasOpen = isOpen;

      const element = target.current;
      if (!justOpened || !element) return;

      // 브라우저에게 먼저 맡긴다 — 안쪽 스크롤러가 여럿이면 이쪽이 훨씬 정확하다.
      element.scrollIntoView({ block: "nearest", behavior: "auto" });

      // 그래도 남는 만큼을 직접 굴린다. 위 호출이 자리를 옮기므로 한 프레임 기다렸다 잰다.
      requestAnimationFrame(() => {
        const overflow =
          element.getBoundingClientRect().bottom -
          (viewport.offsetTop + viewport.height) +
          REVEAL_MARGIN_PX;
        if (overflow <= 0) return;

        // 화면이 저 혼자 미끄러지는 건 어지럼증을 부르는 움직임이라 설정을 지킨다.
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth";

        // 시트처럼 **안쪽에서 스크롤되는** 화면은 페이지를 굴려봐야 소용없다 (시트가 떠
        // 있는 동안 뒤 화면은 아예 잠겨 있다). 굴릴 수 있는 조상을 찾아 그쪽을 민다.
        scrollableAncestor(element)?.scrollBy({ top: overflow, behavior }) ??
          window.scrollBy({ top: overflow, behavior });
      });
    };

    viewport.addEventListener("resize", update);

    return () => viewport.removeEventListener("resize", update);
  }, [target]);
}
