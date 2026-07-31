"use client";

import {
  type Mood,
  type SceneLevel,
  candleScale,
  sceneLevelFromStage,
  sceneLevelWithHysteresis,
} from "@yca/shared";
import { useEffect, useRef, useState } from "react";

import { type AntPose, AntSprite, antTopOffset } from "./ant-sprite";
import { nudgeTier } from "./nudge-lines";
import { SceneBackdrop } from "./scene-backdrop";
import { SpeechBubble } from "./speech-bubble";
import { pickAntSpeech, pickWaitingLine } from "./speech-lines";

/**
 * 손익을 장대봉으로 그리는 무대.
 *
 * 세계 좌표는 "봉 폭 = 1"이다. 봉 높이는 `candleScale()`이 주는 1~12배이고,
 * 카메라는 그 높이가 무대에 들어오도록 픽셀 배율(unit)을 정한다.
 * **개미가 작아 보이는 건 이 줌아웃의 결과다** — 개미 크기를 따로 계산하지 않는다.
 *
 * 연출(씨앗 → 성장 → 개미 등장 → 손 흔들기 → 말풍선)은 **최초 1회만** 돈다.
 * 이후 시세가 바뀌면 봉 높이와 unit만 이어서 변하고, 봉을 다시 그리지 않는다.
 */

/** 1:1 씨앗 상태에서 봉 한 변의 최대 픽셀 — 이보다 크면 화면을 다 먹는다 */
const MAX_UNIT_PX = 104;
/** 줌아웃이 끝까지 가도 개미가 이보다 작아지면 뭔지 알아볼 수 없다 */
const MIN_ANT_PX = 30;
const ANT_UNIT_RATIO = 0.95;
/** 대기 상태에서 개미가 한쪽 끝까지 가는 데 걸리는 시간 */
const PACE_MS = 2400;

type Phase = "seed" | "grow" | "stand" | "wave";

/**
 * live    — 손익이 있는 상태. 봉이 자라고 개미가 그 옆에 서서 손을 흔든다.
 * waiting — 평단가를 넣기 전. 봉이 없고 개미가 1:1 크기로 좌우를 서성인다.
 */
