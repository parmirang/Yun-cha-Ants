import { type Mood, candleScale, sceneLevelFromStage } from "@yca/shared";

import { BRAND, SHARE_TAGLINE } from "@/lib/share-copy";

import { antDataUri } from "./ant-sprite";

/**
 * SNS 링크 미리보기에 실리는 카드(1200×630).
 *
 * **화면에 뜨는 그 무대를 그대로 굽는다** — 밤하늘/땅, 지평선에서 뻗는 장대봉,
 * 그 옆에 서서 말풍선을 띄운 개미. 카드용 그림을 따로 그리지 않는 건 공유받은
 * 사람이 링크를 열었을 때 같은 장면을 만나야 하기 때문이다.
 *
 * 다만 카드는 **정지 화면**이라 앱과 세 가지가 다르다.
 * 1. 지평선이 손익 방향을 따라 움직인다 (`HORIZON`). 앱은 늘 한가운데에 두고
 *    수익일 때만 카메라를 내리지만, 카드는 봉이 뻗는 쪽에 높이를 몰아줘야
 *    한 컷에서 봉이 길어 보인다.
 * 2. 개미에게 최소 크기를 크게 잡는다. 앱은 줌아웃에 맡겨 개미가 작아지지만,
 *    카드는 타임라인에서 절반 크기로 줄어든 채 보이므로 그때도 개미로 읽혀야 한다.
 * 3. 연출(비·폭죽)은 한 프레임으로 멈춰 그린다.
 *
 * satori는 flex만 알고 filter/애니메이션을 모른다. 그래서 좌표를 미리 계산해
 * 절대배치로 박고, 흐림 효과가 필요한 구름은 그냥 또렷한 알약으로 둔다.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const W = OG_SIZE.width;
const H = OG_SIZE.height;

const COLOR = {
  fg: "#f3ece2",
  muted: "#9c8f7e",
  up: "#ff5c5c",
  down: "#5c9dff",
  line: "#4a3722",
  ink: "#1a1410",
};

/** 바닥선의 높이. 손실은 봉이 아래로 뻗으니 지평선을 위로 올려 자리를 만든다. */
const HORIZON: Record<Mood, number> = { loss: 300, even: 430, profit: 470 };
/** 봉이 뻗는 쪽 끝에 남기는 여백 — 위쪽은 말풍선이 들어갈 자리이기도 하다. */
const TOP_ROOM = 108;
const BOTTOM_ROOM = 64;
/** 씨앗(1:1) 상태에서 봉 한 변의 최대 픽셀 — 몇 분짜리 손익이 정사각형 판때기가 되지 않게 */
const MAX_UNIT = 112;
/** 미리보기가 절반으로 줄어도 개미로 읽히는 하한 */
const MIN_ANT = 92;
/** 봉의 중심 x — 왼쪽 절반은 글자가 쓴다 */
const CANDLE_X = 852;

/** 픽셀 폰트라 글자 크기는 11의 배수로 잡는다 — 어긋나면 획 굵기가 들쭉날쭉해진다. */
const FONT = { brand: 22, eyebrow: 33, headline: 55, foot: 22, tagline: 33, speech: 33 };

export interface OgCardProps {
  mood: Mood;
  /** 개미 단계 0..49 — 껍질 색과 배경 날씨가 여기서 나온다 */
  stage: number;
  /** 손익 시간(초) — 봉 길이를 정한다 */
  seconds: number;
  /** 개미 말풍선 */
  speech: string;
  /** 큰 글씨 위의 작은 줄 (종목명) */
  eyebrow?: string;
  /** 큰 글씨. 첫 줄은 손익 색, 나머지는 흰색 */
  headline: readonly string[];
  /** 큰 글씨 아래 작은 줄 (정확한 시계) */
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
  const moodColor = mood === "profit" ? COLOR.up : mood === "loss" ? COLOR.down : COLOR.fg;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: W,
        height: H,
        background: "#0d1626",
        color: COLOR.fg,
        fontFamily: "Galmuri11",
      }}
    >
      <Scene mood={mood} stage={stage} seconds={seconds} speech={speech} />

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
          style={{ display: "flex", fontSize: FONT.brand, color: COLOR.muted, letterSpacing: 3 }}
        >
          {BRAND}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: FONT.eyebrow,
                color: COLOR.muted,
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
                color: index === 0 ? moodColor : COLOR.fg,
              }}
            >
              {line}
            </div>
          ))}

          {footnote ? (
            <div
              style={{ display: "flex", fontSize: FONT.foot, color: COLOR.muted, marginTop: 18 }}
            >
              {footnote}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: FONT.tagline, color: COLOR.fg }}>
          {SHARE_TAGLINE}
        </div>
      </div>
    </div>
  );
}

