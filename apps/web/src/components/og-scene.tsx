import { type Mood, candleScale, sceneLevelFromStage } from "@yca/shared";

import { antDataUri } from "./ant-sprite";

/**
 * 굽는 이미지(OG 카드·인스타 스토리)에 들어가는 **정지 무대**.
 *
 * 밤하늘/땅, 지평선에서 뻗는 장대봉, 그 옆에서 말풍선을 띄운 개미 — 화면의
 * `CandleScene`과 같은 장면이다. 이미지용 그림을 따로 그리지 않는 건 공유받은 사람이
 * 링크를 열었을 때 같은 장면을 만나야 하기 때문이다. 크기만 받아서 어떤 판형이든
 * 같은 규칙으로 그린다 — **판형마다 무대를 새로 짜지 말 것.**
 *
 * 화면과 다른 건 셋이다.
 * 1. 지평선이 손익 방향을 따라 움직인다 (`HORIZON`). 화면은 늘 한가운데에 두고
 *    수익일 때만 카메라를 내리지만, 한 컷에서 봉이 길어 보이려면 봉이 뻗는 쪽에
 *    높이를 몰아줘야 한다.
 * 2. 개미 최소 크기가 크다. 화면은 줌아웃에 맡겨 개미가 작아지지만, 이미지는
 *    타임라인에서 절반으로 줄어든 채 보이므로 그때도 개미로 읽혀야 한다.
 * 3. 연출(비·폭죽)은 한 프레임으로 멈춰 그린다.
 *
 * **satori는 flex만 알고 filter도 애니메이션도 모른다.** 회전 transform도 못 믿으니
 * 폭죽 조각 좌표는 sin/cos로 미리 계산해 절대배치한다. 구름의 blur는 둥근 알약 +
 * 세로 그라데이션으로 흉내 낸다 (radial-gradient는 상자째 칠해져 네모난 구름이 된다).
 */

export const SCENE_COLOR = {
  fg: "#f3ece2",
  muted: "#9c8f7e",
  up: "#ff5c5c",
  down: "#5c9dff",
  line: "#4a3722",
  ink: "#1a1410",
  bg: "#14100c",
  sky: "#0d1626",
};

/** 지평선 높이 (무대 높이 대비 0~1) */
const HORIZON: Record<Mood, number> = { loss: 0.48, even: 0.68, profit: 0.75 };
/** 봉이 뻗는 쪽 끝에 남기는 여백 — 위쪽은 말풍선이 들어갈 자리이기도 하다 */
const TOP_ROOM = 0.17;
const BOTTOM_ROOM = 0.1;
/** 씨앗(1:1) 상태에서 봉 한 변의 최대 크기 — 몇 분짜리 손익이 정사각형 판때기가 되지 않게 */
const MAX_UNIT = 0.18;
/** 미리보기가 절반으로 줄어도 개미로 읽히는 하한 */
const MIN_ANT = 0.146;
const ANT_UNIT_RATIO = 0.95;

/**
 * 픽셀 폰트라 글자 크기는 **11의 배수**로 잡는다 — 어긋나면 획 굵기가 들쭉날쭉해진다.
 * 판형이 달라져도 이 규칙은 유지한 채 비율로만 키운다.
 */
export function pixelFont(base: number, ratio: number): number {
  return Math.max(11, Math.round((base * ratio) / 11) * 11);
}

export function moodColor(mood: Mood): string {
  return mood === "profit"
    ? SCENE_COLOR.up
    : mood === "loss"
      ? SCENE_COLOR.down
      : SCENE_COLOR.fg;
}

export interface OgSceneProps {
  width: number;
  height: number;
  mood: Mood;
  /** 개미 단계 0..49 — 껍질 색과 배경 날씨가 여기서 나온다 */
  stage: number;
  /** 손익 시간(초) — 봉 길이를 정한다 */
  seconds: number;
  /** 개미 말풍선 */
  speech: string;
  /** 봉 중심의 가로 위치 (0~1). 옆에 글자가 앉는 판형은 한쪽으로 민다. */
  candleX?: number;
  /** 날씨를 그리기 시작하는 가로 위치 (0~1). 글자 위로 안 넘어오게 자를 때 쓴다. */
  weatherLeft?: number;
  borderRadius?: number;
}

