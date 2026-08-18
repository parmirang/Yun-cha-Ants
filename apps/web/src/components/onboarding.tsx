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
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import {
  MAX_INPUT_MANWON,
  MAX_INPUT_WON,
  capNumericInput,
  formatNumericInput,
  formatWon,
  koreanWon,
  parseNumericInput,
} from "@/lib/format";
import { useKeyboardInset } from "@/lib/keyboard-inset";
import { useStoredState } from "@/lib/storage";
import { searchTickers } from "@/lib/tickers";
import { useQuote } from "@/lib/use-quote";
import { z } from "zod";

import { CandleScene } from "./candle-scene";
import { Hero } from "./hero";
import { NumericKeypad } from "./numeric-keypad";
import { PrivacyNoticeSheet, todayStamp } from "./privacy-notice";
import { QUANTITY_OPTIONS, QuantityPicker } from "./quantity-picker";
import { TickerLogo } from "./ticker-logo";

/**
 * 온보딩은 **종목부터 묻는다.**
 *
 * 연봉을 먼저 받으면 첫 화면이 통째로 "네 연봉 얼마야"가 된다 — 앱이 뭘 해주는지
 * 보기도 전에 제일 망설여지는 질문이 문 앞을 막는 셈이라 거기서 되돌아 나간다.
 * 종목을 고르고 평단을 적는 동안은 내 얘기를 하는 게 아니라서 손이 가볍고, 그
 * 끝에서 묻는 연봉은 "이것만 넣으면 결과가 나온다"가 된다.
 */
type Step = "search" | "position" | "salary";

/**
 * 평단가 화면이 받아둔 입력 그대로.
 *
 * **화면 안이 아니라 여기(온보딩)에 둔다.** 평단가 뒤에 연봉 화면이 붙어서, 거기서
 * "이전"을 누르면 평단가 화면이 다시 마운트된다 — 값을 화면 안 `useState`에 두면
 * 그때 방금 친 평단가와 수량이 통째로 날아간다.
 */
interface PositionDraft {
  /** 입력칸에 적힌 그대로 (쉼표 포함) */
  price: string;
  /** 수량 시트가 돌려준 값. 직접입력이면 소수점 문자열("3.5")일 수도 있다. */
  quantity: string;
  /** 수량을 한 번이라도 골랐나 — 확인 키가 다음 화면으로 넘어가는 기준. */
  picked: boolean;
  /**
   * 전일 종가를 평단가 자리에 **한 번** 앉혔나.
   *
   * 시세는 화면이 뜨고 나서 도착하므로 기본값도 그때 넣어야 하는데, 그걸 매번 넣으면
   * 사용자가 지운 칸을 도로 채우고 손으로 친 평단가를 덮어쓴다.
   */
  seeded: boolean;
}

const EMPTY_DRAFT: PositionDraft = {
  price: "",
  quantity: "10",
  picked: false,
  seeded: false,
};

/**
 * 적힌 문자열을 실제 숫자로. 평단가 화면과 마지막 제출이 **같은 함수**를 봐야
 * 화면이 "다음"을 열어줬는데 저장은 0주로 되는 일이 안 생긴다.
 *
 * 수량은 버리지도 반올림하지도 않는다 — 직접입력이 소수점 수량(0.5주)을 받는다.
 */
function draftValues(draft: PositionDraft) {
  const avgPrice = parseNumericInput(draft.price);
  const quantity = parseNumericInput(draft.quantity);

  return { avgPrice, quantity, valid: avgPrice > 0 && quantity > 0 };
}

/**
 * 슬라이더를 한 번 밀 때 움직이는 폭. 500칸 언저리를 1·2·5·10… 꼴로 맞춰 **떨어지는
 * 숫자**만 나오게 한다 — 안 맞추면 픽셀마다 74,321원 같은 값이 칸에 적힌다.
 */
function sliderStep(max: number): number {
  const raw = max / 500;
  if (!(raw > 0)) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const rounded = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return Math.max(1, rounded * magnitude);
}

/**
 * 평단가를 좌우로 밀어 잡는 자. 범위는 **0 ~ 전일 종가의 2배**이고 한가운데 눈금이
 * 곧 종가 = 본전이다 — 왼쪽으로 밀수록 싸게 산 것, 오른쪽으로 밀수록 비싸게 산 것.
 *
 * **색은 중립(`--fg`)이다.** 여기는 아직 손익이 없는 대기 화면이라(봉도 안 그린다)
 * 빨강/파랑을 칠하면 평단가를 적기도 전에 손익을 흘리게 된다.
 *
 * 종가의 2배를 넘는 평단가는 **막지 않고 그냥 못 닿을 뿐이다** — 키패드로 친 값이
 * 범위 밖이면 손잡이만 끝에 서고 칸의 값은 그대로 둔다 (여기서 되돌려 쓰면 반토막
 * 난 종목의 평단가가 사용자 몰래 깎인다). 그래서 아래에 안내 한 줄을 붙인다.
 *
 * 시세가 아직 안 왔으면 잡을 범위가 없어 자리만 지킨다 — 통째로 빼면 종가가 도착하는
 * 순간 아래 내용이 밀려 올라간다.
 */
