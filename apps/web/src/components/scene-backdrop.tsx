import type { CSSProperties } from "react";

import type { SceneLevel } from "@yca/shared";

/**
 * 손익 레벨(-3 ~ +3)에 따른 배경 연출.
 *
 * 전부 바닥선 위(하늘)에만 그린다 — 땅속에 비가 내리거나 폭죽이 터지면 이상하다.
 * `.scene-sky`가 위쪽 절반을 잘라내므로 좌표(%)는 **하늘 기준**이다.
 *
 * 위치는 전부 하드코딩된 상수 배열이다 — 렌더마다 Math.random()을 돌리면
 * 서버와 클라이언트가 다른 걸 그려서 하이드레이션이 깨진다.
 */

const RAIN = [4, 13, 21, 29, 37, 46, 54, 62, 71, 79, 87, 94];
const HEAVY_RAIN = [2, 8, 14, 19, 25, 31, 36, 42, 48, 53, 59, 65, 70, 76, 82, 88, 93, 97];
const CLOUDS = [
  { left: 6, top: 14, w: 42, d: 0 },
  { left: 52, top: 5, w: 38, d: -7 },
  { left: 28, top: 32, w: 30, d: -13 },
];
const SPARKS = [
  { left: 14, top: 44 },
  { left: 32, top: 20 },
  { left: 58, top: 56 },
  { left: 76, top: 28 },
  { left: 88, top: 68 },
];
const FIREWORKS = [
  { left: 22, top: 40, d: 0 },
  { left: 70, top: 26, d: -1.6 },
  { left: 46, top: 60, d: -3.1 },
  { left: 84, top: 50, d: -2.3 },
];
const CONFETTI = [7, 16, 24, 33, 41, 50, 58, 67, 75, 84, 92];

/**
 * 폭죽 한 발 — 가운데에서 사방으로 튀는 8조각.
 *
 * 각도는 `--angle`로 넘긴다. `transform: rotate()`와 `translate:`를 따로 쓰면
 * CSS가 translate를 **회전 전에** 적용해서 여덟 조각이 전부 똑바로 위로만 날아간다.
 * 회전과 이동을 같은 transform 안에 넣어야 방사형으로 퍼진다.
 */
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function SceneBackdrop({ level }: { level: SceneLevel }) {
  const cloudy = level <= -1;
  const rain = level <= -2 ? (level <= -3 ? HEAVY_RAIN : RAIN) : null;
  const storm = level <= -3;
  const sparkle = level >= 1;
  const fireworks = level >= 2 ? (level >= 3 ? FIREWORKS : FIREWORKS.slice(0, 2)) : null;
  const confetti = level >= 3;

  return (
    <div className="scene-sky" aria-hidden>
      {storm && <div className="scene-lightning" />}

      {cloudy &&
        CLOUDS.map((cloud, index) => (
          <div
            key={`cloud-${index}`}
            className="scene-cloud"
            style={{
              left: `${cloud.left}%`,
              top: `${cloud.top}%`,
              width: `${cloud.w}%`,
              animationDelay: `${cloud.d}s`,
            }}
          />
        ))}

      {rain?.map((left, index) => (
        <span
          key={`rain-${index}`}
          className="scene-rain"
          style={{ left: `${left}%`, animationDelay: `${(index % 7) * -0.19}s` }}
        />
      ))}

      {sparkle &&
        SPARKS.map((spark, index) => (
          <span
            key={`spark-${index}`}
            className="scene-spark"
            style={{
              left: `${spark.left}%`,
              top: `${spark.top}%`,
              animationDelay: `${index * -0.7}s`,
            }}
          />
        ))}

      {fireworks?.map((shot, index) => (
        <span
          key={`fw-${index}`}
          className="scene-firework"
          style={{ left: `${shot.left}%`, top: `${shot.top}%` }}
        >
          {BURST_ANGLES.map((angle) => (
            <i
              key={angle}
              style={
                { "--angle": `${angle}deg`, animationDelay: `${shot.d}s` } as CSSProperties
              }
            />
          ))}
        </span>
      ))}

      {confetti &&
        CONFETTI.map((left, index) => (
          <span
            key={`confetti-${index}`}
            className="scene-confetti"
            style={{
              left: `${left}%`,
              animationDelay: `${index * -0.43}s`,
              background: index % 3 === 0 ? "var(--up)" : index % 3 === 1 ? "#ffd24a" : "#7ce4a8",
            }}
          />
        ))}
    </div>
  );
}
