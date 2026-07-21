import { type Ticker, tickerListSchema } from "@yca/shared";

import { apiBaseUrl } from "./api";

/**
 * 종목 검색. 단일 HTML 목업 빌드에서는 이 모듈이 브라우저 내장 목 엔진으로 교체된다
 * (apps/web/mockup/build.mjs의 alias 참고).
 */
export async function searchTickers(
  query: string,
  signal?: AbortSignal,
): Promise<Ticker[]> {
  const response = await fetch(
    `${apiBaseUrl}/tickers?q=${encodeURIComponent(query)}`,
    { signal },
  );
  const parsed = tickerListSchema.safeParse(await response.json());

  return parsed.success ? parsed.data.tickers : [];
}