function PriceSlider({
  value,
  previousClose,
  onChange,
}: {
  value: number;
  previousClose: number | null;
  onChange: (value: number) => void;
}) {
  // 종가가 오기 전에도 같은 높이를 차지한다 (트랙 2.5rem + 라벨 줄 + 안내 줄).
  if (previousClose === null) return <div className="mt-2 h-[5.75rem]" aria-hidden />;

  const max = Math.max(1, Math.round(previousClose * 2));
  const step = sliderStep(max);
  const ratio = Math.min(1, Math.max(0, value / max));

  return (
    <div className="mt-2">
      <div className="relative">
        {/* 한가운데 눈금 = 전일 종가 = 본전. */}
        <span className="price-slider-mid" aria-hidden />
        <input
          type="range"
          className="price-slider"
          aria-label="평단가 밀어서 고르기"
          min={0}
          max={max}
          /*
           * step은 1로 두고 반올림은 onChange에서 한다. `step={step}`으로 두면 키패드로
           * 친 74,800이 브라우저에서 75,000으로 **되돌려 써져** 방금 친 값이 바뀐다.
           */
          step={1}
          value={Math.min(value, max)}
          style={{ "--fill": `${ratio * 100}%` } as CSSProperties}
          onChange={(event) => onChange(Math.round(Number(event.target.value) / step) * step)}
        />
      </div>

      <div className="grid grid-cols-3 text-xs text-[color:var(--muted)] tabular-nums">
        <span>0</span>
        <span className="text-center">본전</span>
        <span className="text-right">{formatWon(max)}</span>
      </div>

      <p className="mt-1.5 text-xs text-[color:var(--muted)]">
        범위를 벗어나는 금액은 직접 입력해줘.
      </p>
    </div>
  );
}

/**
 * 온보딩을 끝내는 문에 적히는 글자. 아래 버튼과 키패드 확인 키가 **같은 말을 해야
 * 한다** — 자리가 둘이어도 지금 할 일은 하나다.
 */
const CONFIRM_LABEL = "본전 계산 🐜";

/** "오늘 다시 보지 않음"을 체크한 날의 도장 (todayStamp). 다른 날이 되면 다시 뜬다. */
const privacyNoticeHiddenSchema = z.string();

export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: Profile, position: Position) => void;
}) {
  const [step, setStep] = useState<Step>("search");
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [draft, setDraft] = useState<PositionDraft>(EMPTY_DRAFT);
  const [salaryManwon, setSalaryManwon] = useState("");
  const [broke, setBroke] = useState(false);

  // 숫자 입력은 커스텀 키패드로 받으므로, 네이티브 키보드가 뜨는 건 종목 검색뿐이다 —
  // 글자 키보드가 화면을 가린 만큼 아래를 늘려(.kb-pad) 굴릴 자리를 만든다.
  useKeyboardInset();

  /*
   * 들어올 때마다 뜨는 개인정보 안내. **아무것도 묻기 전에** "어디로도 안 나간다"부터
   * 답한다 — 첫 화면이 종목 검색으로 바뀐 뒤에도 자리는 그대로다. 연봉 화면까지 미루면
   * 정작 제일 망설여지는 칸 앞에서 처음 보게 되어, 답이 아니라 경고처럼 읽힌다.
   * "오늘 다시 보지 않음"을 체크하고 닫은 날짜가 기기에 남고, 그날 하루는 다시 안 뜬다.
   */
  const [noticeHiddenDate, setNoticeHiddenDate, noticeLoaded] = useStoredState(
    "yca.privacyNoticeHiddenDate",
    privacyNoticeHiddenSchema,
    "",
  );
  // 이번 화면에서 이미 닫았나 — 체크 없이 닫아도 같은 세션에서 또 뜨진 않는다.
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // 입력은 세전 연봉이고, 저장·계산에 쓰이는 시급은 실수령 기준이다.
  // 무일푼은 연봉 0으로 저장한다 — 환산은 shared가 최저임금으로 대신 처리한다.
  const annualSalary = broke ? 0 : parseNumericInput(salaryManwon) * 10_000;

  // 평단가 입력은 결과 화면과 같은 무대 위에서 받는다 — 대문 없이 전체를 쓴다.
  if (step === "position" && ticker) {
    return (
      <PositionStep
        ticker={ticker}
        draft={draft}
        onDraftChange={setDraft}
        onBack={() => setStep("search")}
        onNext={() => setStep("salary")}
      />
    );
  }

  // 검색 단계만 h-dvh다. 목록이 남는 높이를 채우고 넘치는 만큼 잘리려면 위쪽에
  // **확정된 높이**가 있어야 한다 — min-h-dvh는 아래로 열려 있어서 flex-1도 min-h-0도
  // 목록을 못 줄이고, 목록이 그대로 화면 밖으로 자란다.
  // 연봉 단계는 내용이 길어지면 스크롤돼야 하므로 min-h-dvh 그대로 둔다.
  const frame = step === "search" ? "h-dvh" : "min-h-dvh";

  return (
    <main className={`kb-pad mx-auto flex w-full max-w-md flex-col px-6 pt-10 [--kb-pad-base:20px] ${frame}`}>
      {step === "search" && (
        <>
          {/*
            대문은 **첫 화면에만** 선다. 검색 단계가 그 첫 화면이 됐으므로 여기 하나뿐이고,
            결과 목록이 남는 공간을 다 써야 하니 위에 붙여둔다. 연봉 단계는 이제 흐름
            한가운데라 대문 대신 종목 이름을 머리에 인다 — 거기서 또 대문을 띄우면 다 온
            사람을 문 앞으로 되돌려놓는 꼴이다.
          */}
          <Hero className="mb-8" />
          <SearchStep
            onSelect={(selected) => {
              track("ticker_select", {
                ticker_symbol: selected.symbol,
                ticker_name: selected.name,
              });
              /*
               * **종목이 바뀌면 초안을 비운다.** 입력값이 화면 밖(여기)에 살아 있어서,
               * 안 비우면 삼성전자에 적은 74,800이 카카오 화면에 그대로 떠 있는다.
               * 같은 종목으로 되돌아온 거라면 적던 값을 그대로 둔다.
               */
              if (selected.symbol !== ticker?.symbol) setDraft(EMPTY_DRAFT);
              setTicker(selected);
              setStep("position");
            }}
          />
        </>
      )}

      {step === "salary" && ticker && (
        <SalaryStep
          tickerName={ticker.name}
          value={salaryManwon}
          annualSalary={annualSalary}
          broke={broke}
          onChange={setSalaryManwon}
          onBrokeChange={setBroke}
          onBack={() => setStep("position")}
          onNext={() => {
            const { avgPrice, quantity, valid } = draftValues(draft);
            // 평단가 화면이 안 열어주면 여기까지 못 오지만, 저장이 마지막 문이라 한 번 더 막는다.
            if (!valid) return;

            // 금액은 안 보낸다 — 적었는지 무일푼을 골랐는지만 남긴다.
            track("salary_submit", { salary_kind: broke ? "broke" : "entered" });
            // 연봉이 마지막 단계라 온보딩 전환도 여기서 찍힌다.
            // 평단가·수량·금액은 안 보낸다 — 종목과 "여기까지 왔다"만 남긴다.
            track("onboarding_complete", {
              ticker_symbol: ticker.symbol,
              ticker_name: ticker.name,
            });
            onComplete(
              { annualSalary },
              { symbol: ticker.symbol, name: ticker.name, avgPrice, quantity },
            );
          }}
        />
      )}

      {/* localStorage를 읽기 전(noticeLoaded 전)에 그리면 오늘 숨긴 사람에게도 깜빡 뜬다. */}
      {noticeLoaded && !noticeDismissed && noticeHiddenDate !== todayStamp() && (
        <PrivacyNoticeSheet
          onClose={(hideToday) => {
            if (hideToday) setNoticeHiddenDate(todayStamp());
            setNoticeDismissed(true);
          }}
        />
      )}
    </main>
  );
}

