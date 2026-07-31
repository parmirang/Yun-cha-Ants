"use client";

import {
  BREAKEVEN_STAGE,
  MINIMUM_ANNUAL_SALARY,
  MINIMUM_HOURLY_WAGE,
  type Position,
  type Profile,
  RATE_YEAR,
  type Ticker,
  WORK_HOURS_PER_YEAR,
  estimateNetAnnualSalary,
  grossHourlyWage,
} from "@yca/shared";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { formatNumericInput, formatWon, parseNumericInput } from "@/lib/format";
import { searchTickers } from "@/lib/tickers";
import { useQuote } from "@/lib/use-quote";

import { CandleScene } from "./candle-scene";
import { Hero } from "./hero";
import { TickerLogo } from "./ticker-logo";

type Step = "salary" | "search" | "position";

export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: Profile, position: Position) => void;
}) {
  const [step, setStep] = useState<Step>("salary");
  const [salaryManwon, setSalaryManwon] = useState("");
  const [broke, setBroke] = useState(false);
  const [ticker, setTicker] = useState<Ticker | null>(null);

  // 입력은 세전 연봉이고, 저장·계산에 쓰이는 시급은 실수령 기준이다.
  // 무일푼은 연봉 0으로 저장한다 — 환산은 shared가 최저임금으로 대신 처리한다.
  const annualSalary = broke ? 0 : parseNumericInput(salaryManwon) * 10_000;

  // 평단가 입력은 결과 화면과 같은 무대 위에서 받는다 — 대문 없이 전체를 쓴다.
  if (step === "position" && ticker) {
    return (
      <PositionStep
        ticker={ticker}
        onBack={() => setStep("search")}
        onSubmit={(avgPrice, quantity) =>
          onComplete(
            { annualSalary },
            { symbol: ticker.symbol, name: ticker.name, avgPrice, quantity },
          )
        }
      />
    );
  }

  // 검색 단계만 h-dvh다. 목록이 남는 높이를 채우고 넘치는 만큼 잘리려면 위쪽에
  // **확정된 높이**가 있어야 한다 — min-h-dvh는 아래로 열려 있어서 flex-1도 min-h-0도
  // 목록을 못 줄이고, 목록이 그대로 화면 밖으로 자란다.
  // 연봉 단계는 내용이 길어지면 스크롤돼야 하므로 min-h-dvh 그대로 둔다.
  const frame = step === "search" ? "h-dvh" : "min-h-dvh";

  return (
    <main className={`mx-auto flex w-full max-w-md flex-col px-6 py-10 ${frame}`}>
      {/*
        연봉 단계는 입력을 버튼 위에 붙여두고 남는 공간을 대문이 위아래로 나눠 갖는다
        (my-auto) — 그만큼 대문이 화면 가운데로 내려온다. 여백이 0까지 줄어드는
        작은 화면에서도 문구가 입력란에 붙지 않도록 pb-8로 최소 간격을 깔아둔다.
        검색 단계는 결과 목록이 남는 공간을 다 써야 하므로 대문을 위에 붙여둔다.
      */}
      <Hero className={step === "salary" ? "my-auto pb-8" : "mb-8"} />

      {step === "salary" && (
        <SalaryStep
          value={salaryManwon}
          annualSalary={annualSalary}
          broke={broke}
          onChange={setSalaryManwon}
          onBrokeChange={setBroke}
          onNext={() => setStep("search")}
        />
      )}

      {step === "search" && (
        <SearchStep
          onBack={() => setStep("salary")}
          onSelect={(selected) => {
            setTicker(selected);
            setStep("position");
          }}
        />
      )}
    </main>
  );
}

