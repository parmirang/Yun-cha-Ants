import type { MockTicker } from "@yca/shared";

import { env } from "./env.js";

/**
 * KRX Data Marketplace OPEN API에서 종목 마스터와 전일 종가를 받아온다.
 *
 * 이 API가 주는 건 **일별 확정 데이터뿐이다** — 장중 현재가는 없다.
 * 그래서 여기서 받은 종가를 MockMarket의 기준가로 깔고, 1초 틱 랜덤워크가
 * 그 위에서 걷는다. 실시간 시세를 붙일 때 갈아끼울 곳은 MockMarket이지
 * 이 파일이 아니다 (종목 마스터는 그대로 쓸 수 있다).
 *
 * 호출 예산: 하루 10,000회 제한인데 서버 기동 때 시장당 1회씩만 쓴다.
 * 날짜 하나로 전 종목이 배열로 통째로 오기 때문이다.
 */

const BASE_URL = "https://data-dbg.krx.co.kr/svc/apis/sto";

/** 휴장일을 만나면 하루씩 뒤로 물러난다. 연휴를 감안해 넉넉히 잡았다. */
const MAX_LOOKBACK_DAYS = 12;
/**
 * 하루치 응답은 한 시장에 900~1,800행이라 실측 ~25초가 걸린다. 넉넉히 잡는다 —
 * 기동 때 시장당 한 번 쓰는 호출이라 오래 기다려도 손해가 없고, 짧게 잡으면
 * 인증이 멀쩡한데도 타임아웃으로 잘려 목으로 떨어진다.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * 틱당 변동성. KRX 일별 데이터로는 진짜 변동성을 알 수 없어(하루치 등락률은
 * 변동성이 아니다) 시장별 고정값을 쓴다. 실시간 시세가 붙으면 사라질 값이다.
 */
const VOLATILITY: Record<Market, number> = { KOSPI: 0.0014, KOSDAQ: 0.0028 };

type Market = "KOSPI" | "KOSDAQ";

const ENDPOINTS: ReadonlyArray<{ path: string; market: Market }> = [
  { path: "stk_bydd_trd", market: "KOSPI" },
  { path: "ksq_bydd_trd", market: "KOSDAQ" },
];

/**
 * 일별매매정보 한 행. 값은 전부 **문자열**이고 숫자에는 천 단위 콤마가 들어있다.
 * 스펙 문서가 로그인을 요구해 필드명은 공개 예제로 확인한 것이라,
 * 어긋나면 loadKrxTickers()가 첫 행의 키를 로그로 뱉는다.
 */
interface KrxRow {
  /** 단축 종목코드 (6자리) */
  ISU_CD?: string;
  /** 종목명 */
  ISU_NM?: string;
  /** 종가 */
  TDD_CLSPRC?: string;
  /** 시가총액 — 검색 결과를 큰 종목부터 보여주려고 쓴다 */
  MKTCAP?: string;
}

interface KrxResponse {
  OutBlock_1?: KrxRow[];
}

/**
 * KRX에서 종목 목록을 받아온다. 인증키가 없거나 호출이 실패하면 null —
 * 호출자가 목 종목으로 떨어진다.
 */
export async function loadKrxTickers(
  log: (message: string) => void,
): Promise<MockTicker[] | null> {
  if (!env.krxAuthKey) {
    log("KRX_AUTH_KEY가 없어 목 종목으로 시작한다.");
    return null;
  }

  try {
    for (const basDd of tradingDayCandidates()) {
      const rows = await Promise.all(
        ENDPOINTS.map(async ({ path, market }) => ({
          market,
          rows: await fetchDay(path, basDd),
        })),
      );

      // 휴장일이면 두 시장 모두 빈 배열로 온다. 하루 물러나 다시 묻는다.
      if (rows.every(({ rows: r }) => r.length === 0)) continue;

      const tickers = rows.flatMap(({ market, rows: r }) => toTickers(r, market));

      if (tickers.length === 0) {
        const sample = rows.find(({ rows: r }) => r.length > 0)?.rows[0];
        log(
          `KRX 응답은 왔지만 종목을 하나도 못 뽑았다. 필드명이 바뀌었을 수 있다. 첫 행의 키: ${Object.keys(sample ?? {}).join(", ")}`,
        );
        return null;
      }

      // 시가총액 내림차순 — 검색어 없이 목록을 열었을 때 큰 종목이 먼저 보인다.
      tickers.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

      log(`KRX ${basDd} 종가 기준 ${tickers.length}종목을 불러왔다.`);

      return tickers.map(({ marketCap: _marketCap, ...ticker }) => ticker);
    }

    log(`최근 ${MAX_LOOKBACK_DAYS}일 안에서 개장일을 못 찾았다. 목 종목으로 시작한다.`);
    return null;
  } catch (error) {
    // 키 길이를 함께 남긴다 — 같은 키가 로컬에서 되는데 배포에서 401이면,
    // 값이 깨진 건지(길이가 다름) 호출 지점이 거부된 건지(길이가 같음)를 이걸로 가른다.
    // 키 자체는 절대 찍지 않는다.
    log(
      `KRX 호출 실패 — 목 종목으로 시작한다: ${String(error)} (인증키 ${env.krxAuthKey?.length ?? 0}자)`,
    );
    return null;
  }
}