function SalaryStep({
  tickerName,
  value,
  annualSalary,
  broke,
  onChange,
  onBrokeChange,
  onBack,
  onNext,
}: {
  /** 머리에 이는 종목 이름 — 여기까지 온 사람이 무엇 때문에 연봉을 적는지 잇는다. */
  tickerName: string;
  value: string;
  annualSalary: number;
  broke: boolean;
  onChange: (value: string) => void;
  onBrokeChange: (broke: boolean) => void;
  onBack: () => void;
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
  // 무일푼이면 입력칸이 비므로 읽어줄 것도 없다 (annualSalary가 아니라 basis를 쓰면
  // 최저임금 연봉이 안 적은 칸 옆에 적힌다).
  const reading = broke ? "" : koreanWon(annualSalary);

  // 커스텀 키패드의 여닫음. 칸을 누르면 열리고, ▾·무일푼 체크·제출이 닫는다.
  const [keypadOpen, setKeypadOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 키패드가 뜰 때 가려지면 안 되는 묶음 — 입력칸과 한글 읽기.
  const fieldRef = useRef<HTMLLabelElement>(null);

  const closeKeypad = () => {
    // 포커스도 거둬야 다음에 칸을 눌렀을 때 focus 이벤트가 와서 키패드가 다시 열린다.
    inputRef.current?.blur();
    setKeypadOpen(false);
  };

  return (
    <>
      {/*
        평단가 화면과 같은 모양의 머리 — 종목 이름을 이고 지금 묻는 걸 한 줄로 적는다.
        연봉이 마지막 단계가 되면서 이 화면은 흐름 한가운데가 됐고, 여기서 대문을
        띄우면 다 온 사람을 문 앞으로 되돌려놓는 것처럼 보인다.
      */}
      <header className="mb-8 flex flex-col items-center gap-1 text-center">
        <span className="text-lg font-bold">{tickerName}</span>
        <span className="text-sm text-[color:var(--muted)]">
          마지막이야. 네 시급을 알아야 시간으로 바꿔줄 수 있어.
        </span>
      </header>

      {/* 높이를 늘려 잡지 않는다 — 내용이 길어지면 아래로 흐르고 화면이 스크롤된다.
          form인 건 **엔터로도 넘어가게** 하기 위해서다. */}
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onNext();
        }}
      >
        <label ref={fieldRef} className="flex flex-col gap-2">
          <span className="text-sm font-medium">개미야, 너 얼마나 벌어?</span>
          <div
            className={`flex items-center gap-2 rounded-xl border bg-[color:var(--surface)] px-4 py-3 has-disabled:opacity-40 ${
              keypadOpen ? "keypad-target" : "border-[color:var(--line)]"
            }`}
          >
            <input
              ref={inputRef}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none"
              /* 네이티브 키보드를 안 부른다 — 아래 커스텀 키패드가 대신한다. */
              inputMode="none"
              placeholder="4,000"
              value={broke ? "" : value}
              disabled={broke}
              onFocus={() => setKeypadOpen(true)}
              /* ▾로 접은 뒤 다시 누르면 포커스가 그대로라 focus가 안 온다 — 클릭으로도 연다. */
              onClick={() => setKeypadOpen(true)}
              /*
               * 만원 단위라 상한도 만원으로 환산해 씌운다 (100억 = 1,000,000만원).
               * 자릿수를 안 막으면 "12000000"(1,200억) 같은 값이 들어와 시급 2,299만원짜리
               * 결과가 멀쩡한 얼굴로 나온다 — 계산이 틀린 게 아니라 입력이 말이 안 되는 것이다.
               * `<input maxLength>`로는 이 일을 못 한다 — 쉼표까지 글자 수로 세어버린다.
               */
              onChange={(event) => onChange(capNumericInput(event.target.value, MAX_INPUT_MANWON))}
            />
            {/*
              적은 값을 한글로 읽어준다 ("1,200" → 천이백만원). 만원 단위 입력이라 한 자리만
              밀려도 열 배가 어긋나는데, 숫자만 보고는 그걸 알아채기 어렵다.

              비어 있을 때만 "만원"이 뜬다 — 적고 나면 읽기가 그 자리를 대신한다.
              둘을 같이 두면 "천이백만원 만원"이 된다. 읽기가 이미 원으로 끝나므로
              단위는 그대로 읽힌다.
            */}
            <span className="min-w-0 shrink truncate text-sm text-[color:var(--muted)]">
              {reading || "만원"}
            </span>
          </div>
        </label>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[color:var(--up)]"
            checked={broke}
            onChange={(event) => {
              // 무일푼을 켜면 입력칸이 죽으므로 키패드도 같이 접는다.
              if (event.target.checked) closeKeypad();
              onBrokeChange(event.target.checked);
            }}
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
              단위로 넣어줘.
              <br />
              세금과 4대보험을 뺀 실수령 기준으로 시급을 계산할게.{" "}
              <strong className="text-[color:var(--fg)]">걱정마. 이 정보는 절대 공유되지 않아.</strong>
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

        {/*
          평단가 화면과 같은 버튼줄 — 이제 여기가 마지막이라 결과로 들어가는 문이 이
          자리에 있다. **"이전"에 type을 반드시 적는다**: 안 적으면 submit이 기본값이라
          엔터가 확인이 아니라 이쪽으로 새서 평단가 화면으로 되돌아간다.
        */}
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" type="button" onClick={onBack}>
            이전
          </button>
          <button className="btn-primary flex-[2]" type="submit" disabled={!valid}>
            {CONFIRM_LABEL}
          </button>
        </div>

        {keypadOpen && (
          <>
            {/* 키패드가 화면 끝을 덮는 만큼 비워둔다 — 위 안내·버튼을 굴려 볼 자리. */}
            <div className="keypad-space" aria-hidden />
            <NumericKeypad
              value={value}
              onChange={(draft) => onChange(capNumericInput(draft, MAX_INPUT_MANWON))}
              submitLabel={CONFIRM_LABEL}
              submitDisabled={!valid}
              onSubmit={() => {
                if (valid) onNext();
              }}
              onDismiss={closeKeypad}
              revealRef={fieldRef}
            />
          </>
        )}
        </form>
    </>
  );
}

