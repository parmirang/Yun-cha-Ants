import { z } from "zod";

export const positionSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  /** 매수 평단가 (원) */
  avgPrice: z.number().positive(),
  /** 보유 수량 (주) */
  quantity: z.number().int().positive(),
});

export type Position = z.infer<typeof positionSchema>;

export const profileSchema = z.object({
  /** 세전 연봉 (원) */
  annualSalary: z.number().positive(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * 물타기(현재가 < 평단가) / 불타기(현재가 > 평단가) 이후의 새 평단가와 수량.
 * 둘 다 "추가 매수"라는 점에서 계산은 같고, 라벨만 다르다.
 */
export function averageIn(
  position: Position,
  addPrice: number,
  addQuantity: number,
): Position {
  const totalQuantity = position.quantity + addQuantity;
  const totalCost = position.avgPrice * position.quantity + addPrice * addQuantity;

  return {
    ...position,
    avgPrice: totalCost / totalQuantity,
    quantity: totalQuantity,
  };
}