async function fetchDay(path: string, basDd: string): Promise<KrxRow[]> {
  const url = `${BASE_URL}/${path}?basDd=${basDd}`;
  const response = await fetch(url, {
    headers: { AUTH_KEY: env.krxAuthKey ?? "" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // 상태코드만으로는 이유를 모른다 — 미신청 서비스인지, 키가 거부된 건지는
    // 본문에만 적혀 온다. 로그 한 줄에 얹을 만큼만 잘라 붙인다.
    const detail = (await response.text().catch(() => ""))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    throw new Error(`${path} ${basDd} → HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
  }

  const body = (await response.json()) as KrxResponse;

  return body.OutBlock_1 ?? [];
}

interface RankedTicker extends MockTicker {
  marketCap?: number;
}

function toTickers(rows: KrxRow[], market: Market): RankedTicker[] {
  const seen = new Set<string>();
  const tickers: RankedTicker[] = [];

  for (const row of rows) {
    const symbol = normalizeSymbol(row.ISU_CD);
    const name = row.ISU_NM?.trim();
    const price = parseNumber(row.TDD_CLSPRC);

    // 거래정지·정리매매 종목은 종가가 0으로 오기도 한다. 0으로 나눌 일을
    // 만들지 않도록 여기서 걸러낸다.
    if (!symbol || !name || price === null || price <= 0) continue;
    if (seen.has(symbol)) continue;

    seen.add(symbol);
    tickers.push({
      symbol,
      name,
      market,
      basePrice: price,
      previousClose: price,
      volatility: VOLATILITY[market],
      marketCap: parseNumber(row.MKTCAP) ?? 0,
    });
  }

  return tickers;
}

/**
 * 단축코드 6자리로 맞춘다. 일별매매정보는 단축코드로 오지만, 혹시 표준코드
 * (KR + 10자리 ISIN)로 오더라도 가운데 6자리가 단축코드라 잘라 쓸 수 있다.
 */
function normalizeSymbol(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";

  if (/^\d{6}$/.test(value)) return value;
  if (/^KR\w{10}$/.test(value)) return value.slice(3, 9);

  return null;
}

/** "1,234,500" 같은 문자열을 숫자로. 빈 값이나 "-"는 null. */
function parseNumber(raw: string | undefined): number | null {
  const value = raw?.replace(/,/g, "").trim() ?? "";
  if (!value || !/^-?\d+(\.\d+)?$/.test(value)) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 오늘(KST)부터 하루씩 거슬러 올라가며 개장일 후보를 낸다.
 * 주말은 물어볼 것도 없이 건너뛰고, 공휴일은 빈 응답으로 판별한다.
 * 장 마감 전이면 오늘 데이터가 아직 없어 자연히 어제로 넘어간다.
 */
function* tradingDayCandidates(): Generator<string> {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const today = new Date(Date.now() + KST_OFFSET_MS);

  for (let back = 0; back < MAX_LOOKBACK_DAYS; back += 1) {
    const day = new Date(today.getTime() - back * 24 * 60 * 60 * 1000);
    const weekday = day.getUTCDay();

    if (weekday === 0 || weekday === 6) continue;

    const year = day.getUTCFullYear();
    const month = String(day.getUTCMonth() + 1).padStart(2, "0");
    const date = String(day.getUTCDate()).padStart(2, "0");

    yield `${year}${month}${date}`;
  }
}
