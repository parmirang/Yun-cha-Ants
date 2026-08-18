import type { Mood } from "@yca/shared";

/**
 * GA4로 내보내는 이벤트를 모아둔 곳.
 *
 * **연봉·시급·평단가·수량·손익 금액은 절대 파라미터에 넣지 않는다.** 재무 정보는
 * localStorage 밖으로 나가지 않는 게 이 앱의 규칙이고(공유 링크조차 종목명·시간·단계·
 * 손익여부만 싣는다), GA도 예외가 아니다. 그래서 이벤트마다 보낼 수 있는 모양을 아래
 * `EventParams`에 못 박아뒀다 — 호출부에서 아무 객체나 넘길 수 없다. 새 이벤트는
 * 여기에 먼저 적고 쓴다.
 *
 * 화면 이동이 거의 없는 앱이라 페이지뷰만으로는 `/` 하나밖에 안 남는다. 온보딩이
 * 어디서 끊기는지는 이 이벤트들로만 보인다.
 */
interface EventParams {
  /**
   * 연봉 단계 통과 — 온보딩의 **마지막** 단계다 (종목 → 평단가·수량 → 연봉).
   * 금액이 아니라 "적었나 / 무일푼을 골랐나"만 남긴다.
   */
  salary_submit: { salary_kind: "entered" | "broke" };
  /** 검색 결과 0건. 오타와 미지원 종목(해외 주식·ETF)이 여기 섞여 들어온다. */
  ticker_search_miss: { search_term: string };
  ticker_select: { ticker_symbol: string; ticker_name: string };
  /**
   * 연봉까지 넣고 결과 화면에 도달 — 온보딩 전환.
   *
   * 연봉이 마지막 단계라 `salary_submit`과 **같은 순간에** 찍힌다. 둘을 다 두는 건
   * 한쪽이 종류(적었나/무일푼)를 싣고 다른 쪽이 종목을 싣기 때문이다.
   */
  onboarding_complete: { ticker_symbol: string; ticker_name: string };
  share_click: { share_method: "web_share" | "clipboard"; mood: Mood };
  /** 인스타 내보내기 시트를 엶 — 여기서 실제 내보내기까지 얼마나 새는지 본다. */
  story_open: undefined;
  /** 시트에서 실제로 내보냄. 공유 시트로 넘겼는지, 파일로 저장했는지만 남긴다. */
  story_export: { export_method: "share" | "download"; mood: Mood };
  /** 공유 링크로 들어온 사람이 "나도 내 개미 키우기"를 누름. */
  share_cta_click: undefined;
  /** 개미를 탭해 추가 매수 시트를 엶. */
  averaging_open: undefined;
  averaging_confirm: { averaging_kind: "down" | "up" };
  profile_reset: undefined;
}

type Gtag = (command: "event", name: string, params?: object) => void;

/**
 * 파라미터가 없는 이벤트는 인자 하나로, 있는 이벤트는 두 인자를 **반드시** 받게 한다.
 * 두 번째 인자를 그냥 optional로 두면 파라미터를 빠뜨린 호출이 조용히 통과한다.
 */
type Args<K extends keyof EventParams> = EventParams[K] extends undefined
  ? []
  : [EventParams[K]];

export function track<K extends keyof EventParams>(name: K, ...args: Args<K>): void {
  if (typeof window === "undefined") return;

  // 측정 ID가 없거나(로컬 개발), 단일 HTML 목업이거나, 광고 차단기가 막았을 때 —
  // 전부 정상 경로다. 조용히 지나간다.
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!gtag) return;

  gtag("event", name, args[0]);
}
