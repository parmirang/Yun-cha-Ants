"use client";

import { BREAKEVEN_STAGE } from "@yca/shared";
import { useState } from "react";

import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";

import { antDataUri, antPalette } from "./ant-sprite";

/** "오늘 다시 보지 않음"의 '오늘' — 기기 시간대 기준 날짜 도장. */
export function todayStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * 앱에 들어올 때마다 뜨는 개인정보 안내 바텀시트.
 * "오늘 다시 보지 않음"을 체크하고 닫으면 그날 하루는 안 뜬다.
 *
 * 연봉을 적으라는 화면 앞에서 사람이 먼저 품는 의문이 "이거 어디로 가는 거 아냐?"라서,
 * 입력을 시키기 전에 답부터 한다 — 인스타 내보내기 시트의 제목("걱정마, 다른 정보는
 * 절대 공유되지 않아!")과 같은 이유, 같은 자리다.
 *
 * 여닫는 상태와 날짜 저장은 부르는 쪽(Onboarding)이 쥔다 — 여기는 체크 여부만 넘긴다.
 */
export function PrivacyNoticeSheet({
  onClose,
}: {
  /** hideToday: 닫는 순간 "오늘 다시 보지 않음"이 체크돼 있었나. */
  onClose: (hideToday: boolean) => void;
}) {
  const [hideToday, setHideToday] = useState(false);

  useLockedBodyScroll();

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => onClose(hideToday)}>
      <div
        className="w-full rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-center text-lg font-bold">
          걱정마세요
          <br />
          개인정보는 안전하게 보호돼요.
        </h2>

        <p className="mt-3 text-center text-sm leading-relaxed text-[color:var(--muted)]">
          입력한 개인정보는 절대로 외부에 공유되지 않아요.
          <br />
          <span className="text-[color:var(--fg)]">
            정보 수집에 사용되지 않으며,
            <br />
            이 폰 밖으로는 절대 나가지 않아요.
          </span>
        </p>

        <ShieldAnt />

        <label className="mt-5 flex items-center justify-center gap-2 text-sm text-[color:var(--muted)]">
          <input
            type="checkbox"
            className="size-4 accent-[color:var(--up)]"
            checked={hideToday}
            onChange={(event) => setHideToday(event.target.checked)}
          />
          오늘 다시 보지 않음
        </label>

        <button type="button" className="btn-primary mt-3 w-full" onClick={() => onClose(hideToday)}>
          🐜 시작하기
        </button>
      </div>
    </div>
  );
}

/*
 * 방패 픽셀맵 (9×11). 개미와 같은 방식 — 문자맵을 <rect>로 찍는다.
 *  O 테두리   F 몸판   G 광택
 */
const SHIELD_MAP = [
  ".OOOOOOO.",
  "OFFFFFFFO",
  "OFGGFFFFO",
  "OFGFFFFFO",
  "OFFFFFFFO",
  "OFFFFFFFO",
  ".OFFFFFO.",
  ".OFFFFFO.",
  "..OFFFO..",
  "...OFO...",
  "....O....",
] as const;

/* 손익색(빨강/파랑)을 피해 강조색 계열의 금빛 — "지켜준다"는 알림의 색이다. */
const SHIELD_COLORS: Record<string, string> = {
  O: "#7c5b26",
  F: "#ffcf5c",
  G: "#ffe9a8",
};

/** 개미를 무대 안에서 오른쪽으로 미는 칸수 — 왼쪽에 칼이 설 자리를 비운다. */
const ANT_X = 3;

/** 방패가 개미 앞(오른쪽)에 서는 위치 — 개미 16칸 격자 기준. */
const SHIELD_X = 11;
const SHIELD_Y = 5;

/*
 * 양봉 칼 픽셀맵 (5×13) — 장대 양봉이 그대로 검이 된다. 위아래 꼬리(w)가 달린
 * 빨간 몸통(b)이 칼날이고, 가드(g)는 방패와 같은 금빛, 자루(h)는 땅색이다.
 */
const SWORD_MAP = [
  "..w..",
  "..w..",
  ".bbb.",
  ".bbb.",
  ".bbb.",
  ".bbb.",
  ".bbb.",
  ".bbb.",
  "..w..",
  "ggggg",
  "..h..",
  "..h..",
  "..h..",
] as const;

