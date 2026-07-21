"use client";

import { useCallback, useEffect, useState } from "react";
import type { ZodType } from "zod";

/**
 * localStorage에 담아두는 상태. 연봉·보유종목은 서버로 보내지 않는다.
 * SSR에서는 항상 fallback으로 시작하고 마운트 후 한 번 하이드레이트한다
 * (그래야 서버/클라이언트 첫 렌더가 어긋나지 않는다).
 */
export function useStoredState<T>(
  key: string,
  schema: ZodType<T>,
  fallback: T,
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) setValue(parsed.data);
        else window.localStorage.removeItem(key);
      }
    } catch {
      // 손상된 값은 무시하고 fallback으로 진행한다.
    }
    setLoaded(true);
    // key/schema는 호출부에서 상수로 넘긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (next === null || next === undefined) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // 사파리 프라이빗 모드 등에서 쓰기가 막혀도 화면은 계속 동작해야 한다.
      }
    },
    [key],
  );

  return [value, update, loaded];
}