function SalaryStep({
  value,
  annualSalary,
  broke,
  onChange,
  onBrokeChange,
  onNext,
}: {
  value: string;
  annualSalary: number;
  broke: boolean;
  onChange: (value: string) => void;
  onBrokeChange: (broke: boolean) => void;
  onNext: () => void;
}) {
  // 무일푼이면 annualSalary가 0으로 넘어오므로, 최저임금 연봉을 대신 넣어
  // 화면에도 실제 환산에 쓰일 시급이 그대로 보이게 한다.
  // 아직 안 적은 것(빈 칸)과 무일푼은 둘 다 annualSalary가 0이라 여기서 구분되지 않는다.
  // `effectiveAnnualSalary()`에 그냥 넘기면 빈 칸도 최저임금으로 채워져서, 아무것도
  // 안 넣은 사람에게 최저시급 결과를 보여주고 "다음"까지 열어준다.
  // 최저임금으로 대신하는 건 **체크박스를 켰을 때뿐이다.**
  const basis = broke ? MINIMUM_ANNUAL_SALARY : annualSalary;
  const net = useMemo(() => estimateNetAnnualSalary(basis), [basis]);
  const netWage = net.net / WORK_HOURS_PER_YEAR;
  const grossWage = grossHourlyWage(basis);
  const valid = basis > 0;

  return (
    // 높이를 늘려 잡지 않는다 — 남는 공간은 위쪽 대문이 가져간다.
    <section className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">개미야, 너 얼마나 벌어?</span>
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 has-disabled:opacity-40">
          <input
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none"
            inputMode="numeric"
            placeholder="4,000"
            value={broke ? "" : value}
            disabled={broke}
            /*
             * 만원 단위라 5자리면 9억 9,999만원까지 적을 수 있다. 자릿수를 안 막으면
             * "12000000"(1,200억) 같은 값이 들어와 시급 2,299만원짜리 결과가 멀쩡한
             * 얼굴로 나온다 — 계산이 틀린 게 아니라 입력이 말이 안 되는 것이다.
             * 상한은 formatNumericInput이 잡는다 (maxLength는 쉼표까지 세어서 못 쓴다).
             */
            onChange={(event) => onChange(formatNumericInput(event.target.value, 5))}
          />
          <span className="shrink-0 text-sm text-[color:var(--muted)]">만원</span>
        </div>
      </label>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[color:var(--up)]"
          checked={broke}
          onChange={(event) => onBrokeChange(event.target.checked)}
        />
        나는 그냥 무일푼이야
      </label>

      <p className="text-sm text-[color:var(--muted)]">
        {broke ? (
          <>
            수입이 없으면{" "}
            <strong className="text-[color:var(--fg)]">
              {RATE_YEAR}년 최저시급 {formatWon(MINIMUM_HOURLY_WAGE)}
            </strong>
            으로 일한다고 치고 계산할게.
          </>
        ) : (
          <>
            계약서에 적힌 <strong className="text-[color:var(--fg)]">세전 연봉</strong>을 만원
            단위로 넣어줘. 세금과 4대보험을 뺀 실수령 기준으로 시급을 계산할게.
          </>
        )}
      </p>

      {valid && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
          <p className="text-sm text-[color:var(--muted)]">
            실수령 시급{" "}
            <strong className="text-base text-[color:var(--fg)]">{formatWon(netWage)}</strong>
            으로 계산할게.
          </p>
          <p className="text-xs text-[color:var(--muted)] tabular-nums">
            세전 시급 {formatWon(grossWage)} · 월 209시간 기준
          </p>
          <p className="text-xs text-[color:var(--muted)] tabular-nums">
            실수령 연봉 {formatWon(net.net)} (공제 {formatWon(net.socialInsurance + net.tax)})
          </p>
        </div>
      )}

      <p className="text-xs text-[color:var(--muted)]">
        실수령액은 1인 가구·비과세 수당 없음 기준 추정치야.
        {broke ? " 수입 없음은 이 기기에만 저장돼." : " 연봉은 이 기기에만 저장돼."}
      </p>

      <button className="btn-primary" disabled={!valid} onClick={onNext}>
        다음
      </button>
    </section>
  );
}

function SearchStep({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (ticker: Ticker) => void;
}) {
  const [query, setQuery] = useState("");
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setTickers(await searchTickers(query, controller.signal));
      } catch {
        // 취소되었거나 서버가 죽은 경우 — 목록을 그대로 둔다.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // 검색어가 비면 인기 종목이 흘러가고, 한 글자라도 치면 멈추고 결과만 보여준다.
  // `query`로 판단하는 건 의도적이다 — 디바운스가 끝나기를 기다리면 이미 검색 중인데
  // 목록이 계속 굴러간다.
  const rolling = query.trim() === "";

  return (
    // min-h-0이 없으면 목록이 화면 밖으로 자란다 — flex 자식은 기본이 min-height:auto라
    // 안쪽 내용(20종목 × 2벌)만큼 부풀고 flex-1이 줄이지를 못한다.
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">어떤 종목을 샀어?</span>
        <input
          className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 outline-none"
          placeholder="종목명 또는 종목코드"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {rolling ? (
        <>
          <span className="text-xs text-[color:var(--muted)]">인기 종목</span>
          <PopularRoller tickers={tickers} onSelect={onSelect} />
        </>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-[color:var(--line)] overflow-y-auto">
          {tickers.map((ticker) => (
            <li key={ticker.symbol}>
              <TickerRow ticker={ticker} onSelect={() => onSelect(ticker)} />
            </li>
          ))}
          {tickers.length === 0 && (
            // 미지원 종목(해외 주식·ETF 등)은 KRX 국내 마스터에 아예 없어 검색에 안 잡힌다.
            // 오타와 구분할 방법이 없으니, 없을 때는 지원 범위를 알려주는 문구로 대신한다.
            <li className="px-4 py-6 text-center text-sm leading-relaxed text-[color:var(--muted)]">
              찾는 종목이 없어.
              <br />
              지금은 <strong className="text-[color:var(--fg)]">국내 주식</strong>만 지원해 —
              해외 주식·ETF는 아직이야.
            </li>
          )}
        </ul>
      )}

      <button className="btn-ghost" onClick={onBack}>
        연봉 다시 입력
      </button>
    </section>
  );
}

