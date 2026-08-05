"use client";

import { type Mood, formatTotalWorkLine, formatWorkSpanWords } from "@yca/shared";
import { useEffect, useState } from "react";

import { pickWorkLine, workTier } from "./countdown-lines";
import { pickCostLine } from "./cost-lines";

/**
 * 손익 시간을 문장으로 크게 말한다: "{출근 131번} 만큼" + 시간이 길수록 세지는
 * 한마디("더 일해야 해" … "인생을 갈아 넣어야 해"). 그 아래에 시계 한 줄이 작게 붙는다:
 * "총 1,054시간 50분 34초 만큼 돈 잃었다". 봉 길이는 clamp되지만 숫자는 실제 값이다.
 *
 * **날을 세는 건 큰 글씨뿐이다.** 시계는 시간을 끝까지 누적한다 — 둘 다 날을 세면
 * 같은 값이 두 번 적힌다. 자가 다르면 어긋나 보이고("출근 132번" 밑에 "43일"),
 * 자를 맞추면 같은 말을 두 번 한다. 큰 글씨는 "며칠치 노동인가", 시계는 "몇 시간인가"다.
 *
 * 위 두 줄이 시간의 감(크고 작음)을 맡고, 아래 시계는 정확한 값과 초 단위 움직임을 맡는다.
 * 한마디는 **일해야 하는 시간의 크기**로 세기를 정한다 (부정·긍정 모두) — 손익 방향만
 * 보고 두 갈래만 내던 걸 시간축으로 폈다. 랜덤 한마디는 구간이나 손익 방향이 바뀔
 * 때만 새로 뽑는다 — 매 틱(1초) 뽑으면 문장이 깜빡인다.
 */
export function Countdown({
  seconds,
  mood,
  pnl,
}: {
  seconds: number;
  mood: Mood;
  /** 평가손익 (원, 부호 포함). 금액을 아는 화면(대시보드)에서만 넘긴다 — 넘기면
   *  시계 아래에 물건 환산 한 줄이 뜬다. 공유 화면은 금액을 안 싣는다. */
  pnl?: number;
}) {
  const tier = workTier(seconds);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setSeed(Math.floor(Math.random() * 997));
  }, [tier, mood]);

  // 물건 줄도 같은 seed로 골라 구간·손익 방향이 바뀔 때만 다시 뽑는다 (한마디와 함께).
  const costLine = pnl === undefined ? null : pickCostLine(mood, Math.abs(pnl), seed);
  const clockLine = formatTotalWorkLine(seconds, mood);

  return (
    <div
      className="flex flex-col items-center gap-1 text-center"
      data-mood={mood}
      style={{ color: "var(--mood-color)" }}
    >
      {mood === "even" ? (
        <span className="text-[2rem] font-bold leading-tight">딱 본전이야</span>
      ) : (
        <>
          <span className="text-[2rem] font-bold leading-tight tabular-nums">
            {formatWorkSpanWords(seconds)} 만큼
          </span>
          <span className="text-[2rem] font-bold leading-tight">
            {pickWorkLine(mood, seconds, seed)}
          </span>
        </>
      )}
      {/* 본전은 셀 시간도 벌거나 잃은 돈도 없어 줄이 통째로 빠진다 (formatTotalWorkLine → null). */}
      {clockLine && (
        <span className="mt-1.5 text-base tabular-nums text-[color:var(--muted)]">
          {clockLine}
        </span>
      )}
      {costLine && (
        <span className="text-sm text-[color:var(--muted)]">{costLine}</span>
      )}
    </div>
  );
}
