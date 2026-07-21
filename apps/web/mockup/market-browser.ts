import { MockMarket, type Quote, type Ticker } from "@yca/shared";
import { useEffect, useState } from "react";

/**
 * 단일 HTML 목업 전용 시세 소스.
 * 서버의 SSE 대신, API가 쓰는 것과 **같은** MockMarket 엔진을 브라우저에서 직접 굴린다.
 * 빌드 시 @/lib/use-quote 와 @/lib/tickers 가 이 모듈로 치환된다.
 */
const market = new MockMarket();
market.start();

export async function searchTickers(query: string): Promise<Ticker[]> {
  return market.search(query);
}

export function useQuote(symbol: string | null): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      return;
    }

    const read = () => setQuote(market.getQuotes([symbol])[0] ?? null);
    read();

    return market.subscribe(read);
  }, [symbol]);

  return quote;
}