function Scene({
  mood,
  stage,
  seconds,
  speech,
}: Pick<OgCardProps, "mood" | "stage" | "seconds" | "speech">) {
  const horizon = HORIZON[mood];
  const downward = mood === "loss";
  // 봉이 뻗어나갈 수 있는 높이. 이 안에 들어오도록 배율(unit)을 정하는 건 앱과 같다.
  const room = downward ? H - horizon - BOTTOM_ROOM : horizon - TOP_ROOM;

  const scale = candleScale(seconds);
  const unit = Math.min(MAX_UNIT, room / scale);
  const candleW = Math.round(Math.max(16, unit));
  const candleH = Math.round(Math.min(room, unit * scale));
  const antSize = Math.round(Math.max(MIN_ANT, unit * 0.95));
  // 개미는 봉 오른쪽에 붙어 서서 봉을 바라본다 (스프라이트는 오른쪽을 보므로 뒤집는다).
  const antCenter = Math.round(CANDLE_X + candleW / 2 + antSize / 2 + 12);
  const moodColor = mood === "profit" ? COLOR.up : mood === "loss" ? COLOR.down : COLOR.muted;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: horizon,
          display: "flex",
          background: "linear-gradient(to bottom, #0d1626, #131b28)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: horizon,
          width: W,
          height: H - horizon,
          display: "flex",
          /*
           * 앱보다 어두운 땅이다. 화면에서는 땅이 아래 절반뿐이지만 카드에서는
           * 손실일 때 지평선이 올라가 절반을 넘게 먹는다 — 앱의 밝기(#241a12)를
           * 그대로 쓰면 갈색 벽이 되고 글자가 그 위에 뜬다.
           */
          background: "linear-gradient(to bottom, #1b1410, #0b0806)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: horizon - 1,
          width: W,
          height: 2,
          display: "flex",
          background: COLOR.line,
        }}
      />

      <Weather level={sceneLevelFromStage(stage)} skyHeight={horizon} />

      <div
        style={{
          position: "absolute",
          left: CANDLE_X - Math.round(candleW / 2),
          top: downward ? horizon : horizon - candleH,
          width: candleW,
          height: candleH,
          display: "flex",
          borderRadius: 3,
          background: moodColor,
          boxShadow: `0 0 90px -10px ${moodColor}`,
        }}
      />

      {/*
        말풍선을 개미 머리 위에 세로로 쌓고 가운데를 맞춘다. satori에는 %translate가
        없어서, 왼쪽 끝에서 시작해 **개미 중심의 두 배**를 폭으로 주면 상자의 한가운데가
        곧 개미 자리가 된다. 오른쪽으로 삐져나간 만큼은 카드 밖이라 그려지지 않는다.
      */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: antCenter * 2,
          height: horizon,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "12px 20px 14px",
              borderRadius: 10,
              background: COLOR.fg,
              color: COLOR.ink,
              fontSize: FONT.speech,
            }}
          >
            {speech}
          </div>
          {/* 꼬리 — 45도로 돌린 정사각형을 말풍선 아래로 반쯤 밀어 넣는다 */}
          <div
            style={{
              width: 20,
              height: 20,
              marginTop: -11,
              display: "flex",
              background: COLOR.fg,
              transform: "rotate(45deg)",
            }}
          />
        </div>

        {/*
          `wave1`은 첫 줄부터 그림이 차 있어 스프라이트 상자 위가 곧 머리 위다 —
          말풍선을 따로 내려 붙일 필요가 없다 (`antTopOffset`이 0).
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={antDataUri(stage, "wave1")}
          width={antSize}
          height={antSize}
          style={{ transform: "scaleX(-1)" }}
          alt=""
        />
      </div>
    </>
  );
}

/**
 * 하늘에 걸리는 연출 한 프레임. 움직이지 않는다.
 *
 * **무대 쪽 하늘에만 친다.** 글자 위로 넘어오면 폭죽 조각이 종목명 뒤에 박혀
 * 글씨가 지저분해진다 — 어차피 축하도 비도 개미와 봉 주변의 일이다.
 */
function Weather({ level, skyHeight }: { level: number; skyHeight: number }) {
  const boxLeft = 560;
  const boxWidth = W - boxLeft;

  const clouds = level <= -1;
  // 폭우는 빗줄기를 더 촘촘히 세워 표현한다. 번개는 **안 그린다** — 번쩍임은 시간
  // 위에서만 성립하고, 한 프레임에 담으면 하늘 한쪽이 그냥 밝은 판이 된다.
  const rain = level <= -2 ? (level <= -3 ? RAIN_HEAVY : RAIN) : null;
  const sparks = level >= 1;
  const bursts = level >= 2 ? (level >= 3 ? 4 : 2) : 0;

  const x = (percent: number) => (percent / 100) * boxWidth;
  const y = (percent: number) => (percent / 100) * skyHeight;

  return (
    <div
      style={{
        position: "absolute",
        left: boxLeft,
        top: 0,
        width: boxWidth,
        height: skyHeight,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {clouds
        ? CLOUDS.map((cloud) => (
            <div
              key={`c${cloud.left}`}
              style={{
                position: "absolute",
                left: x(cloud.left),
                top: y(cloud.top),
                width: x(cloud.w),
                height: Math.round(skyHeight * 0.26),
                display: "flex",
                /*
                 * 앱은 blur로 뭉갠 구름이지만 satori에는 filter가 없다. 방사형
                 * 그라데이션은 satori가 상자째 칠해버려 네모난 구름이 되므로,
                 * 둥근 알약에 세로 그라데이션을 얹어 아래로 흐려지게만 둔다.
                 */
                borderRadius: 999,
                background:
                  "linear-gradient(to bottom, rgba(62,70,88,0.85), rgba(62,70,88,0.12))",
              }}
            />
          ))
        : null}

      {rain
        ? rain.map((left, index) => (
            <div
              key={`r${left}`}
              style={{
                position: "absolute",
                left: x(left),
                // 줄기마다 높이를 어긋나게 둔다 — 한 줄로 맞으면 빗줄기가 아니라 빗살무늬다.
                top: (index % 4) * 26,
                width: 3,
                height: Math.round(skyHeight * 0.26),
                display: "flex",
                borderRadius: 2,
                background: "linear-gradient(to bottom, rgba(111,143,196,0), #6f8fc4)",
                opacity: 0.5,
              }}
            />
          ))
        : null}

      {sparks
        ? SPARKS.map((spark) => (
            <div
              key={`s${spark.left}`}
              style={{
                position: "absolute",
                left: x(spark.left),
                top: y(spark.top),
                width: 10,
                height: 10,
                display: "flex",
                borderRadius: 2,
                background: "#ffe9a8",
              }}
            />
          ))
        : null}

      {FIREWORKS.slice(0, bursts).flatMap((shot) =>
        BURST_ANGLES.map((angle, index) => {
          const radians = (angle * Math.PI) / 180;
          // 조각마다 날아간 거리를 어긋나게 둔다 — 같은 반지름으로 세우면 터지는
          // 폭죽이 아니라 점으로 그린 동그라미가 된다.
          const radius = index % 2 === 0 ? 46 : 30;
          const dot = index % 2 === 0 ? 11 : 8;

          return (
            <div
              key={`f${shot.left}-${angle}`}
              style={{
                position: "absolute",
                // 각도와 반지름으로 조각 좌표를 미리 계산한다 — 회전 transform을
                // 쓰면 satori에서 여덟 조각이 제자리에 겹친다.
                left: x(shot.left) + Math.sin(radians) * radius - dot / 2,
                top: y(shot.top) - Math.cos(radians) * radius - dot / 2,
                width: dot,
                height: dot,
                display: "flex",
                borderRadius: 999,
                background: index % 2 === 0 ? COLOR.up : "#ffd24a",
              }}
            />
          );
        }),
      )}
    </div>
  );
}

/* 좌표는 무대 쪽 하늘 상자(오른쪽 640px) 기준 %다. */
const CLOUDS = [
  { left: 0, top: 8, w: 46 },
  { left: 42, top: 0, w: 54 },
  { left: 18, top: 34, w: 38 },
];
const RAIN = [4, 21, 37, 54, 71, 87];
const RAIN_HEAVY = [4, 13, 21, 29, 37, 46, 54, 62, 71, 79, 87, 94];
const SPARKS = [
  { left: 8, top: 46 },
  { left: 30, top: 16 },
  { left: 58, top: 56 },
  { left: 74, top: 24 },
  { left: 92, top: 62 },
];
const FIREWORKS = [
  { left: 16, top: 34 },
  { left: 68, top: 22 },
  { left: 42, top: 62 },
  { left: 88, top: 44 },
];
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
