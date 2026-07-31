"use client";

import { type Mood, formatDuration, formatSpanWords } from "@yca/shared";
import { useEffect, useState } from "react";

import { pickWorkLine, workTier } from "./countdown-lines";

/**
 * 손익 시간을 문장으로 크게 말한다: "{13일 21시간} 만큼" + 시간이 길수록 세지는
 * 한마디("더 일해야 해" … "뼈를 갈아야 해"). 바로 아래에 정확한 `HH:MM:SS`(하루가
 * 넘으면 "1일 02:34:56")를 작게 붙인다. 봉 길이는 clamp되지만 숫자는 실제 값이다.
 *
 * 위 두 줄이 시간의 감(크고 작음)을 맡고, 아래 시계는 정확한 값과 초 단위 움직임을 맡는다.
 * 한마디는 **일해야 하는 시간의 크기**로 세기를 정한다 (부정·긍정 모두) — 손익 방향만
 * 보고 두 갈래만 내던 걸 시간축으로 폈다. 랜덤 한마디는 구간이나 손익 방향이 바뀔
 * 때만 새로 뽑는다 — 매 틱(1초) 뽑으면 문장이 깜빡인다.
 */
export function Countdown({ seconds, mood }: { seconds: number; mood: Mood }) {
  const tier = workTier(seconds);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setSeed(Math.floor(Math.random() * 997));
  }, [tier, mood]);

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
            {formatSpanWords(seconds)} 만큼
          </span>
          <span className="text-[2rem] font-bold leading-tight">
            {pickWorkLine(mood, seconds, seed)}
          </span>
        </>
      )}
      <span className="mt-1.5 font-mono text-base tabular-nums text-[color:var(--muted)]">
        {formatDuration(seconds)}
      </span>
    </div>
  );
}
