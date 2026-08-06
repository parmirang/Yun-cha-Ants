"use client";

import { useEffect } from "react";

/** 이 높이를 넘게 가려지면 키보드로 본다 — 주소창이 접혔다 펴질 때도 몇 px씩 흔들린다. */
const KEYBOARD_THRESHOLD_PX = 80;

/**
 * 소프트 키보드가 가린 높이. 그만큼 화면 아래를 늘려둬야(`globals.css`의 `.kb-pad`)
 * 입력칸이 키보드 뒤로 들어갔을 때 굴려 꺼낼 자리가 생긴다.
 *
 * 키보드가 올라와도 **레이아웃 뷰포트는 그대로**라 CSS만으로는 이 높이를 알 수 없다.
 * 줄어드는 건 시각 뷰포트뿐이고, 그 차이가 곧 키보드가 먹은 높이다.
 *
 * 숫자 입력칸은 이제 네이티브 키보드를 안 부른다(`NumericKeypad`) — 이 훅이 맡는 건
 * **글자 키보드**가 뜨는 종목 검색뿐이다.
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
export function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    const scrolls = overflowY === "auto" || overflowY === "scroll";

    if (scrolls && node.scrollHeight > node.clientHeight) return node;
  }

  return null;
}