const SWORD_COLORS: Record<string, string> = {
  w: "#c74848",
  b: "#ff5c5c", // --up과 같은 값 — 수익의 빨강이 칼날이 된다
  g: "#7c5b26",
  h: "#4a3722",
};

/** 반짝이 위치·박자. 박자를 어긋내야 하나가 꺼질 때 다른 하나가 켜진다. */
const SPARKS = [
  { top: "4%", left: "66%", delay: "0s" },
  { top: "38%", left: "93%", delay: "0.9s" },
  { top: "66%", left: "62%", delay: "1.6s" },
] as const;

/** 문자맵을 1×1 <rect>들로 찍는다 — 방패와 칼이 같은 방식을 쓴다. */
function PixelRects({
  map,
  colors,
  offsetX = 0,
  offsetY = 0,
}: {
  map: readonly string[];
  colors: Record<string, string>;
  offsetX?: number;
  offsetY?: number;
}) {
  return (
    <>
      {map.flatMap((row, y) =>
        [...row].map((char, x) => {
          const fill = colors[char];
          if (!fill) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={offsetX + x}
              y={offsetY + y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        }),
      )}
    </>
  );
}

/**
 * 방패와 양봉 칼을 든 개미. 개미는 대기 화면과 같은 본전 단계(중립색)로 세우고,
 * 방패는 앞(오른손)에 겹치고 칼은 왼손 쪽에 따로 띄워 "들고 있는" 모양을 만든다 —
 * 새 자세를 그리지 않는다. 칼만 딴 SVG인 건 저 혼자 아래위로 흔들리기 때문이다.
 */
function ShieldAnt() {
  const limb = antPalette(BREAKEVEN_STAGE).limb;

  return (
    <div className="relative mx-auto mt-5 w-44" style={{ aspectRatio: "23 / 16" }}>
      <svg
        viewBox="0 0 23 16"
        shapeRendering="crispEdges"
        className="h-full w-full"
        role="img"
        aria-label="반짝이는 방패와 양봉 칼을 든 개미"
      >
        {/* 개미를 오른쪽으로 밀어(ANT_X) 왼쪽에 칼 자리를 비운다 — 몸 옆에 바짝
            세우면 칼이 몸이랑 겹쳐 안 보인다. */}
        <image
          href={antDataUri(BREAKEVEN_STAGE, "stand")}
          x={ANT_X}
          y="0"
          width="16"
          height="16"
        />
        {/*
          칼 잡은 왼팔을 **옆으로** 뻗는다 — 서 있는 자세의 팔은 몸에 붙어 y9에서 끝나,
          몸에서 떨어진 칼자루에 안 닿는다. 공용 스프라이트(stand)는 대문·무대가 같이
          쓰므로 건드리지 않고 여기서만 같은 팔레트의 팔 색으로 덧그린다.

          칼과 **같은 애니메이션**을 걸어 팔이 칼을 흔드는 것처럼 보이게 한다 —
          어깨 쪽은 몸에 붙어 있고 이 뻗은 토막만 움직이므로, 휘두르는 팔로 읽힌다.
        */}
        <g className="candle-sword-arm">
          <rect x={5} y={9} width={1} height={1} fill={limb} />
          <rect x={4} y={10} width={1} height={1} fill={limb} />
          <rect x={4} y={11} width={1} height={1} fill={limb} />
        </g>
        <PixelRects
          map={SHIELD_MAP}
          colors={SHIELD_COLORS}
          offsetX={ANT_X + SHIELD_X}
          offsetY={SHIELD_Y}
        />
      </svg>

      {/* 왼손의 양봉 칼 — 뻗은 손끝(x≈4, y≈10.5)에 자루가 오도록, 몸에서 떨어진
          왼쪽 빈자리에 세운다. 크기·위치는 흔들리는 중에도 상자 안에 다 들어오게
          잡았다 — 칼끝이 위로 삐져나가면 서브카피를 찌른다. */}
      <svg
        className="candle-sword"
        style={{ left: "9%", bottom: "25%", width: "16%" }}
        viewBox="0 0 5 13"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <PixelRects map={SWORD_MAP} colors={SWORD_COLORS} />
      </svg>

      {SPARKS.map((spark) => (
        <span
          key={spark.delay}
          className="shield-spark"
          style={{ top: spark.top, left: spark.left, animationDelay: spark.delay }}
          aria-hidden
        />
      ))}
    </div>
  );
}