function SearchStep({ onSelect }: { onSelect: (ticker: Ticker) => void }) {
  const [query, setQuery] = useState("");
  const [tickers, setTickers] = useState<Ticker[]>([]);
  // 검색 결과 0건과 **서버 불통**을 화면에서 구분하기 위한 플래그.
  // 없으면 서버가 죽어도 "국내 주식만 지원해"로 보여 오해를 준다.
  const [failed, setFailed] = useState(false);
  // 다시 시도 버튼이 올리는 값. 검색어가 그대로여도 이게 바뀌면 아래 효과가 다시 돈다.
  const [retry, setRetry] = useState(0);
  const [retrying, setRetrying] = useState(false);
  /*
   * 아직 대답을 못 받았다.
   *
   * **이게 없으면 기다리는 동안이 "결과 없음"으로 보인다.** Render 무료 API는 15분
   * 무요청이면 잠들고 깨는 데 1분쯤 걸리는데, 그때 인기 종목 자리는 통째로 비고
   * ("주식 목록이 안 보인다") 검색어를 친 사람에게는 **"찾는 종목이 없어 · 국내
   * 주식만 지원해"가 뜬다** — 삼성전자를 못 찾는다고 거짓말을 하는 셈이라, 사용자는
   * 기다리는 대신 앱을 닫는다.
   */
  const [loading, setLoading] = useState(true);
  /** 오래 걸리는 중. 왜 오래 걸리는지 말해줘야 기다릴 마음이 든다. */
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setWaking(false);

    const wakingTimer = setTimeout(() => setWaking(true), 3_500);
    const timer = setTimeout(async () => {
      try {
        setTickers(await searchTickers(query, controller.signal));
        setFailed(false);
      } catch {
        // 키를 칠 때마다 이전 요청을 abort하는데, 그 취소는 실패가 아니다 — 무시한다.
        // 서버가 죽어 fetch가 거부된 경우만 실패로 표시한다.
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        // 취소된 요청은 아무것도 끄지 않는다 — 뒤이어 뜬 효과가 이미 켜놨다.
        if (!controller.signal.aborted) {
          setRetrying(false);
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(wakingTimer);
    };
  }, [query, retry]);

  // 결과가 0건인 검색어만 GA로 남긴다 — 오타와 미지원 종목(해외 주식·ETF)이 여기
  // 섞여 들어오고, 그게 "무엇을 더 지원해야 하나"의 유일한 단서다.
  // 결과가 멎고 1.2초를 더 기다리는 건 한 글자씩 칠 때마다 찍히는 걸 막기 위해서다
  // ("삼성전자"를 치면 "삼"·"삼성"·"삼성전"이 전부 0건 구간을 지나간다).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || tickers.length > 0) return;

    const timer = setTimeout(() => {
      track("ticker_search_miss", { search_term: term });
    }, 1_200);

    return () => clearTimeout(timer);
  }, [query, tickers]);

  // 검색어가 비면 인기 종목이 흘러가고, 한 글자라도 치면 멈추고 결과만 보여준다.
  // `query`로 판단하는 건 의도적이다 — 디바운스가 끝나기를 기다리면 이미 검색 중인데
  // 목록이 계속 굴러간다.
  const rolling = query.trim() === "";

  /*
   * 보여줄 게 아직 없는 채로 기다리는 중. **이 상태를 따로 두지 않으면 기다림이
   * "없음"으로 보인다** (위 `loading` 주석 참고).
   *
   * 목록이 이미 있으면 기다리는 티를 안 낸다 — 한 글자 칠 때마다 화면이 "불러오는
   * 중"으로 깜빡이면 결과를 눈으로 좇을 수가 없다. 옛 결과를 두고 조용히 갈아끼운다.
   */
  const pending = loading && tickers.length === 0;

  return (
    // min-h-0이 없으면 목록이 화면 밖으로 자란다 — flex 자식은 기본이 min-height:auto라
    // 안쪽 내용(20종목 × 2벌)만큼 부풀고 flex-1이 줄이지를 못한다.
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {/*
        여기는 글자 키보드라 엔터 키가 있다. 누르면 **맨 위 결과**를 고른다 — 검색 결과가
        키보드에 가려 안 보일 때 손가락으로 짚는 대신 엔터로 끝낼 수 있다.
        검색어가 비어 있을 때(인기 종목이 흘러갈 때)는 아무 일도 안 한다 — 굴러가는
        목록의 "맨 위"는 누르는 순간마다 달라서, 뭘 고른 건지 알 수 없다.
      */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const first = tickers[0];
          if (!rolling && first) onSelect(first);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">어떤 종목을 샀어?</span>
          <input
            className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 outline-none"
            placeholder="종목명 또는 종목코드"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </form>

      {rolling ? (
        <>
          <span className="text-xs text-[color:var(--muted)]">인기 종목</span>
          {pending ? (
            // 여기가 비어 있던 자리다 — 잠든 API가 깨는 1분 동안 "인기 종목" 라벨만
            // 덩그러니 남아, 목록이 없는 앱으로 보였다.
            <WaitingNote waking={waking} className="min-h-0 flex-1" />
          ) : failed && tickers.length === 0 ? (
            // 서버가 죽어 인기 종목도 못 받아온 경우 — 빈 롤러 대신 이유를 알려주고,
            // 새로고침 대신 여기서 바로 다시 부를 수 있게 한다. 배포에서는 잠들었던 API가
            // 깨는 데 시간이 걸려 첫 요청만 실패하는 일이 잦다 — 한 번 더 누르면 뜬다.
            <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
              <p className="text-sm leading-relaxed text-[color:var(--muted)]">
                종목 정보를 못 불러왔어.
                <br />
                잠시 후 다시 시도해줘.
              </p>
              <button
                className="btn-ghost px-5 py-2 text-sm"
                type="button"
                disabled={retrying}
                onClick={() => {
                  setRetrying(true);
                  setRetry((count) => count + 1);
                }}
              >
                {retrying ? "부르는 중..." : "다시 시도"}
              </button>
            </div>
          ) : (
            <PopularRoller tickers={tickers} onSelect={onSelect} />
          )}
        </>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-[color:var(--line)] overflow-y-auto">
          {tickers.map((ticker) => (
            <li key={ticker.symbol}>
              <TickerRow ticker={ticker} onSelect={() => onSelect(ticker)} />
            </li>
          ))}
          {tickers.length === 0 &&
            (pending ? (
              // **여기서 "찾는 종목이 없어"가 뜨면 거짓말이 된다.** 아직 안 물어봤을
              // 뿐인데 삼성전자를 못 찾는다고 말하는 셈이라, 사용자는 기다리는 대신
              // 지원 안 하는 앱이라고 판단하고 나간다.
              <li>
                <WaitingNote waking={waking} />
              </li>
            ) : failed ? (
              // 서버 불통 — 미지원 종목과 헷갈리지 않게 "다시 시도" 쪽으로 안내한다.
              <li className="px-4 py-6 text-center text-sm leading-relaxed text-[color:var(--muted)]">
                종목 정보를 못 불러왔어.
                <br />
                잠시 후 다시 시도해줘.
              </li>
            ) : (
              // 미지원 종목(해외 주식·ETF 등)은 KRX 국내 마스터에 아예 없어 검색에 안 잡힌다.
              // 오타와 구분할 방법이 없으니, 없을 때는 지원 범위를 알려주는 문구로 대신한다.
              <li className="px-4 py-6 text-center text-sm leading-relaxed text-[color:var(--muted)]">
                찾는 종목이 없어.
                <br />
                지금은 <strong className="text-[color:var(--fg)]">국내 주식</strong>만 지원해 —
                해외 주식·ETF는 아직이야.
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 대답을 기다리는 동안 그 자리를 지키는 한 줄.
 *
 * **비워두면 "없음"으로 읽힌다.** 인기 종목 자리가 비면 목록이 없는 앱처럼 보이고,
 * 검색 결과 자리가 비면 "찾는 종목이 없어"가 대신 뜬다 — 둘 다 서버가 대답하기 전일
 * 뿐인데 사용자에게는 결론으로 보인다.
 *
 * 오래 걸리면 **왜 오래 걸리는지** 덧붙인다. Render 무료 API는 15분 무요청이면
 * 잠들고 깨는 데 1분쯤 걸리는데(CLAUDE.md의 배포 문단), 그걸 안 적으면 고장으로
 * 읽혀서 기다릴 이유가 사라진다.
 */
function WaitingNote({ waking, className }: { waking: boolean; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 px-4 py-6 text-center ${className ?? ""}`}
    >
      <p className="text-sm text-[color:var(--muted)]">종목 데려오는 중..</p>
      {waking && (
        <p className="text-xs leading-relaxed text-[color:var(--muted)] opacity-70">
          서버가 자고 있었나 봐. 깨우는 데 1분쯤 걸려 — 조금만 기다려줘.
        </p>
      )}
    </div>
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowCount = tickers.length;

  /*
   * 굴리는 방식이 **transform이 아니라 스크롤**이다. 손으로 밀 수 있어야 하는데,
   * transform으로 올리면 스크롤할 게 없어서 손가락이 목록을 통과해 페이지를 민다.
   * scrollTop을 매 프레임 조금씩 밀면 굴러가는 모습은 같고, 손으로 미는 건 브라우저의
   * 기본 스크롤이 그대로 해준다 — 관성도 튕김도 공짜로 따라온다.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || rowCount === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /** 손이 닿은 뒤 이만큼 조용하면 다시 굴러간다. */
    const RESUME_DELAY_MS = 2500;

    let frame = 0;
    let previous = 0;
    let holdUntil = 0;
    /*
     * 굴러간 거리를 **여기에** 소수점째로 쌓는다. `scrollTop`을 읽어 더하면 안 된다 —
     * 브라우저가 정수로 반올림해 돌려주므로 한 프레임치(60fps에서 0.6px, 120fps에서는
     * 0.3px)가 매번 0으로 깎여 목록이 영영 안 움직인다.
     */
    let offset = viewport.scrollTop;
    // 우리가 마지막으로 써넣은 값(반올림된 실제 값). scrollTop이 이것과 어긋나면 손으로 민 것이다.
    let written = viewport.scrollTop;

    const hold = () => {
      holdUntil = performance.now() + RESUME_DELAY_MS;
    };

    const step = (now: number) => {
      frame = requestAnimationFrame(step);

      const elapsed = previous ? (now - previous) / 1000 : 0;
      previous = now;
      if (now < holdUntil) return;

      // 같은 목록이 두 벌이라 절반을 지나면 처음으로 되감는다 — 이음매가 안 보인다.
      const half = viewport.scrollHeight / 2;
      if (half <= 0) return;

      offset += (half / (rowCount * ROLL_SECONDS_PER_ROW)) * elapsed;
      if (offset >= half) offset -= half;

      viewport.scrollTop = offset;
      written = viewport.scrollTop;
    };

    const onScroll = () => {
      if (Math.abs(viewport.scrollTop - written) > 2) {
        hold();
        // 손이 옮겨놓은 자리에서 이어 굴린다.
        offset = viewport.scrollTop;
      }

      // 손으로 끝까지 밀어도 이어지도록 여기서도 되감는다. 위쪽(0)은 안 감는다 —
      // 손가락이 당기고 있는 중에 값을 되돌리면 드래그와 싸운다.
      const half = viewport.scrollHeight / 2;
      if (half > 0 && viewport.scrollTop >= half) {
        viewport.scrollTop -= half;
        offset = viewport.scrollTop;
      }

      written = viewport.scrollTop;
    };

    // 스크롤이 시작되기 전에 손이 닿은 것부터 멈춘다 — 흘러가는 줄은 누르기 어렵다.
    viewport.addEventListener("pointerdown", hold);
    viewport.addEventListener("wheel", hold, { passive: true });
    viewport.addEventListener("scroll", onScroll, { passive: true });
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("pointerdown", hold);
      viewport.removeEventListener("wheel", hold);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [rowCount]);

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
    <div ref={viewportRef} className="ticker-roll min-h-0 flex-1">
      <div>
        {rows(false)}
        {rows(true)}
      </div>
    </div>
  );
}

/**
 * 평단가 입력과 수량 피커가 나란히 서므로 높이를 못으로 박아둔다.
 * 패딩으로만 잡으면 글자 크기가 다른 둘(text-lg / text-base)이 서로 다른 높이가 되고,
 * `<select>`는 브라우저 기본 스타일이 더해져 또 어긋난다.
 */
const FIELD_CLASS =
  "h-[3.25rem] w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] font-semibold tabular-nums outline-none";

function PositionStep({
  ticker,
  draft,
  onDraftChange,
  onBack,
  onNext,
}: {
  ticker: Ticker;
  draft: PositionDraft;
  onDraftChange: (draft: PositionDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  /*
   * 입력값은 **바깥이 쥔다** — 뒤에 연봉 화면이 붙어서, 거기서 "이전"으로 돌아오면
   * 이 화면이 다시 마운트된다. 여기에 useState로 두면 방금 친 평단가가 날아간다.
   *
   * `picked`: 수량을 한 번이라도 골랐나. 확인 키가 수량 시트를 여는 데서 다음 화면으로
   * 넘어가는 데로 바뀌는 기준이다. 수량 칸에는 처음부터 "10"이 적혀 있어서, 이걸 안
   * 두면 **아무도 안 고른 10주가 조용히 확정된다.** 반대로 한 번 고르고 나서 평단가를
   * 고치러 돌아왔을 때 또 물으면 이미 답한 걸 되묻는 꼴이라, 그때는 바로 넘어간다.
   */
  const { price: avgPriceInput, quantity: quantitySelect, picked: quantityPicked } = draft;
  const patch = (next: Partial<PositionDraft>) => onDraftChange({ ...draft, ...next });

  /*
   * 수량 시트를 **바깥에서 연다.** 이 화면은 평단가를 치고 나면 곧바로 수량을 물어야
   * 이어지는데, 시트가 제 버튼으로만 열리면 그 흐름을 만들 수가 없다.
   * 여닫힘 자체는 이 화면 안에서만 산다 — 되돌아왔을 때 시트가 다시 떠 있을 이유는 없다.
   */
  const [quantityOpen, setQuantityOpen] = useState(false);

  // 전일 종가를 보여주려고 여기서도 시세를 문다. 현재가는 아직 안 쓴다 —
  // 평단가를 적기도 전에 손익을 흘리면 봉 없는 대기 화면과 어긋난다.
  const previousClose = useQuote(ticker.symbol)?.previousClose ?? null;

  /*
   * **들어오면 평단가 자리에 전일 종가가 앉아 있다.** 슬라이더가 한가운데(=본전)에서
   * 시작해야 좌우로 밀 기준이 생긴다 — 0에서 시작하면 어느 쪽이 비싸게 산 쪽인지
   * 밀어보기 전에는 알 수 없고, 왼쪽 절반은 쓸 일이 없는 자리처럼 보인다.
   *
   * 기본값은 시세가 도착한 **첫 순간 한 번만** 넣는다 (`seeded`). 조건 없이 넣으면
   * 지운 칸이 도로 차고, 종가가 갱신될 때 손으로 친 평단가를 덮어쓴다.
   */
  useEffect(() => {
    if (draft.seeded || previousClose === null) return;

    onDraftChange({
      ...draft,
      price: formatNumericInput(String(Math.round(previousClose))),
      seeded: true,
    });
  }, [draft, previousClose, onDraftChange]);

  const { avgPrice, quantity, valid } = draftValues(draft);
  const costBasis = useMemo(() => avgPrice * quantity, [avgPrice, quantity]);

  // 직접입력으로 적은 수량(예: 3.5)은 기본 목록에 없다 — 끼워 넣어야 휠을 다시
  // 열었을 때 고른 줄이 가운데 온다.
  const quantityOptions = [
    ...new Set([...QUANTITY_OPTIONS, ...(quantity > 0 ? [quantity] : [])]),
  ].sort((a, b) => a - b);

  const priceRef = useRef<HTMLInputElement>(null);

  /*
   * 커스텀 키패드의 여닫음. 평단가 칸의 focus가 열고, 흐름(수량 시트 열기)과 ▾가
   * null로 되돌린다. 수량은 칸이 아니라 시트(휠·직접입력)가 통째로 받으므로
   * 이 키패드가 편집하는 칸은 평단가 하나뿐이다.
   */
  const [keypadTarget, setKeypadTarget] = useState<"price" | null>(null);

  // 키패드가 뜰 때 가려지면 안 되는 묶음 — 입력칸들과 곁줄(전일 종가·매수 원금).
  const fieldsRef = useRef<HTMLDivElement>(null);

  const closeKeypad = () => {
    // 포커스도 거둬야 다음에 칸을 눌렀을 때 focus 이벤트가 와서 키패드가 다시 열린다.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    setKeypadTarget(null);
  };

  /*
   * 수량 시트가 **어느 길로 열렸나** — 키패드의 "다음"으로 왔으면 시트의 [이전]이
   * 평단가 키패드를 도로 열어야 하고, 수량 칸을 직접 눌러 왔으면 페이지로 돌아가면 된다.
   */
  const quantityFromKeypad = useRef(false);

  const openQuantity = () => {
    // 키패드를 먼저 접는다 — 수량 시트도 바닥에 붙어 뜨는 물건이라 겹치면 휠이 가린다.
    closeKeypad();
    quantityFromKeypad.current = true;
    setQuantityOpen(true);
  };

  /*
   * "다 쳤다"는 신호 하나를 여기로 모은다 — 키보드 위 버튼, 아래 [입력] 버튼, 그리고
   * 엔터(하드웨어·안드로이드 숫자 키보드)가 전부 이 함수로 들어온다. 세 길이 갈라지면
   * 어느 길로 왔느냐에 따라 다른 일이 벌어진다.
   */
  const advance = () => {
    if (avgPrice <= 0) return;
    if (!quantityPicked) return openQuantity();
    if (valid) onNext();
  };

  // 아래 버튼과 키패드 확인 키가 **같은 말을 한다** — 문구는 여기 한 곳에서 정한다.
  // 수량까지 고르고 나면 **앱이 답해줄 질문**을 적는다 — 다음 화면이 묻는 게 연봉이라
  // "연봉 적기"라고만 하면 일거리를 하나 더 얹는 것처럼 읽힌다.
  const confirmLabel = quantityPicked ? "🐜 얼마나 더 일해야 할까?" : "내 평단가 입력";
  const confirmDisabled = quantityPicked ? !valid : avgPrice <= 0;

  return (
    <main className="kb-pad mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-6 [--kb-pad-base:20px]">
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

      {/*
        form인 건 **엔터로도 넘어가게** 하기 위해서다 — 입력칸은 커스텀 키패드를 쓰지만
        (inputMode="none") 하드웨어 키보드의 타이핑과 엔터는 그대로 받는다. 키패드의
        확인 키와 엔터가 같은 `advance()`로 들어오므로 어느 길로 왔든 같은 일이 일어난다.
      */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          advance();
        }}
      >
        {/* 키패드가 뜰 때 가려지면 안 되는 묶음 — 이 아래끝을 키패드 위로 굴려낸다. */}
        <div ref={fieldsRef}>
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-[8] flex-col gap-1.5">
              {/* 라벨 오른쪽에 적은 값을 한글로 읽어준다 — 평단가는 0이 여섯 개씩 붙어
                  눈으로 자릿수를 세기 어렵다 (24000과 240000이 한눈에 안 갈린다). */}
              <span className="flex items-baseline justify-between gap-2 text-xs text-[color:var(--muted)]">
                <span className="shrink-0">평단가 (원)</span>
                <span className="min-w-0 truncate">{koreanWon(avgPrice)}</span>
              </span>
              <input
                ref={priceRef}
                className={`${FIELD_CLASS} px-4 text-lg ${
                  keypadTarget === "price" ? "keypad-target" : ""
                }`}
                /* 네이티브 키보드를 안 부른다 — 커스텀 키패드가 대신한다. */
                inputMode="none"
                /* 시세가 오기 전 한순간만 쓰이는 자릿수 힌트다. */
                placeholder={
                  previousClose === null
                    ? "74,800"
                    : formatNumericInput(String(Math.round(previousClose)))
                }
                /*
                 * **여기엔 autoFocus를 두지 않는다.** 들어오자마자 키패드가 화면 절반을
                 * 덮으면 아래 슬라이더가 그 뒤로 숨어, 밀어서 잡는 길이 있다는 걸
                 * 아무도 못 본다. 정확한 값을 아는 사람만 칸을 눌러 키패드를 연다.
                 */
                value={avgPriceInput}
                onFocus={() => setKeypadTarget("price")}
                /* ▾로 접은 뒤 다시 누르면 포커스가 그대로라 focus가 안 온다 — 클릭으로도 연다. */
                onClick={() => setKeypadTarget("price")}
                onChange={(event) =>
                  patch({ price: capNumericInput(event.target.value, MAX_INPUT_WON) })
                }
              />
            </label>

            <label className="flex min-w-0 flex-[2] flex-col gap-1.5">
              <span className="text-xs text-[color:var(--muted)]">수량 (주)</span>
              {/* 직접입력(소수점 포함)도 시트 안에서 받는다 — 칸에는 입력이 안 뜬다. */}
              <QuantityPicker
                className={`${FIELD_CLASS} px-2 text-center text-base`}
                options={quantityOptions}
                value={quantitySelect}
                open={quantityOpen}
                onOpenChange={(open) => {
                  // 피커의 제 버튼으로 열 때도 키패드를 먼저 접는다 — 겹치면 휠이 가린다.
                  if (open) {
                    closeKeypad();
                    quantityFromKeypad.current = false;
                  }
                  setQuantityOpen(open);
                }}
                onBack={() => {
                  setQuantityOpen(false);
                  // 키패드의 "다음"으로 온 길이면 평단가 키패드로 되돌린다 —
                  // focus가 나면 onFocus가 키패드를 다시 연다.
                  if (quantityFromKeypad.current) priceRef.current?.focus();
                }}
                onSelect={(next) => patch({ quantity: next, picked: true })}
              />
            </label>
          </div>

          {/*
            평단가를 **밀어서** 잡는 자. 정확한 값을 아는 사람은 위 칸을 눌러 키패드로
            치고, "대충 이쯤"인 사람은 여기서 민다 — 키패드 자동 열기를 뗀 게 이걸
            먼저 보게 하기 위해서다.

            **굴려 보여주는 묶음(fieldsRef) 안에 둔다** — 밖으로 빼면 키패드가 뜨는
            순간 그 뒤에 깔려서, 치다가 다시 밀어보려 해도 손이 못 닿는다.
          */}
          <PriceSlider
            value={avgPrice}
            previousClose={previousClose}
            onChange={(next) => patch({ price: formatNumericInput(String(next)) })}
          />

          {/*
            전일 종가는 종목만 고르면 바로 뜨고, 매수 원금은 평단가와 수량이 다 차면 그
            아래 줄에 붙는다. 둘 다 "지금 적는 숫자를 가늠하는 곁줄"이라 **굴려 보여주는
            묶음 안에 들어 있어야 한다** — 밖으로 빼면 치는 동안 키패드 뒤에 깔려서,
            정작 가늠할 때 안 보인다.

            **두 줄 자리를 처음부터 비워둔다**(min-h-10). 굴리는 건 키패드가 뜨는 그
            한 번뿐인데, 그때 곁줄은 아직 한 줄("전일 종가")이다. 평단가를 다 치면
            둘째 줄("매수 원금")이 새로 생기면서 묶음이 한 줄만큼 아래로 밀리고, 그
            밀린 만큼이 키패드 뒤로 들어간다 — 정작 방금 친 값의 결과가 안 보인다.
          */}
          <p className="mt-3 min-h-10 text-sm text-[color:var(--muted)]">
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
                <strong className="text-[color:var(--fg)]">{formatWon(costBasis)}</strong> 정도
                되는군.
              </span>
            )}
          </p>
        </div>

        {/* 입력 묶음(평단가·수량·매수 원금)과 버튼 사이 간격 24px */}
        <div className="mt-6 flex gap-3">
          <button className="btn-ghost flex-1" type="button" onClick={onBack}>
            이전
          </button>
          {/* 키패드의 확인 키와 **같은 말을 한다** — 자리가 둘이어도 지금 할 일은 하나다.
              form 안이라 type을 반드시 적는다 (안 적으면 엔터가 이쪽으로 샌다). */}
          <button className="btn-primary flex-[2]" type="submit" disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>

        {/*
          커스텀 키패드. 확인 키가 "내 평단가 입력"(수량 시트를 연다) →
          "🐜 얼마나 더 일해야 할까?"(연봉 화면)로 바뀌며 다음 차례를 가리킨다.
        */}
        {keypadTarget !== null && (
          <>
            <div className="keypad-space" aria-hidden />
            <NumericKeypad
              value={avgPriceInput}
              onChange={(next) => patch({ price: capNumericInput(next, MAX_INPUT_WON) })}
              submitLabel={confirmLabel}
              submitDisabled={confirmDisabled}
              onSubmit={advance}
              onDismiss={closeKeypad}
              revealRef={fieldsRef}
            />
          </>
        )}
      </form>
    </main>
  );
}
