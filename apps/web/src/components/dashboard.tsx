"use client";

import {
  type Mood,
  type Position,
  type Profile,
  RATE_YEAR,
  STAGE_COUNT,
  averageIn,
  calcPositionStatus,
  encodeShareSnapshot,
  formatSpanWords,
  halfwayAveragingPlan,
  isBroke,
  netHourlyWage,
} from "@yca/shared";
import { useEffect, useState } from "react";

import {
  formatNumericInput,
  formatPercent,
  formatSignedWon,
  formatWon,
  parseNumericInput,
} from "@/lib/format";
import { shareUrl } from "@/lib/share-url";
import { useQuote } from "@/lib/use-quote";

import { CandleScene } from "./candle-scene";
import { Countdown } from "./countdown";
import { nudgeTier, pickNudgeLine } from "./nudge-lines";

export function Dashboard({
  profile,
  position,
  onPositionChange,
  onReset,
}: {
  profile: Profile;
  position: Position;
  onPositionChange: (position: Position) => void;
  onReset: () => void;
}) {
  const quote = useQuote(position.symbol);
  const [averagingOpen, setAveragingOpen] = useState(false);

  // 손익을 시간으로 바꿀 때는 실수령 시급으로 나눈다 (profile에는 세전 연봉이 들어있다).
  // 무일푼(연봉 0)이면 shared가 최저임금으로 대신 환산하므로, 그 사실을 화면에 적어준다 —
  // 안 적으면 내 시급으로 계산된 시간인 줄 알게 된다.
  const hourlyWage = netHourlyWage(profile.annualSalary);
  const brokeBasis = isBroke(profile.annualSalary)
    ? `${RATE_YEAR}년 최저시급 기준`
    : undefined;
  const price = quote?.price ?? position.avgPrice;
  const status = calcPositionStatus(position, price, hourlyWage);

  // 현재가가 평단보다 낮으면 물타기, 높으면 불타기 — 계산은 같고 이름만 다르다.
  const averagingLabel = price < position.avgPrice ? "물타기" : "불타기";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6"
      data-mood={status.mood}
    >
      <Countdown seconds={status.seconds} mood={status.mood} />

      <section className="my-5">
        <CandleScene
          seconds={status.seconds}
          mood={status.mood}
          stage={status.stage}
          onAntTap={() => setAveragingOpen(true)}
          antLabel={`${averagingLabel} 계산하기`}
        />
      </section>

      <StageMeter stage={status.stage} />

      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
        <div className="flex items-start justify-between">
          <span className="font-semibold">{position.name}</span>
          {/* 장중 현재가는 아직 없다 — 전일 종가를 현재가로 쓰고, 그 사실을 라벨로 알린다. */}
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-lg font-bold leading-none tabular-nums">
              {formatWon(price)}
            </span>
            <span className="text-[10px] text-[color:var(--muted)]">
              실시간 적용 준비중 · 전일 종가
            </span>
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-[color:var(--muted)]">평단가</dt>
          <dd className="text-right tabular-nums">{formatWon(position.avgPrice)}</dd>

          <dt className="text-[color:var(--muted)]">보유 수량</dt>
          <dd className="text-right tabular-nums">{position.quantity}주</dd>

          <dt className="text-[color:var(--muted)]">평가손익</dt>
          <dd
            className="text-right font-semibold tabular-nums"
            style={{ color: "var(--mood-color)" }}
          >
            {formatSignedWon(status.pnl)} ({formatPercent(status.returnRate)})
          </dd>
        </dl>

        <p className="text-xs text-[color:var(--muted)]">
          개미를 탭하면 몇 주를 더 사야 평단이 넘어오는지 계산해줄게.
        </p>
      </section>

      <div className="mt-4 flex gap-3">
        <button className="btn-ghost" onClick={onReset}>
          다시 입력
        </button>
        <ShareButton
          name={position.name}
          seconds={status.seconds}
          stage={status.stage}
          mood={status.mood}
        />
      </div>

      <FooterNote mood={status.mood} seconds={status.seconds} basis={brokeBasis} />

      {averagingOpen && (
        <AveragingSheet
          position={position}
          currentPrice={price}
          hourlyWage={hourlyWage}
          currentSeconds={status.seconds}
          onClose={() => setAveragingOpen(false)}
          onConfirm={(addPrice, addQuantity) => {
            onPositionChange(averageIn(position, addPrice, addQuantity));
            setAveragingOpen(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * 화면 맨 아래. 시간에 맞는 한마디를 띄우고, 그 아래에 이 시간을 무엇으로 나눠
 * 만들었는지 적는다 (내 시급이 아닐 때만).
 */
function FooterNote({
  mood,
  seconds,
  basis,
}: {
  mood: Mood;
  seconds: number;
  basis?: string;
}) {
  const tier = nudgeTier(seconds);
  const [seed, setSeed] = useState(0);

  // 시간 구간이나 손익 방향이 바뀔 때만 새로 뽑는다 — 매 렌더 뽑으면 시세가
  // 들어올 때마다(1초에 한 번) 문장이 갈린다.
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 997));
  }, [tier, mood]);

  return (
    <footer className="mt-auto flex flex-col items-center gap-1 pt-6 text-center">
      <p className="text-sm text-[color:var(--muted)]">
        {pickNudgeLine(mood, seconds, seed)}
      </p>
      {basis && <p className="text-xs text-[color:var(--muted)] opacity-70">{basis}</p>}
    </footer>
  );
}

function StageMeter({ stage }: { stage: number }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-[color:var(--muted)]">
        <span>탈진</span>
        <span className="tabular-nums">
          {stage + 1} / {STAGE_COUNT} 단계
        </span>
        <span>쌩쌩</span>
      </div>
      <div className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: STAGE_COUNT }, (_, index) => {
          // 미터 색은 개미 껍질 색과 같은 축을 쓰되, 얇은 막대라 명도만 조금 올린다.
          const t = index / (STAGE_COUNT - 1);
          return (
            <span
              key={index}
              className="h-2 flex-1 rounded-[1px]"
              style={{
                background:
                  index <= stage
                    ? `hsl(${Math.round(30 - t * 18)}, ${Math.round(8 + t * 54)}%, ${Math.round(41 + t * 13)}%)`
                    : "var(--line)",
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function ShareButton({
  name,
  seconds,
  stage,
  mood,
}: {
  name: string;
  seconds: number;
  stage: number;
  mood: "loss" | "profit" | "even";
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const token = encodeShareSnapshot({
      n: name,
      s: seconds,
      g: stage,
      m: mood === "loss" ? "l" : mood === "profit" ? "p" : "e",
    });
    const url = shareUrl(token);

    // 모바일에서는 공유 시트를, 데스크톱에서는 클립보드 복사로 떨어진다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "영차Ants", url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우 — 복사로 이어간다.
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <button className="btn-primary flex-1" onClick={share}>
      {copied ? "링크 복사됨!" : "공유하기"}
    </button>
  );
}

/**
 * 개미를 탭하면 열리는 추가 매수 계산기.
 *
 * 먼저 답하는 질문은 **"몇 주를 더 사야 평단이 넘어오나"**다 (`halfwayAveragingPlan`).
 * 평단을 현재가까지 끌어내리는 건 불가능하니 목표는 딱 중간이고, 그 수량을 눌러
 * 그대로 채워 넣을 수 있다.
 *
 * 물타기/불타기는 **입력한 단가**가 정한다 — 현재가가 아니다. 사용자가 다른 값을
 * 넣으면 그쪽을 따라가야 확인 버튼 문구가 거짓말을 안 한다.
 */
function AveragingSheet({
  position,
  currentPrice,
  hourlyWage,
  currentSeconds,
  onClose,
  onConfirm,
}: {
  position: Position;
  currentPrice: number;
  hourlyWage: number;
  currentSeconds: number;
  onClose: () => void;
  onConfirm: (price: number, quantity: number) => void;
}) {
  // 초기값·"N주로 채우기"가 넣는 값도 손으로 친 것과 같은 모양이어야 한다 —
  // 쉼표 없는 숫자가 끼면 커서를 대는 순간 표기가 튄다.
  const [priceInput, setPriceInput] = useState(() =>
    formatNumericInput(String(Math.round(currentPrice))),
  );
  const [quantityInput, setQuantityInput] = useState("");

  const price = parseNumericInput(priceInput);
  const quantity = Math.floor(parseNumericInput(quantityInput));
  const valid = price > 0 && quantity > 0;

  const watering = price > 0 && price < position.avgPrice;
  const plan = price > 0 ? halfwayAveragingPlan(position, price) : null;

  // 추가 매수 이후의 상태는 **현재가**로 다시 평가한다 — 산 값이 아니라 지금 값이
  // 손익을 만든다. 계산은 대시보드와 같은 함수를 그대로 쓴다.
  const next = valid ? averageIn(position, price, quantity) : null;
  const preview = next ? calcPositionStatus(next, currentPrice, hourlyWage) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      {/* 시트 안의 --mood-color는 **추가 매수 이후**의 손익을 따른다 — 바깥 화면의
          지금 손익을 그대로 물려받으면 뒤집히는 순간 색이 거짓말을 한다. */}
      <div
        className="max-h-dvh w-full overflow-y-auto rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        data-mood={preview?.mood}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold">평단 다시 계산하기</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)] tabular-nums">
          현재가 {formatWon(currentPrice)} · 내 평단 {formatWon(position.avgPrice)}
        </p>

        <div className="mt-4 rounded-xl border border-[color:var(--line)] p-4">
          {plan ? (
            <>
              <p className="text-sm leading-relaxed">
                {formatWon(price)}에{" "}
                <b className="tabular-nums" style={{ color: "var(--mood-color)" }}>
                  {plan.shares}주
                </b>{" "}
                더 사면 평단이{" "}
                <b className="tabular-nums">{formatWon(plan.targetAvg)}</b> — 현재가와의
                차이가 절반으로 줄어.
              </p>
              <p className="mt-1.5 text-xs text-[color:var(--muted)] tabular-nums">
                필요한 돈 {formatWon(plan.cost)}
              </p>
              <button
                className="btn-ghost mt-3 w-full py-2 text-sm"
                onClick={() => setQuantityInput(formatNumericInput(String(plan.shares)))}
              >
                {plan.shares}주로 채우기
              </button>
            </>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              매수 단가가 평단과 같으면 평단은 움직이지 않아. 다른 값을 넣어봐.
            </p>
          )}
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">매수 단가 (원)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            value={priceInput}
            onChange={(event) => setPriceInput(formatNumericInput(event.target.value))}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">추가 수량 (주)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            placeholder={plan ? formatNumericInput(String(plan.shares)) : "10"}
            autoFocus
            value={quantityInput}
            onChange={(event) => setQuantityInput(formatNumericInput(event.target.value))}
          />
        </label>

        <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-[color:var(--muted)]">바뀔 평단</dt>
          <dd className="text-right tabular-nums">
            {next ? formatWon(next.avgPrice) : "—"}
          </dd>

          <dt className="text-[color:var(--muted)]">바뀔 수량</dt>
          <dd className="text-right tabular-nums">{next ? `${next.quantity}주` : "—"}</dd>

          <dt className="text-[color:var(--muted)]">
            {preview?.mood === "profit" ? "안 일해도 되는 시간" : "더 일할 시간"}
          </dt>
          <dd className="text-right tabular-nums">
            {preview ? (
              <>
                <span className="text-[color:var(--muted)] line-through">
                  {formatSpanWords(currentSeconds)}
                </span>{" "}
                <span style={{ color: "var(--mood-color)" }}>
                  {formatSpanWords(preview.seconds)}
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </dl>

        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary flex-[2] text-sm"
            disabled={!valid}
            onClick={() => onConfirm(price, quantity)}
          >
            {watering ? "설마 물탔어? 가격 업데이트" : "우와 불탔어? 가격 업데이트"}
          </button>
        </div>
      </div>
    </div>
  );
}
