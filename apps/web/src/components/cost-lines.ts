import type { Mood } from "@yca/shared";

/**
 * 손익 금액을 일상 물건으로 환산한 한 줄 — "이 정도면 치킨 13마리 시켜도 돼!"처럼
 * 기회비용을 체감시킨다. 카운터 시계 바로 아래에 랜덤으로 하나 뜬다.
 *
 * **완결된 문장으로 말한다.** "치킨 13마리"처럼 명사만 던지면 그게 번 건지 잃은 건지,
 * 좋은 건지 나쁜 건지 안 와닿는다. 그래서 수익은 "이 정도면 ~ 할 수 있어!"(신남),
 * 손실은 "~ 날아갔어.."(아쉬움)로 방향과 감정까지 실어 끝맺는다.
 *
 * **금액(₩)이 필요하므로 대시보드에서만 쓴다.** 공유 화면은 금액을 싣지 않으므로
 * (개인정보 — 링크엔 종목명·시간·단계·손익여부만) `pnl`을 안 넘기고, 그러면 이 줄도 없다.
 *
 * 본문 폰트라 픽셀 폰트 서브셋 대상이 아니다 — 고쳐도 `pnpm --filter @yca/web font`를
 * 다시 돌릴 필요가 없다.
 */

interface CostItem {
  /** 개당 가격 (원). |손익| ÷ 이 값 = 개수 */
  price: number;
  /** 수익일 때: 그만큼 살 수 있다 (신난 톤, 느낌표) */
  profit: (n: string) => string;
  /** 손실일 때: 그만큼 날렸다 (아쉬운 톤, 말줄임) */
  loss: (n: string) => string;
}

// 2026년 대략가 기준. 개수 단위(잔/개/마리…)는 문구마다 박아 넣는다.
const ITEMS: readonly CostItem[] = [
  {
    price: 4_500,
    profit: (n) => `이 정도면 스벅 아아 ${n}잔은 그냥 사 먹지!`,
    loss: (n) => `스벅 아아 ${n}잔 값이 날아갔어..`,
  },
  {
    price: 3_500,
    profit: (n) => `이 정도면 맥모닝 ${n}개는 먹고도 남아!`,
    loss: (n) => `맥모닝 ${n}개가 그냥 사라졌네..`,
  },
  {
    price: 20_000,
    profit: (n) => `이 정도면 치킨 ${n}마리 시켜도 돼!`,
    loss: (n) => `치킨 ${n}마리가 통째로 증발했어..`,
  },
  {
    price: 13_500,
    profit: (n) => `이 정도면 ${n}달 동안 넷플릭스 볼 수 있어!`,
    loss: (n) => `${n}달치 넷플릭스 구독료가 녹았어..`,
  },
  {
    price: 9_000,
    profit: (n) => `이 정도면 국밥 ${n}그릇은 사 먹지!`,
    loss: (n) => `국밥 ${n}그릇을 굶은 셈이야..`,
  },
  {
    price: 1_700,
    profit: (n) => `이 정도면 편의점 라면 ${n}개는 먹어!`,
    loss: (n) => `이제 점심은 편의점 라면 ${n}개 신세야..`,
  },
  {
    price: 4_000,
    profit: (n) => `이 정도면 김밥 ${n}줄은 사 먹어!`,
    loss: (n) => `김밥 ${n}줄 값이 사라졌어..`,
  },
  {
    price: 4_800,
    profit: (n) => `이 정도면 택시 ${n}번은 타도 돼!`,
    loss: (n) => `택시 ${n}번 탈 돈이 날아갔어..`,
  },
  {
    price: 5_000,
    profit: (n) => `이 정도면 소주 ${n}병은 시켜!`,
    loss: (n) => `오늘은 소주 ${n}병 각이네..`,
  },
  {
    price: 1_000,
    profit: (n) => `이 정도면 로또 ${n}장 긁을 돈이야!`,
    loss: (n) => `로또 ${n}장 긁은 셈 치자..`,
  },
];

const won = new Intl.NumberFormat("ko-KR");

/**
 * 손익 금액(원, 절댓값)에 맞는 물건 한 줄. `seed`로 물건을 고르고 개수는 금액에서
 * 곧바로 나온다 — `seed`는 호출부가 붙잡아둬 구간·손익 방향이 바뀔 때만 다시 뽑는다.
 *
 * 금액이 제일 싼 물건값에도 못 미치면(개수가 0이면) 물건 줄 대신 null — "치킨 0마리"를
 * 막는다. 본전(even)도 null.
 */
export function pickCostLine(mood: Mood, pnlAbs: number, seed: number): string | null {
  if (mood === "even") return null;

  const affordable = ITEMS.filter((item) => pnlAbs >= item.price);
  const item = affordable[Math.abs(Math.floor(seed)) % affordable.length];
  if (!item) return null;

  // **버림이다.** 반올림하면 7,500원에 "소주 2병 시켜!"가 되는데 두 병은 못 산다 —
  // 살 수 있다고 말하는 줄이라 실제로 살 수 있는 개수만 적는다. 위 filter가 1개 이상을 보장한다.
  const n = won.format(Math.floor(pnlAbs / item.price));

  return mood === "loss" ? item.loss(n) : item.profit(n);
}
