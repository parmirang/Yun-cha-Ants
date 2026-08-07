import { z } from "zod";

export const positionSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  /** 매수 평단가 (원) */
  avgPrice: z.number().positive(),
  /**
   * 보유 수량 (주). **정수를 강제하지 않는다** — 소수점 거래(0.5주)를 받는다.
   * 여기에 `.int()`를 되살리면 소수점 수량을 저장한 사람의 localStorage가
   * 다음 접속에서 검증에 걸려 **통째로 초기화**된다.
   */
  quantity: z.number().positive(),
});

export type Position = z.infer<typeof positionSchema>;

export const profileSchema = z.object({
  /**
   * 세전 연봉 (원).
   * **0은 "수입 없음"이다** — 미입력이 아니라 사용자가 무일푼을 고른 상태이고,
   * 이때 환산은 최저임금 기준으로 떨어진다 (wage.ts의 `effectiveAnnualSalary`).
   */
  annualSalary: z.number().nonnegative(),
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
    // 소수점 수량은 부동소수 꼬리가 붙는다 (0.1 + 0.2 = 0.30000000000000004).
    // 화면이 이 값을 "N주"로 그대로 적으므로 여기서 6자리로 잘라둔다.
    quantity: Math.round(totalQuantity * 1e6) / 1e6,
  };
}

/**
 * 평단이 `targetAvg`가 되게 하는 추가 매수 수량(주). 닿을 수 없으면 null.
 *
 * `(avg·q + p·Q) / (q + Q) = T` 를 Q로 풀면 `Q = q(avg − T) / (T − p)`다.
 * 목표가 지금 평단과 매수 단가 **사이**에 있지 않으면 Q가 음수로 떨어지는데,
 * 그게 곧 "아무리 사도 못 간다"는 뜻이다 (평단은 매수 단가에 수렴만 한다).
 */
export function sharesToTargetAverage(
  position: Position,
  addPrice: number,
  targetAvg: number,
): number | null {
  const shares = (position.quantity * (position.avgPrice - targetAvg)) / (targetAvg - addPrice);

  return Number.isFinite(shares) && shares > 0 ? Math.ceil(shares) : null;
}

/** 추가 매수 한 판의 계산서. 수량·비용·그 결과로 앉을 평단. */
export interface AveragingPlan {
  /** 목표 평단 (원) */
  targetAvg: number;
  /** 거기까지 가는 데 필요한 추가 수량 (주) */
  shares: number;
  /** 그만큼 사는 데 드는 돈 (원) */
  cost: number;
}

/**
 * "몇 주를 더 사야 평단이 현재가 쪽으로 넘어오나"에 대한 답.
 *
 * 평단을 매수 단가까지 끌어내리는 건 불가능하다 — 수렴만 할 뿐 절대 닿지 않는다.
 * 그래서 목표를 **딱 중간**으로 잡는다. 평단과 현재가의 벌어진 폭이 절반으로 줄고,
 * 필요한 수량은 (수학적으로) 지금 들고 있는 수량과 같다.
 *
 * 물타기(단가 < 평단)와 불타기(단가 > 평단)의 계산은 완전히 같다. 불타기 쪽에서는
 * 같은 값이 "수익률을 절반 반납한다"로 읽힐 뿐이다.
 */
export function halfwayAveragingPlan(
  position: Position,
  addPrice: number,
): AveragingPlan | null {
  const targetAvg = (position.avgPrice + addPrice) / 2;
  const shares = sharesToTargetAverage(position, addPrice, targetAvg);
  if (shares === null) return null;

  return { targetAvg, shares, cost: shares * addPrice };
}
