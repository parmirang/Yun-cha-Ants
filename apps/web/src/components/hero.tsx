"use client";

import { STAGE_COUNT } from "@yca/shared";
import { type CSSProperties, useEffect, useState } from "react";

import { AntSprite } from "./ant-sprite";
import { PixelText } from "./pixel-text";
import { SpeechBubble } from "./speech-bubble";
import { HERO_LINES, pickHeroLine } from "./speech-lines";

/** 대문 개미는 늘 가장 신난 단계다 — 손익과 무관한 간판이라 고정한다. */
const HERO_STAGE = STAGE_COUNT - 1;
/**
 * 대문 개미는 손익도 시간도 없는 간판이라, 결과 화면 말풍선(시간축)과 섞지 않고
 * 전용 풀(`HERO_LINES`)에서 뽑는다. 값은 마운트 내내 고정이다.
 */
const HERO_POOL = HERO_LINES;

/** 한마디를 띄워두는 시간과, 다음 말까지 잠깐 숨을 고르는 시간 (ms). */
const SPEAK_MS = 3600;
const HUSH_MS = 320; // .speech-bubble의 페이드(0.3s)와 맞춘다

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface HeroCandle {
  /** 몸통 높이 (px) */
  body: number;
  /** 위아래 심지 길이 (px) */
  wick: number;
  /** 오르내리는 폭 (px). 제자리에서 위로 이만큼, 아래로 이만큼 움직인다. */
  travel: number;
  /** 한 번 오르내리는 데 걸리는 시간 (s) */
  duration: number;
  /**
   * 시작 시각을 늦춰 옆 봉과 어긋나게 한다 (s).
   * 주기(2.5~3.5s) 전체에 고르게 흩뿌려야 어느 순간에나 오르는 봉과 내리는 봉이
   * 섞인다 — 좁게 몰아두면 열세 개가 한 몸처럼 같이 붉어졌다 파래진다.
   */
  delay: number;
}

/**
 * 대시보드의 장대봉(candle-scene)과 달리 이 봉들은 시세를 읽지 않는다 —
 * 분위기만 그리는 장식이라 값이 고정돼 있다. 렌더마다 새로 뽑으면 서버와
 * 클라이언트 마크업이 어긋난다.
 *
 * 가운데 세 봉(5~7번)을 낮게 잡은 건 그 자리에 개미가 서기 때문이다.
 */
const CANDLES: readonly HeroCandle[] = [
  { body: 26, wick: 7, travel: 12, duration: 3.1, delay: 0 },
  { body: 34, wick: 5, travel: 16, duration: 2.6, delay: 1.7 },
  { body: 18, wick: 8, travel: 10, duration: 3.4, delay: 0.6 },
  { body: 30, wick: 6, travel: 15, duration: 2.9, delay: 2.4 },
  { body: 22, wick: 7, travel: 11, duration: 3.2, delay: 1.1 },
  { body: 14, wick: 5, travel: 8, duration: 2.7, delay: 2.9 },
  { body: 12, wick: 4, travel: 7, duration: 3.0, delay: 0.3 },
  { body: 15, wick: 5, travel: 9, duration: 2.8, delay: 1.9 },
  { body: 24, wick: 8, travel: 13, duration: 3.3, delay: 0.9 },
  { body: 32, wick: 6, travel: 17, duration: 2.5, delay: 2.2 },
  { body: 20, wick: 7, travel: 11, duration: 3.1, delay: 1.4 },
  { body: 36, wick: 5, travel: 18, duration: 2.6, delay: 0.15 },
  { body: 28, wick: 6, travel: 14, duration: 3.5, delay: 2.6 },
];

/**
 * 앱의 대문. 봉차트가 아래위로 출렁이고 그 가운데에서 개미가 춤을 춘다.
 * 여기 개미는 상태 표시가 아니라 간판이라 손익을 읽지 않는다.
 */
export function Hero({ className }: { className?: string }) {
  // 서버는 늘 seed 0의 문장을 그리고, 클라이언트가 붙은 뒤 랜덤으로 갈아 끼운다
  // (마운트 전에 뽑으면 서버/클라 마크업이 어긋난다).
  const [line, setLine] = useState(() => pickHeroLine(0));
  const [visible, setVisible] = useState(false);

  // 마운트 후 랜덤 한마디를 띄우고, 잠깐씩 숨을 고르며 다른 말로 돌린다 —
  // 춤추는 간판이라 말도 살아 움직인다. 모션을 줄인 사용자에겐 한 번만 띄운다.
  useEffect(() => {
    let seed = Math.floor(Math.random() * 997);
    let timer: ReturnType<typeof setTimeout>;

    const speak = () => {
      setLine(pickHeroLine(seed));
      setVisible(true);
      if (prefersReducedMotion()) return;
      timer = setTimeout(hush, SPEAK_MS);
    };
    const hush = () => {
      setVisible(false);
      // 페이드가 끝난 빈 말풍선 동안 다음 문장을 고른다. 풀 크기보다 작은 값을
      // 더해 인덱스를 옮겨 같은 문장이 연달아 나오지 않게 한다.
      timer = setTimeout(() => {
        seed += 1 + Math.floor(Math.random() * (HERO_POOL.length - 1));
        speak();
      }, HUSH_MS);
    };

    speak();
    return () => clearTimeout(timer);
  }, []);

  return (
    <header className={`flex flex-col items-center gap-4 ${className ?? ""}`}>
      <div className="relative flex h-32 w-full items-center justify-center">
        <HeroCandles />

        {/*
          말풍선은 춤(transform)에서 떼어내 이 정적 상자에 건다 — .hero-ant 안에 넣으면
          개미와 함께 기울고 튀어 글자가 읽기 어려워진다. 상자 크기는 개미와 같다.
        */}
        <div className="relative z-10 h-24 w-24">
          <SpeechBubble text={line} visible={visible} />

          {/* 두 자세를 겹쳐두고 CSS가 번갈아 보여준다 — 손 흔드는 두 프레임이 춤이 된다. */}
          <div className="hero-ant relative h-full w-full" aria-hidden>
            <AntSprite stage={HERO_STAGE} pose="wave1" className="hero-ant-frame" />
            <AntSprite
              stage={HERO_STAGE}
              pose="wave2"
              className="hero-ant-frame hero-ant-frame-b"
            />
          </div>
        </div>
      </div>

      <h1>
        <PixelText text="영-차! 개미들아" className="h-7 w-auto" />
      </h1>

      <p className="text-center text-sm text-[color:var(--muted)]">
        내 주식, 몇 시간 더 일하면 본전일까?
      </p>
    </header>
  );
}

function HeroCandles() {
  return (
    <div className="hero-candles absolute inset-0 flex items-center gap-1.5" aria-hidden>
      {CANDLES.map((candle, index) => (
        <span
          key={index}
          className="hero-candle"
          style={
            {
              "--hero-candle-travel": `${candle.travel}px`,
              "--hero-candle-duration": `${candle.duration}s`,
              "--hero-candle-delay": `${candle.delay}s`,
            } as CSSProperties
          }
        >
          <span className="hero-candle-wick" style={{ height: candle.wick }} />
          <span className="hero-candle-body" style={{ height: candle.body }} />
          <span className="hero-candle-wick" style={{ height: candle.wick }} />
        </span>
      ))}
    </div>
  );
}