function TickerRow({ ticker, onSelect }: { ticker: Ticker; onSelect: () => void }) {
  return (
    <button
      className="flex w-full items-center gap-3 py-2.5 text-left"
      onClick={onSelect}
    >
      <TickerLogo ticker={ticker} />
      <span className="min-w-0 flex-1 truncate font-medium">{ticker.name}</span>
      <span className="shrink-0 text-xs text-[color:var(--muted)] tabular-nums">
        {ticker.symbol} · {ticker.market}
      </span>
    </button>
  );
}

/** 한 줄이 지나가는 데 걸리는 시간(초). 종목 수와 무관하게 속도가 일정해진다. */
const ROLL_SECONDS_PER_ROW = 1.6;

/**
 * 검색어가 비었을 때 위로 흘러가는 인기 종목.
 *
 * 같은 목록을 두 벌 쌓고 한 벌 높이만큼 올려 이음매를 감춘다 — 그래서 사본에는
 * `inert`를 걸어 탭 순서와 스크린리더에서 빼둔다. 안 그러면 같은 종목이 두 번 읽힌다.
 *
 * "인기"는 지금 목 엔진이 빈 검색어에 돌려주는 순서(시총 순)를 그대로 믿는 것이다.
 * 실제 시세 API를 붙일 때 거래대금·조회수 순으로 정렬해 내려주면 화면은 그대로 둔다.
 */
