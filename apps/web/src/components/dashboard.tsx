"use client";

import {
  STAGE_COUNT,
  type Position,
  type Profile,
  averageIn,
  calcPositionStatus,
  encodeShareSnapshot,
  hourlyWageFromAnnualSalary,
} from "@yca/shared";
import { useState } from "react";

import { formatPercent, formatSignedWon, formatWon, parseNumericInput } from "@/lib/format";
import { shareUrl } from "@/lib/share-url";
import { useQuote } from "@/lib/use-quote";

import { Countdown } from "./countdown";
import { AntSprite } from "./ant-sprite";
import { Footprints } from "./footprints";

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
  const [wateringOpen, setWateringOpen] = useState(false);
  const [splash, setSplash] = useState(0);

  const hourlyWage = hourlyWageFromAnnualSalary(profile.annualSalary);
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

      <section className="relative my-6 flex flex-1 items-center justify-center">
        <Footprints mood={status.mood} />
        <button
          className="ant-stage relative z-10"
          onClick={() => {
            setSplash((count) => count + 1);
            setWateringOpen(true);
          }}
          aria-label={`개미에게 물주기 (${averagingLabel})`}
        >
          <AntSprite stage={status.stage} className="ant-sway h-48 w-48" />
          {splash > 0 && (
            <span key={splash} className="ant-splash" aria-hidden>
              💧
            </span>
          )}
        </button>
      </section>

      <StageMeter stage={status.stage} />

      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{position.name}</span>
          <span className="text-lg font-bold tabular-nums">{formatWon(price)}</span>
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
          개미를 탭하면 {averagingLabel} 할 수 있어.
        </p>
      </section>

      <div className="mt-4 flex gap-3">
        <ShareButton
          name={position.name}
          seconds={status.seconds}
          stage={status.stage}
          mood={status.mood}
        />
        <button className="btn-ghost" onClick={onReset}>
          초기화
        </button>
      </div>

      {wateringOpen && (
        <WateringSheet
          label={averagingLabel}
          currentPrice={price}
          onClose={() => setWateringOpen(false)}
          onConfirm={(addPrice, addQuantity) => {
            onPositionChange(averageIn(position, addPrice, addQuantity));
            setWateringOpen(false);
          }}
        />
      )}
    </main>
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

function WateringSheet({
  label,
  currentPrice,
  onClose,
  onConfirm,
}: {
  label: string;
  currentPrice: number;
  onClose: () => void;
  onConfirm: (price: number, quantity: number) => void;
}) {
  const [priceInput, setPriceInput] = useState(String(Math.round(currentPrice)));
  const [quantityInput, setQuantityInput] = useState("");

  const price = parseNumericInput(priceInput);
  const quantity = Math.floor(parseNumericInput(quantityInput));
  const valid = price > 0 && quantity > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{label}</h2>

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">매수 단가 (원)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
          />
        </label>

        <label className="mb-5 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">추가 수량 (주)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            placeholder="10"
            autoFocus
            value={quantityInput}
            onChange={(event) => setQuantityInput(event.target.value)}
          />
        </label>

        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary flex-[2]"
            disabled={!valid}
            onClick={() => onConfirm(price, quantity)}
          >
            물 주기
          </button>
        </div>
      </div>
    </div>
  );
}