export type SceneMode = "live" | "waiting";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CandleScene({
  seconds,
  mood,
  stage,
  mode = "live",
  fill = false,
  onAntTap,
  antLabel,
}: {
  seconds: number;
  mood: Mood;
  stage: number;
  mode?: SceneMode;
  /** 정해진 높이를 쓰지 않고 부모가 주는 공간을 다 채운다 (flex-1 안에 넣을 때) */
  fill?: boolean;
  onAntTap?: () => void;
  antLabel?: string;
}) {
  const waiting = mode === "waiting";
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 360, height: 320 });
  const [phase, setPhase] = useState<Phase>("seed");
  const [frame, setFrame] = useState(0);
  const [side, setSide] = useState<1 | -1>(1);
  const [seed, setSeed] = useState(0);
  const [paceDir, setPaceDir] = useState<1 | -1>(1);
  const [level, setLevel] = useState<SceneLevel>(() => sceneLevelFromStage(stage));

  // 무대 크기를 알아야 봉이 몇 픽셀인지 정할 수 있다.
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // 등장 연출 — 한 번만. 대기 상태에는 등장할 봉이 없으니 건너뛴다.
  useEffect(() => {
    if (waiting) return;

    setSide(Math.random() < 0.5 ? -1 : 1);

    if (prefersReducedMotion()) {
      setPhase("wave");
      return;
    }

    const timers = [
      setTimeout(() => setPhase("grow"), 280),
      setTimeout(() => setPhase("stand"), 1750),
      setTimeout(() => setPhase("wave"), 2150),
    ];

    return () => timers.forEach(clearTimeout);
  }, [waiting]);

  // 대기 상태: 좌우로 서성이고, 방향을 바꿀 때마다 할 말도 새로 고른다.
  useEffect(() => {
    if (!waiting) return;

    const id = setInterval(() => {
      setPaceDir((direction) => (direction === 1 ? -1 : 1));
      setSeed((value) => value + 1);
    }, PACE_MS);

    return () => clearInterval(id);
  }, [waiting]);

  // 기어가기·손 흔들기 프레임.
  useEffect(() => {
    const id = setInterval(() => setFrame((value) => value + 1), 180);
    return () => clearInterval(id);
  }, []);

  // 경계에서 배경이 깜빡이지 않게 이전 레벨을 물고 넘어간다.
  useEffect(() => {
    setLevel((previous) => sceneLevelWithHysteresis(stage, previous));
  }, [stage]);

  // 말풍선은 시간 구간이나 손익 방향이 바뀔 때만 새로 뽑는다 — 매 틱(1초) 새로 뽑으면
  // 1초마다 문장이 바뀐다. 개미 색·배경 날씨는 레벨을 따르지만, 말은 노동시간을 따른다.
  useEffect(() => {
    if (waiting) return;
    setSeed(Math.floor(Math.random() * 997));
  }, [mood, nudgeTier(seconds), waiting]);

  // 대기 상태에는 손익이 없으니 봉도 없다 — 개미는 1:1 크기 그대로다.
  const scale = waiting ? 1 : candleScale(seconds);
  // 바닥선(무대 정중앙)에서 위 또는 아래로 쓸 수 있는 높이.
  const halfHeight = Math.max(40, box.height / 2 - 10);
  const unit = Math.min(MAX_UNIT_PX, halfHeight / scale);

  const candleWidth = Math.max(10, unit);
  const candleHeight = phase === "seed" ? candleWidth : Math.min(halfHeight, unit * scale);
  const antSize = Math.max(MIN_ANT_PX, unit * ANT_UNIT_RATIO);

  // 서성일 때는 무대 안에서 좌우로, 등장할 때는 무대 밖에서 봉 옆으로.
  const paceRange = Math.max(0, Math.min(96, box.width / 2 - antSize / 2 - 10));
  const restX = side * (candleWidth / 2 + antSize * 0.5 + 6);
  const antX = waiting
    ? paceDir * paceRange
    : phase === "seed"
      ? side * (box.width / 2 + antSize)
      : restX;

  const walking = waiting || phase === "grow";
  const pose: AntPose = walking
    ? frame % 2 === 0
      ? "crawl1"
      : "crawl2"
    : phase === "seed"
      ? "crawl1"
      : phase === "stand"
        ? "stand"
        : frame % 2 === 0
          ? "wave1"
          : "wave2";

  // 가는 방향을 본다. 스프라이트는 오른쪽을 보고 있으니 왼쪽으로 갈 때만 뒤집는다.
  const flip = waiting ? paceDir === -1 : side === 1;

  // 손실은 땅속으로, 수익은 하늘로. 본전은 위로 조금 세워둔다.
  const downward = mood === "loss";

  // 수익은 봉이 하늘로 뻗고 개미는 바닥선에 서므로 **아래 절반(땅속)이 텅 빈다.**
  // 등장 연출이 끝나면(wave) 카메라를 개미 쪽으로 밀어 그 빈 아래를 걷어낸다.
  // 손실은 위 절반이 날씨(비·구름)로 차 있어 이 줌이 필요 없다 — 수익일 때만 건다.
  const zoomed = !waiting && phase === "wave" && mood === "profit";

  const antStyle = {
    width: `${antSize}px`,
    height: `${antSize}px`,
    transform: `translateX(calc(-50% + ${antX}px))`,
    transitionDuration: waiting ? `${PACE_MS}ms` : walking ? "1.45s" : "0.5s",
  };
  const antBody = (
    <>
      <SpeechBubble
        text={waiting ? pickWaitingLine(seed) : pickAntSpeech(mood, seconds, seed)}
        visible={waiting || phase === "wave"}
        headTop={antTopOffset(pose) * antSize}
      />
      <AntSprite stage={stage} pose={pose} flip={flip} className="candle-ant-sprite" />
    </>
  );

  return (
    <div
      ref={stageRef}
      className="candle-stage"
      data-mood={waiting ? "even" : mood}
      data-fill={fill ? "yes" : undefined}
    >
      {/*
        배경·날씨·바닥선·봉·개미를 한 "월드"로 묶는다. 카메라 줌(수익 정착 시)은
        이 월드 하나에 트랜스폼으로 건다 — 바닥선만 따로 내리면 배경 그라데이션과
        어긋나므로, 하늘/땅 경계까지 통째로 함께 움직이게 한 몸으로 둔다.
      */}
      <div className="candle-world" data-zoom={zoomed ? "in" : undefined}>
        <SceneBackdrop level={waiting ? 0 : level} />

        <div className="candle-ground" />

        {!waiting && (
          <div
            className="candle-bar"
            style={{
              width: `${candleWidth}px`,
              height: `${candleHeight}px`,
              ...(downward ? { top: "50%" } : { bottom: "50%" }),
            }}
          />
        )}

        {onAntTap ? (
          <button
            type="button"
            className="candle-ant"
            onClick={onAntTap}
            aria-label={antLabel}
            style={antStyle}
          >
            {antBody}
          </button>
        ) : (
          <div className="candle-ant" style={antStyle}>
            {antBody}
          </div>
        )}
      </div>
    </div>
  );
}
