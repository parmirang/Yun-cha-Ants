import type { Ticker } from "./market.js";

export interface MockTicker extends Ticker {
  /** 기준가 (원). 랜덤워크가 이 값 주변을 맴돈다. */
  basePrice: number;
  /** 틱당 변동성 (표준편차 비율) */
  volatility: number;
}

/**
 * 실제 시세 연동 전까지 쓰는 목 종목.
 * 실제 API를 붙일 때는 이 파일과 market.ts만 갈아끼우면 된다.
 */
export const MOCK_TICKERS: MockTicker[] = [
  { symbol: "005930", name: "삼성전자", market: "KOSPI", basePrice: 74_800, volatility: 0.0012 },
  { symbol: "000660", name: "SK하이닉스", market: "KOSPI", basePrice: 198_500, volatility: 0.0018 },
  { symbol: "373220", name: "LG에너지솔루션", market: "KOSPI", basePrice: 372_000, volatility: 0.002 },
  { symbol: "207940", name: "삼성바이오로직스", market: "KOSPI", basePrice: 812_000, volatility: 0.0015 },
  { symbol: "005380", name: "현대차", market: "KOSPI", basePrice: 245_000, volatility: 0.0013 },
  { symbol: "000270", name: "기아", market: "KOSPI", basePrice: 108_900, volatility: 0.0014 },
  { symbol: "035420", name: "NAVER", market: "KOSPI", basePrice: 178_200, volatility: 0.0017 },
  { symbol: "035720", name: "카카오", market: "KOSPI", basePrice: 41_350, volatility: 0.0022 },
  { symbol: "051910", name: "LG화학", market: "KOSPI", basePrice: 302_500, volatility: 0.0019 },
  { symbol: "005490", name: "POSCO홀딩스", market: "KOSPI", basePrice: 268_000, volatility: 0.0018 },
  { symbol: "068270", name: "셀트리온", market: "KOSPI", basePrice: 182_400, volatility: 0.0016 },
  { symbol: "105560", name: "KB금융", market: "KOSPI", basePrice: 84_700, volatility: 0.0011 },
  { symbol: "055550", name: "신한지주", market: "KOSPI", basePrice: 58_900, volatility: 0.0011 },
  { symbol: "012330", name: "현대모비스", market: "KOSPI", basePrice: 241_500, volatility: 0.0013 },
  { symbol: "028260", name: "삼성물산", market: "KOSPI", basePrice: 152_800, volatility: 0.0012 },
  { symbol: "247540", name: "에코프로비엠", market: "KOSDAQ", basePrice: 168_300, volatility: 0.0032 },
  { symbol: "086520", name: "에코프로", market: "KOSDAQ", basePrice: 89_400, volatility: 0.0035 },
  { symbol: "042700", name: "한미반도체", market: "KOSDAQ", basePrice: 96_800, volatility: 0.003 },
  { symbol: "196170", name: "알테오젠", market: "KOSDAQ", basePrice: 312_000, volatility: 0.0028 },
  { symbol: "091990", name: "셀트리온헬스케어", market: "KOSDAQ", basePrice: 71_200, volatility: 0.0024 },
];
