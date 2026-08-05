import type { Mood } from "@yca/shared";

import { BRAND, SHARE_TAGLINE } from "@/lib/share-copy";

import { OgScene, SCENE_COLOR, moodColor, pixelFont } from "./og-scene";

/**
 * SNS 링크 미리보기에 실리는 가로 카드(1200×630).
 *
 * 무대는 [og-scene.tsx](og-scene.tsx)가 그리고, 여기서는 그 위에 글자를 얹는
 * **판형**만 맡는다 — 인스타 세로 카드([story-card.tsx](story-card.tsx))와 같은
 * 무대를 쓰는 게 핵심이다. 가로라서 글자는 왼쪽, 무대는 오른쪽으로 갈라 앉힌다.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const W = OG_SIZE.width;
const H = OG_SIZE.height;

/** 무대 안에서 봉이 설 자리 — 왼쪽 절반은 글자가 쓴다 */
const CANDLE_X = 0.71;
/** 날씨도 글자를 피해 오른쪽에만 친다 */
const WEATHER_LEFT = 0.47;

const FONT = {
  brand: pixelFont(H, 0.035),
  eyebrow: pixelFont(H, 0.052),
  headline: pixelFont(H, 0.087),
  foot: pixelFont(H, 0.035),
  tagline: pixelFont(H, 0.052),
};

export interface OgCardProps {
  mood: Mood;
  stage: number;
  seconds: number;
  speech: string;
  /** 큰 글씨 위의 작은 줄 (종목명) */
  eyebrow?: string;
  /** 큰 글씨. 첫 줄은 손익 색, 나머지는 흰색 */
  headline: readonly string[];
  /** 큰 글씨 아래 작은 줄 (총 몇 시간) */
  footnote?: string;
}

export function OgCard({
  mood,
  stage,
  seconds,
  speech,
  eyebrow,
  headline,
  footnote,
}: OgCardProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: W,
        height: H,
        background: SCENE_COLOR.sky,
        color: SCENE_COLOR.fg,
        fontFamily: "Galmuri11",
      }}
    >
      <OgScene
        width={W}
        height={H}
        mood={mood}
        stage={stage}
        seconds={seconds}
        speech={speech}
        candleX={CANDLE_X}
        weatherLeft={WEATHER_LEFT}
      />

      {/*
        글자가 앉을 왼쪽을 어둡게 눌러둔다. 지평선이 손익에 따라 오르내리는 탓에
        하늘/땅 경계가 글줄을 가로지를 수 있는데, 이 막이 있으면 어디를 지나든
        글자 뒤는 늘 어두운 한 톤이다. 봉과 개미가 있는 오른쪽에서는 걷힌다.
      */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          display: "flex",
          background:
            "linear-gradient(to right, rgba(10,8,6,0.93) 0%, rgba(10,8,6,0.86) 38%, rgba(10,8,6,0) 62%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 72,
          top: 60,
          width: 690,
          height: H - 120,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: FONT.brand,
            color: SCENE_COLOR.muted,
            letterSpacing: 3,
          }}
        >
          {BRAND}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: FONT.eyebrow,
                color: SCENE_COLOR.muted,
                marginBottom: 14,
              }}
            >
              {eyebrow}
            </div>
          ) : null}

          {headline.map((line, index) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontSize: FONT.headline,
                lineHeight: 1.32,
                color: index === 0 ? moodColor(mood) : SCENE_COLOR.fg,
              }}
            >
              {line}
            </div>
          ))}

          {footnote ? (
            <div
              style={{
                display: "flex",
                fontSize: FONT.foot,
                color: SCENE_COLOR.muted,
                marginTop: 18,
              }}
            >
              {footnote}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: FONT.tagline, color: SCENE_COLOR.fg }}>
          {SHARE_TAGLINE}
        </div>
      </div>
    </div>
  );
}