function PopularRoller({
  tickers,
  onSelect,
}: {
  tickers: Ticker[];
  onSelect: (ticker: Ticker) => void;
}) {
  if (tickers.length === 0) return <div className="min-h-0 flex-1" />;

  const rows = (copy: boolean) => (
    <ul className={copy ? "ticker-roll-copy" : undefined} inert={copy}>
      {tickers.map((ticker) => (
        <li key={ticker.symbol}>
          <TickerRow ticker={ticker} onSelect={() => onSelect(ticker)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className="ticker-roll min-h-0 flex-1"
      style={
        {
          "--ticker-roll-duration": `${tickers.length * ROLL_SECONDS_PER_ROW}s`,
        } as CSSProperties
      }
    >
      <div className="ticker-roll-track">
        {rows(false)}
        {rows(true)}
      </div>
    </div>
  );
}

/**
 * 피커에 올릴 수량. 1~20주는 한 주 단위로, 그 위로는 자릿수에 맞춰 성글게 벌린다.
 * 목록에 없는 수량을 가진 사람이 막히지 않도록 마지막에 직접 입력을 남겨둔다.
 */
const QUANTITY_OPTIONS = [
  ...Array.from({ length: 20 }, (_, index) => index + 1),
  25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
  100, 150, 200, 300, 400, 500, 700,
  1000, 1500, 2000, 3000, 5000, 10000,
];

const CUSTOM_QUANTITY = "custom";

/**
 * 평단가 입력과 수량 피커가 나란히 서므로 높이를 못으로 박아둔다.
 * 패딩으로만 잡으면 글자 크기가 다른 둘(text-lg / text-base)이 서로 다른 높이가 되고,
 * `<select>`는 브라우저 기본 스타일이 더해져 또 어긋난다.
 */
const FIELD_CLASS =
  "h-[3.25rem] w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] font-semibold tabular-nums outline-none";

function PositionStep({
  ticker,
  onBack,
  onSubmit,
}: {
  ticker: Ticker;
  onBack: () => void;
  onSubmit: (avgPrice: number, quantity: number) => void;
}) {
  const [avgPriceInput, setAvgPriceInput] = useState("");
  const [quantitySelect, setQuantitySelect] = useState("10");
  const [customQuantity, setCustomQuantity] = useState("");

  // 전일 종가를 보여주려고 여기서도 시세를 문다. 현재가는 아직 안 쓴다 —
  // 평단가를 적기도 전에 손익을 흘리면 봉 없는 대기 화면과 어긋난다.
  const previousClose = useQuote(ticker.symbol)?.previousClose ?? null;

  const custom = quantitySelect === CUSTOM_QUANTITY;
  const avgPrice = parseNumericInput(avgPriceInput);
  const quantity = Math.floor(
    parseNumericInput(custom ? customQuantity : quantitySelect),
  );
  const costBasis = useMemo(() => avgPrice * quantity, [avgPrice, quantity]);
  const valid = avgPrice > 0 && quantity > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="text-lg font-bold">{ticker.name}</span>
        <span className="text-sm text-[color:var(--muted)]">평단이 어떻게 돼? 몇 주나 산 거지?</span>
      </header>

      {/*
        입력 묶음과 버튼은 아래에 붙여두고, 남는 공간은 전부 무대가 가져간다 —
        화면이 클수록 개미가 서성일 자리가 넓어진다.
      */}
      <section className="my-5 flex min-h-0 flex-1 flex-col">
        {/* 아직 손익이 없으니 봉은 없고 개미만 서성인다. */}
        <CandleScene seconds={0} mood="even" stage={BREAKEVEN_STAGE} mode="waiting" fill />
      </section>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-[8] flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">평단가 (원)</span>
          <input
            className={`${FIELD_CLASS} px-4 text-lg`}
            inputMode="numeric"
            /* 시세가 오기 전 한순간만 쓰이는 자릿수 힌트다. */
            placeholder={
              previousClose === null
                ? "74,800"
                : formatNumericInput(String(Math.round(previousClose)))
            }
            autoFocus
            value={avgPriceInput}
            onChange={(event) => setAvgPriceInput(formatNumericInput(event.target.value))}
          />
        </label>

        <label className="flex min-w-0 flex-[2] flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">수량 (주)</span>
          {custom ? (
            <input
              className={`${FIELD_CLASS} px-2 text-center text-base`}
              inputMode="numeric"
              placeholder="주"
              autoFocus
              value={customQuantity}
              onChange={(event) => setCustomQuantity(formatNumericInput(event.target.value))}
              onBlur={() => {
                if (parseNumericInput(customQuantity) <= 0) setQuantitySelect("10");
              }}
            />
          ) : (
            <select
              className={`${FIELD_CLASS} px-2 text-center text-base`}
              value={quantitySelect}
              onChange={(event) => setQuantitySelect(event.target.value)}
            >
              {/* 값은 숫자 그대로 두고 보이는 글자만 묶는다 — 옆 칸 입력과 표기를 맞춘다. */}
              {QUANTITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatNumericInput(String(option))}
                </option>
              ))}
              <option value={CUSTOM_QUANTITY}>직접</option>
            </select>
          )}
        </label>
      </div>

      {/*
        전일 종가는 종목만 고르면 바로 뜨고, 매수 원금은 평단가와 수량이 다 차면 그
        아래 줄에 붙는다. 둘 다 "지금 적는 숫자를 가늠하는 곁줄"이다. min-h-5로 첫 줄
        높이를 미리 잡아둬, 전일 종가가 뜰 때 아래 입력·버튼이 밀리지 않게 한다.
      */}
      <p className="mt-3 min-h-5 text-sm text-[color:var(--muted)]">
        {previousClose !== null && (
          <span className="block">
            {ticker.name}의 전일 종가는{" "}
            <strong className="text-[color:var(--fg)]">{formatWon(previousClose)}</strong>
            이야.
          </span>
        )}
        {valid && (
          <span className="block">
            개미의 총 매수 원금은{" "}
            <strong className="text-[color:var(--fg)]">{formatWon(costBasis)}</strong> 정도 되는군.
          </span>
        )}
      </p>

      {/* 입력 묶음(평단가·수량·매수 원금)과 버튼 사이 간격 24px */}
      <div className="mt-6 flex gap-3">
        <button className="btn-ghost flex-1" onClick={onBack}>
          이전
        </button>
        <button
          className="btn-primary flex-[2]"
          disabled={!valid}
          onClick={() => onSubmit(avgPrice, quantity)}
        >
          입력
        </button>
      </div>
    </main>
  );
}
