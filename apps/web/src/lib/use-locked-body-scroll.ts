import { useEffect } from "react";

/**
 * 시트가 떠 있는 동안 **뒤 화면의 스크롤을 잠근다.**
 *
 * 딤은 시각적으로만 덮을 뿐이라, 딤 위를 쓸면 그 아래 대시보드가 그대로 따라 움직인다.
 * 시트가 길어 안쪽을 스크롤하다 끝에 닿을 때도 스크롤이 뒤로 넘어간다
 * (그쪽은 시트에 걸어둔 `overscroll-contain`이 막는다).
 *
 * iOS Safari는 body에 `overflow: hidden`만 걸면 안 먹으므로 `position: fixed`로 못
 * 박는다. 그러면 스크롤 위치가 0으로 튀니 열 때의 위치를 기억했다가 닫을 때
 * 되돌린다 — 안 되돌리면 시트를 닫는 순간 화면이 맨 위로 올라간다.
 */
export function useLockedBodyScroll() {
  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;
    const saved = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = saved.position;
      body.style.top = saved.top;
      body.style.width = saved.width;
      body.style.overflow = saved.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);
}