export function OgScene({
  width,
  height,
  mood,
  stage,
  seconds,
  speech,
  candleX = 0.5,
  weatherLeft = 0,
  borderRadius = 0,
}: OgSceneProps) {
  const horizon = Math.round(height * HORIZON[mood]);
  const downward = mood === "loss";
  // 봉이 뻗어나갈 수 있는 높이. 이 안에 들어오도록 배율(unit)을 정하는 건 화면과 같다.
  const room = downward
    ? height - horizon - height * BOTTOM_ROOM
    : horizon - height * TOP_ROOM;

  const scale = candleScale(seconds);
  const unit = Math.min(height * MAX_UNIT, room / scale);
  const candleW = Math.round(Math.max(height * 0.025, unit));
  const candleH = Math.round(Math.min(room, unit * scale));
  const antSize = Math.round(Math.max(height * MIN_ANT, unit * ANT_UNIT_RATIO));
  const center = width * candleX;
  // 개미는 봉 오른쪽에 붙어 서서 봉을 바라본다 (스프라이트는 오른쪽을 보므로 뒤집는다).
  const antCenter = Math.round(center + candleW / 2 + antSize / 2 + height * 0.02);
  const bar = mood === "even" ? SCENE_COLOR.muted : moodColor(mood);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        display: "flex",
        overflow: "hidden",
        borderRadius,
        background: SCENE_COLOR.sky,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
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
          width,
          height: height - horizon,
          display: "flex",
          /*
           * 화면보다 어두운 땅이다. 화면에서는 땅이 아래 절반뿐이지만 이미지에서는
           * 손실일 때 지평선이 올라가 절반을 넘게 먹는다 — 화면의 밝기(#241a12)를
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
          width,
          height: 2,
          display: "flex",
          background: SCENE_COLOR.line,
        }}
      />

      <Weather
        level={sceneLevelFromStage(stage)}
        width={width}
        skyHeight={horizon}
        left={Math.round(width * weatherLeft)}
        scale={height / 630}
      />

      <div
        style={{
          position: "absolute",
          left: Math.round(center - candleW / 2),
          top: downward ? horizon : horizon - candleH,
          width: candleW,
          height: candleH,
          display: "flex",
          borderRadius: 3,
          background: bar,
          boxShadow: `0 0 ${Math.round(height * 0.14)}px -10px ${bar}`,
        }}
      />

      {/*
        말풍선을 개미 머리 위에 세로로 쌓고 가운데를 맞춘다. satori에는 %translate가
        없어서, 왼쪽 끝에서 시작해 **개미 중심의 두 배**를 폭으로 주면 상자의 한가운데가
        곧 개미 자리가 된다. 오른쪽으로 삐져나간 만큼은 무대 밖이라 그려지지 않는다.
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
            marginBottom: Math.round(height * 0.019),
          }}
        >
          <div
            style={{
              display: "flex",
              padding: `${Math.round(height * 0.019)}px ${Math.round(height * 0.032)}px ${Math.round(height * 0.022)}px`,
              borderRadius: Math.round(height * 0.016),
              background: SCENE_COLOR.fg,
              color: SCENE_COLOR.ink,
              fontSize: pixelFont(height, 0.052),
            }}
          >
            {speech}
          </div>
          {/* 꼬리 — 45도로 돌린 정사각형을 말풍선 아래로 반쯤 밀어 넣는다 */}
          <div
            style={{
              width: Math.round(height * 0.032),
              height: Math.round(height * 0.032),
              marginTop: -Math.round(height * 0.017),
              display: "flex",
              background: SCENE_COLOR.fg,
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
    </div>
  );
}

/**
 * 하늘에 걸리는 연출 한 프레임. 움직이지 않는다.
 *
 * `left`부터 오른쪽 끝까지만 친다 — 글자가 앉는 판형에서 폭죽 조각이 종목명 뒤에
 * 박히면 글씨가 지저분해진다. 어차피 축하도 비도 개미와 봉 주변의 일이다.
 */
function Weather({
  level,
  width,
  skyHeight,
  left,
  scale,
}: {
  level: number;
  width: number;
  skyHeight: number;
  left: number;
  scale: number;
}) {
  const boxWidth = width - left;

  const clouds = level <= -1;
  // 폭우는 빗줄기를 더 촘촘히 세워 표현한다. 번개는 **안 그린다** — 번쩍임은 시간
  // 위에서만 성립하고, 한 프레임에 담으면 하늘 한쪽이 그냥 밝은 판이 된다.
  const rain = level <= -2 ? (level <= -3 ? RAIN_HEAVY : RAIN) : null;
  const sparks = level >= 1;
  const bursts = level >= 2 ? (level >= 3 ? 4 : 2) : 0;

  const x = (percent: number) => (percent / 100) * boxWidth;
  const y = (percent: number) => (percent / 100) * skyHeight;
  const px = (value: number) => Math.round(value * scale);

  return (
    <div
      style={{
        position: "absolute",
        left,
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
                borderRadius: 999,
                background:
                  "linear-gradient(to bottom, rgba(62,70,88,0.85), rgba(62,70,88,0.12))",
              }}
            />
          ))
        : null}

      {rain
        ? rain.map((streak, index) => (
            <div
              key={`r${streak}`}
              style={{
                position: "absolute",
                left: x(streak),
                // 줄기마다 높이를 어긋나게 둔다 — 한 줄로 맞으면 빗줄기가 아니라 빗살무늬다.
                top: px((index % 4) * 26),
                width: px(3),
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
                width: px(10),
                height: px(10),
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
          const radius = px(index % 2 === 0 ? 46 : 30);
          const dot = px(index % 2 === 0 ? 11 : 8);

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
                background: index % 2 === 0 ? SCENE_COLOR.up : "#ffd24a",
              }}
            />
          );
        }),
      )}
    </div>
  );
}

/* 좌표는 날씨 상자 기준 %다. */
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
