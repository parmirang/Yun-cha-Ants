import type { Quote, Ticker } from "./market.js";

import { MOCK_TICKERS, type MockTicker } from "./mock-tickers.js";

interface MockState {
  ticker: MockTicker;
  price: number;
  previousClose: number;
}

/** 평균 회귀 강도. 0이면 순수 랜덤워크, 1이면 매 틱 기준가로 복귀. */
const MEAN_REVERSION = 0.02;
const TICK_INTERVAL_MS = 1_000;

/**
 * 목 시세 엔진. 종목별로 기준가 주변을 맴도는 랜덤워크를 굴린다.
 * 실제 시세를 붙일 때는 이 클래스와 같은 모양(getQuotes/subscribe)의
 * 구현체로 교체하면 라우트는 그대로 둘 수 있다.
 */
export class MockMarket {
  private readonly states = new Map<string, MockState>();
  private readonly listeners = new Set<() => void>();
  // 브라우저(number)와 Node(Timeout) 양쪽에서 도는 엔진이라 반환 타입을 추론시킨다.
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(tickers: MockTicker[] = MOCK_TICKERS) {
    for (const ticker of tickers) {
      // 전일 종가는 기준가에서 ±2% 안쪽으로 흩어둬 첫 화면부터 등락이 보이게 한다.
      const previousClose = round(ticker.basePrice * (1 + (Math.random() - 0.5) * 0.04));
      this.states.set(ticker.symbol, { ticker, price: previousClose, previousClose });
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    // Node에서만 있는 API — 목 시세가 프로세스 종료를 붙잡지 않도록.
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

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
      .filter((state): state is MockState => state !== undefined)
      .map((state) => ({
        symbol: state.ticker.symbol,
        name: state.ticker.name,
        price: state.price,
        previousClose: state.previousClose,
        updatedAt,
      }));
  }

  /** 틱마다 호출되는 리스너를 등록하고, 해제 함수를 돌려준다. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private tick(): void {
    for (const state of this.states.values()) {
      const drift = (state.ticker.basePrice - state.price) * MEAN_REVERSION;
      const shock = state.price * state.ticker.volatility * gaussian();
      state.price = Math.max(1, round(state.price + drift + shock));
    }

    for (const listener of this.listeners) listener();
  }
}

function toTicker({ symbol, name, market }: MockTicker): Ticker {
  return { symbol, name, market };
}

/** 원 단위 절사 — 실제 호가 단위는 아니지만 목 데이터로는 충분하다. */
function round(value: number): number {
  return Math.round(value);
}

/** Box-Muller 변환으로 표준정규분포 난수를 만든다. */
function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
