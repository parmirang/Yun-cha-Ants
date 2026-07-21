"use client";

import {
  type Position,
  type Profile,
  type Ticker,
  hourlyWageFromAnnualSalary,
  tickerListSchema,
} from "@yca/shared";
import { useEffect, useMemo, useState } from "react";

import { apiBaseUrl } from "@/lib/api";
import { formatWon, parseNumericInput } from "@/lib/format";

import { EntSprite } from "./ent-sprite";

type Step = "salary" | "search" | "position";

export function Onboarding({
  onComplete,
}: {
  onComplete: (profile: Profile, position: Position) => void;
}) {
  const [step, setStep] = useState<Step>("salary");
  const [salaryManwon, setSalaryManwon] = useState("");
  const [ticker, setTicker] = useState<Ticker | null>(null);

  const annualSalary = parseNumericInput(salaryManwon) * 10_000;
  const hourlyWage = hourlyWageFromAnnualSalary(annualSalary);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <header className="mb-8 flex flex-col items-center gap-3">
        <EntSprite stage={38} className="h-20 w-20" />
        <h1 className="text-2xl font-bold tracking-tight">영차Ants</h1>
        <p className="text-center text-sm text-[color:var(--muted)]">
          내 주식, 몇 시간 더 일하면 본전일까?
        </p>
      </header>

      {step === "salary" && (
        <SalaryStep
          value={salaryManwon}
          hourlyWage={hourlyWage}
          onChange={setSalaryManwon}
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

      {step === "position" && ticker && (
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
      )}
    </main>
  );
}

function SalaryStep({
  value,
  hourlyWage,
  onChange,
  onNext,
}: {
  value: string;
  hourlyWage: number;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  const valid = hourlyWage > 0;

  return (
    <section className="flex flex-1 flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">연봉이 얼마야?</span>
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
          <input
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none"
            inputMode="numeric"
            placeholder="4000"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <span className="shrink-0 text-sm text-[color:var(--muted)]">만원</span>
        </div>
      </label>

      <p className="text-sm text-[color:var(--muted)]">
        {valid ? (
          <>
            시급 <strong className="text-[color:var(--fg)]">{formatWon(hourlyWage)}</strong> 로
            계산할게. (월 209시간 기준)
          </>
        ) : (
          "세전 연봉을 만원 단위로 입력해줘. 이 값은 이 기기에만 저장돼."
        )}
      </p>

      <button className="btn-primary mt-auto" disabled={!valid} onClick={onNext}>
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
        const response = await fetch(
          `${apiBaseUrl}/tickers?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const parsed = tickerListSchema.safeParse(await response.json());
        if (parsed.success) setTickers(parsed.data.tickers);
      } catch {
        // 취소되었거나 서버가 죽은 경우 — 목록을 그대로 둔다.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section className="flex flex-1 flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">어떤 종목을 샀어?</span>
        <input
          className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 outline-none"
          placeholder="종목명 또는 종목코드"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <ul className="flex-1 divide-y divide-[color:var(--line)] overflow-y-auto">
        {tickers.map((ticker) => (
          <li key={ticker.symbol}>
            <button
              className="flex w-full items-center justify-between py-3 text-left"
              onClick={() => onSelect(ticker)}
            >
              <span className="font-medium">{ticker.name}</span>
              <span className="text-xs text-[color:var(--muted)]">
                {ticker.symbol} · {ticker.market}
              </span>
            </button>
          </li>
        ))}
        {tickers.length === 0 && (
          <li className="py-6 text-center text-sm text-[color:var(--muted)]">
            검색 결과가 없어.
          </li>
        )}
      </ul>

      <button className="btn-ghost" onClick={onBack}>
        이전
      </button>
    </section>
  );
}

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
  const [quantityInput, setQuantityInput] = useState("");

  const avgPrice = parseNumericInput(avgPriceInput);
  const quantity = Math.floor(parseNumericInput(quantityInput));
  const costBasis = useMemo(() => avgPrice * quantity, [avgPrice, quantity]);
  const valid = avgPrice > 0 && quantity > 0;

  return (
    <section className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-medium">
        <strong>{ticker.name}</strong> 얼마에, 몇 주 샀어?
      </p>

      <label className="flex flex-col gap-2">
        <span className="text-xs text-[color:var(--muted)]">평단가 (원)</span>
        <input
          className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-lg font-semibold tabular-nums outline-none"
          inputMode="numeric"
          placeholder="74800"
          value={avgPriceInput}
          onChange={(event) => setAvgPriceInput(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs text-[color:var(--muted)]">보유 수량 (주)</span>
        <input
          className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-lg font-semibold tabular-nums outline-none"
          inputMode="numeric"
          placeholder="10"
          value={quantityInput}
          onChange={(event) => setQuantityInput(event.target.value)}
        />
      </label>

      {valid && (
        <p className="text-sm text-[color:var(--muted)]">
          매수 원금 <strong className="text-[color:var(--fg)]">{formatWon(costBasis)}</strong>
        </p>
      )}

      <div className="mt-auto flex gap-3">
        <button className="btn-ghost flex-1" onClick={onBack}>
          이전
        </button>
        <button
          className="btn-primary flex-[2]"
          disabled={!valid}
          onClick={() => onSubmit(avgPrice, quantity)}
        >
          내 엔트 보러가기
        </button>
      </div>
    </section>
  );
}
