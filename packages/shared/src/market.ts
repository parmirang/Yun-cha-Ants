import { z } from "zod";

export const tickerSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  market: z.enum(["KOSPI", "KOSDAQ"]),
});

export type Ticker = z.infer<typeof tickerSchema>;

export const tickerListSchema = z.object({
  tickers: z.array(tickerSchema),
});

export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  /** 현재가 (원) */
  price: z.number().nonnegative(),
  /** 전일 종가 (원) — 일간 등락 표시용 */
  previousClose: z.number().nonnegative(),
  /** 시세 생성 시각 (epoch ms) */
  updatedAt: z.number().int(),
});

export type Quote = z.infer<typeof quoteSchema>;

export const quoteListSchema = z.object({
  quotes: z.array(quoteSchema),
});

export type QuoteList = z.infer<typeof quoteListSchema>;
