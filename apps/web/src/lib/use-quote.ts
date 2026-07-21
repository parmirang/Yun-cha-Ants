"use client";

import { type Quote, quoteListSchema } from "@yca/shared";
import { useEffect, useState } from "react";

import { apiBaseUrl } from "./api";

/**
 * 종목 하나의 실시간 시세를 SSE로 구독한다.
 * 지금은 목 시세 서버가 1초마다 밀어주고, 실제 시세로 바꿔도 이 훅은 그대로다.
 */
export function useQuote(symbol: string | null): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      return;
    }

    const source = new EventSource(
      `${apiBaseUrl}/quotes/stream?symbols=${encodeURIComponent(symbol)}`,
    );

    source.onmessage = (event) => {
      const parsed = quoteListSchema.safeParse(JSON.parse(event.data));
      const next = parsed.success ? parsed.data.quotes[0] : undefined;
      if (next) setQuote(next);
    };

    return () => source.close();
  }, [symbol]);

  return quote;
}
