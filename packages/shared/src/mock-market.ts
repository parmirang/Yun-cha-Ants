import type { Quote, Ticker } from "./market.js";

import { MOCK_TICKERS, type MockTicker } from "./mock-tickers.js";

interface MarketState {
  ticker: MockTicker;
  /** 전일 종가 (원). 실시간 시세가 붙기 전까지 현재가로도 이 값을 그대로 쓴다. */
  previousClose: number;
}

/**
 * 종목 마스터와 **전일 종가**를 들고 있는 시세 소스.
 *
 * 예전엔 이 자리에서 랜덤워크로 장중 현재가를 지어냈지만, 가짜로 움직이는 시세가
 * 실제인 척 오해를 사서 걷어냈다. 지금은 **현재가 = 전일 종가**로 고정하고,
 * 화면이 "실시간 적용 준비중" 라벨로 그 사실을 알린다.
 *
 * 실시간(장중) 시세를 붙일 때는 이 클래스와 같은 모양(search / getQuotes / subscribe)의
 * 구현체로 갈아끼우면 라우트와 웹은 그대로 둔다 — 그때 `subscribe`가 틱마다 listener를
 * 부르면 SSE가 다시 살아난다. 이름에 Mock이 남은 건 그 스왑 지점을 가리키기 위해서다.
 */
export class MockMarket {
  private readonly states = new Map<string, MarketState>();

  constructor(tickers: MockTicker[] = MOCK_TICKERS) {
    for (const ticker of tickers) {
      // KRX에서 받은 실제 전일 종가를 쓰고, 없으면(키 없는 개발) 기준가로 대신한다.
      const previousClose = ticker.previousClose ?? ticker.basePrice;
      this.states.set(ticker.symbol, { ticker, previousClose });
    }
  }

  /** 실시간 피드가 붙기 전까지 밀어줄 틱이 없다 — 라이프사이클 훅만 남겨둔다. */
  start(): void {}
  stop(): void {}

  search(query: string, limit = 20): Ticker[] {
    const normalized = query.trim().toLowerCase();
    const all = [...this.states.values()].map(({ ticker }) => toTicker(ticker));
    if (!normalized) return all.slice(0, limit);

    return all
      .filter(
        (ticker) =>
          ticker.name.toLowerCase().includes(normalized) ||
          ticker.symbol.includes(normalized),
      )
      .slice(0, limit);
  }

  getQuotes(symbols: string[]): Quote[] {
    const updatedAt = Date.now();

    return symbols
      .map((symbol) => this.states.get(symbol))
      .filter((state): state is MarketState => state !== undefined)
      .map((state) => ({
        symbol: state.ticker.symbol,
        name: state.ticker.name,
        // 장중 현재가는 아직 없다 — 전일 종가를 그대로 현재가로 쓴다.
        price: state.previousClose,
        previousClose: state.previousClose,
        updatedAt,
      }));
  }

  /**
   * 실시간 피드가 없으므로 지금은 밀어줄 틱이 없다. 인터페이스만 지켜 SSE 라우트와
   * 목업이 그대로 붙게 한다 — 실시간을 붙이면 여기서 listener를 호출하면 된다.
   */
  subscribe(_listener: () => void): () => void {
    return () => {};
  }
}

function toTicker({ symbol, name, market }: MockTicker): Ticker {
  return { symbol, name, market };
}
