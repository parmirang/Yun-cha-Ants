import {
  type Painter,
  clamp01,
  easeInOut,
  easeOut,
  gradientAt,
  lerp,
  seededRandom,
} from "@/lib/pixel-canvas";

import {
  ANT_EYE,
  ANT_FACE_EYES,
  ANT_FACE_H,
  ANT_FACE_W,
  type AntFaceMood,
  type AntGaze,
  type AntPose,
  antFaceCalmPixels,
  antFacePalette,
  antFacePixels,
  antPixels,
  antShockFacePixels,
} from "../ant-sprite";
import { type MemeLinePool, type MemeSceneId, pickMemeLine } from "./meme-lines";

/**
 * 짤 여덟 판. 전부 **한 격자(108×192, 9:16)** 위에 절차적으로 그려지고,
 * 시간만 넣으면 같은 그림이 나온다 (`draw(p, { time, seed })`).
 *
 * 시간을 인자로 받는 게 규칙이다 — 내부에 타이머나 상태를 두면 미리보기에서 본 화면과
 * 녹화된 영상이 어긋난다. 무작위가 필요한 곳(별자리·흙 얼룩·땀방울)은 `seededRandom`을
 * 쓰고, 씨앗은 "한 번의 촬영"을 뜻하는 `seed` 하나에서 갈라 쓴다.
 *
 * 판이 공유하는 것: 개미 몸(`ant-sprite`의 문자맵), 색 규칙(수익=빨강·손실=파랑),
 * 말풍선 박자(`BEAT_MS`). 나머지는 판마다 다르다 — 배경도 카메라도 물리도.
 *
 * **흔들리는 것은 `oscillator`를 거친다** — 한 바퀴에 정수 번 돌아야 반복 재생에서
 * 이음매가 안 보인다. 반대로 봉이 자라거나 물이 차오르는 **일회성 움직임은 예외다**:
 * 그건 장식이 아니라 이야기라, 한 바퀴가 끝나면 처음으로 되돌아가는 게 맞다.
 */

export interface SceneFrame {
  /** 루프 안에서의 위치 (ms, 0 이상 loopMs 미만) */
  time: number;
  /** 이번 촬영의 씨앗 — 같은 값이면 같은 영상이 나온다 */
  seed: number;
}

export interface SceneBubble {
  text: string;
  /** 꼬리 끝(=개미 머리 위) 좌표, 격자 칸 단위 */
  x: number;
  y: number;
  /** 0~1. 박자마다 떴다 사라진다 */
  alpha: number;
  /** 무대에 박히는 글자 (역 이름 간판처럼). 말풍선과 달리 상자도 꼬리도 없다. */
  labels?: readonly SceneLabel[];
}

export interface SceneLabel {
  text: string;
  /** 글자 상자의 가운데 위 좌표, 격자 칸 단위 */
  x: number;
  y: number;
  alpha: number;
  /** 글자 크기 (11px 격자의 배수) */
  unit: number;
}

export interface MemeScene {
  id: MemeSceneId;
  /** 탭에 적히는 이름 */
  title: string;
  /** 탭 아래 한 줄 설명 */
  blurb: string;
  /** 한 바퀴 (ms). 영상은 딱 한 바퀴를 굽는다 — 이음매가 안 보이려면 시작과 끝이 같아야 한다. */
  loopMs: number;
  draw(p: Painter, frame: SceneFrame): SceneBubble;
}

/** 말풍선 한 마디가 떠 있는 시간. 루프 길이는 이 값의 배수여야 한다. */
const BEAT_MS = 2400;
/** 떴다 사라지는 데 걸리는 시간 — 루프 끝에서 0이라 이음매에서 말풍선이 튀지 않는다. */
const FADE_MS = 280;

function speak(
  scene: MemeLinePool,
  frame: SceneFrame,
  x: number,
  y: number,
  loopMs: number,
): SceneBubble {
  const beat = Math.floor(frame.time / BEAT_MS);
  const inBeat = frame.time - beat * BEAT_MS;
  const alpha =
    inBeat < FADE_MS
      ? inBeat / FADE_MS
      : inBeat > BEAT_MS - FADE_MS
        ? (BEAT_MS - inBeat) / FADE_MS
        : 1;

  return {
    text: pickMemeLine(scene, frame.seed, beat, Math.round(loopMs / BEAT_MS)),
    x,
    y,
    alpha: clamp01(alpha),
  };
}

/**
 * `speak`의 `loopMs`는 **이어 붙는 뒷줄(`MEME_FOLLOWUPS`) 때문에** 받는다 — 앞줄이
 * 마지막 박자에 걸리면 뒷줄이 설 자리가 없어, 뽑는 쪽이 한 바퀴의 박자 수를 알아야 한다.
 *
 * `speak`가 박자(BEAT_MS)로 계속 끊는 것과 달리 **막의 창(fromMs~toMs) 안에서만** 말한다.
 * 창을 `parts`로 나눠 한 부분에 한 줄씩 — 로켓처럼 막마다 다른 풀을 쓰는 판이 부른다.
 * 창의 양끝에서 알파가 0이라 막 전환과 루프 이음매에서 말풍선이 튀지 않는다.
 */
function speakWindow(
  pool: MemeLinePool,
  frame: SceneFrame,
  fromMs: number,
  toMs: number,
  parts: number,
  x: number,
  y: number,
): SceneBubble {
  const t = frame.time;
  if (t < fromMs || t >= toMs) return { text: "", x, y, alpha: 0 };

  const span = (toMs - fromMs) / parts;
  const index = Math.min(parts - 1, Math.floor((t - fromMs) / span));
  const inPart = t - fromMs - index * span;
  const alpha = clamp01(Math.min(inPart, span - inPart) / FADE_MS);

  return { text: pickMemeLine(pool, frame.seed, index, parts), x, y, alpha };
}

/**
 * 두 프레임을 갈아끼운다. **주기는 루프 길이를 짝수로 나눠야 한다** — 한 바퀴에 홀수 번
 * 뒤집히면 마지막 프레임과 첫 프레임의 자세가 서로 달라 이음매에서 개미가 튄다.
 */
function flip2(time: number, ms: number): boolean {
  return Math.floor(time / ms) % 2 === 0;
}

const TAU = Math.PI * 2;

/**
 * 루프 안에서 **정확히 정수 번** 도는 물결을 만든다.
 *
 * `Math.sin(t * 3)`처럼 흐른 초를 그대로 넣으면 한 바퀴 끝에서 값이 뚝 끊긴다 —
 * 반복 재생되는 짤에서 제일 먼저 눈에 띄는 흠이라, 흔들리는 것은 전부 이걸 거친다.
 * (봉이 자라거나 물이 차오르는 **일회성 움직임**은 예외다. 그건 이야기라 되돌아오지 않는다.)
 */
function oscillator(a: number) {
  return (cycles: number, phase = 0) => Math.sin((a * cycles + phase) * TAU);
}

/* ════════════════════════════════════════════════════
   1. 땅파기 — 해는 쨍쨍, 개미는 땀
   ════════════════════════════════════════════════════ */

const DIG_LOOP = 4800;
/**
 * 지평선. **아래로 내려 잡는다** — 9:16에서 지평선을 가운데 두면 아래 절반이
 * 통째로 흙 한 덩이가 되어 화면의 반이 죽는다. 해와 하늘에 자리를 더 준다.
 */
const DIG_GROUND = 138;
/** 흙벽 꼭대기 — 개미 키만큼만 세운다. 더 높이면 개미가 협곡 바닥처럼 보인다. */
const DIG_WALL_TOP = DIG_GROUND - 46;
/** 흙벽이 시작되는 칸. 개미는 이 면을 판다. */
const DIG_WALL_X = 70;
const DIG_SCALE = 3;
const DIG_LEFT = 30;
/**
 * 개미 껍질 단계. 손익이 없는 화면이라 값이 뜻하는 건 색뿐이다 —
 * **흙 앞에 서는 개미는 붉어야 한다.** 흙색 개미를 흙벽에 세우면 실루엣이 통째로 묻힌다.
 */
const DIG_STAGE = 45;
const DIG_TOP = DIG_GROUND - 16 * DIG_SCALE;
/** 곡괭이질 한 번 */
const STRIKE_MS = 600;
/** 흙이 튀는 자리 — 팔이 뻗은 끝(스프라이트 12번 칸, 10번 줄) */
const STRIKE_X = DIG_LEFT + 12 * DIG_SCALE;
const STRIKE_Y = DIG_TOP + 10 * DIG_SCALE;

const dig: MemeScene = {
  id: "dig",
  title: "땅파기",
  blurb: "해는 쨍쨍, 땀은 뻘뻘. 그런데 왜 파고 있냐면..",
  loopMs: DIG_LOOP,

  draw(p, frame) {
    const osc = oscillator(frame.time / DIG_LOOP);
    const strike = (frame.time % STRIKE_MS) / STRIKE_MS;
    const random = seededRandom(frame.seed + 11);

    /* 하늘 — 위는 파랗고 지평선은 더위로 누렇다 */
    p.vGradient(0, DIG_GROUND, "#4aa8ea", "#ffdfae");
    drawSun(p, 22, 22, frame.time / DIG_LOOP);

    /* 지평선 위로 아지랑이. 두 줄이 서로 어긋나게 흔들린다. */
    for (let i = 0; i < 5; i += 1) {
      const y = DIG_GROUND - 14 + (i % 2) * 5;
      const x = 6 + i * 20 + Math.round(osc(2, i / 5) * 2);
      p.rect(x, y, 7, 1, "#ffe9c4");
    }

    /*
     * 땅 — 지평선 아래는 **끝까지 한 덩이로** 칠한다. 벽 쪽만 따로 칠하면
     * 땅속 한가운데 세로 이음매가 생겨 화면이 둘로 갈린다.
     */
    p.rect(0, DIG_GROUND, p.w, 3, "#7a5330");
    p.rect(0, DIG_GROUND + 3, p.w, 22, "#61411f");
    p.rect(0, DIG_GROUND + 25, p.w, p.h, "#4a3018");

    /*
     * 흙벽 — 오른쪽을 가득 채운다. 윗면은 칸마다 들쭉날쭉해야 흙으로 읽힌다.
     * **바닥보다 어둡게 칠한다**: 개미가 이 면 앞에 서므로 같은 밝기면 몸이 벽에 묻힌다.
     */
    for (let x = DIG_WALL_X; x < p.w; x += 1) {
      const top = DIG_WALL_TOP + Math.floor(random() * 4);
      p.rect(x, top, 1, 3, "#5c3f22");
      p.rect(x, top + 3, 1, DIG_GROUND - top - 3, "#3f2b16");
    }
    /* 벽 모서리에 볕 한 줄 — 개미 실루엣과 벽 사이에 경계를 세운다. */
    p.rect(DIG_WALL_X, DIG_WALL_TOP, 1, DIG_GROUND - DIG_WALL_TOP, "#8a6238");

    /*
     * 파놓은 굴. 개미의 팔 끝이 이 어둠 속으로 들어간다.
     * **바닥까지 뚫지 않는다** — 화면 아래까지 검게 이으면 구멍이 아니라 그림자 기둥이 된다.
     */
    p.disc(79, DIG_GROUND - 12, 12, "#251708");
    p.rect(67, DIG_GROUND - 12, 24, 12, "#251708");
    p.disc(79, DIG_GROUND - 12, 8, "#150c04");
    p.rect(71, DIG_GROUND - 12, 16, 12, "#150c04");

    /* 흙 얼룩 — 자리를 씨앗으로 고정한다 (매 프레임 새로 뽑으면 땅이 지글거린다) */
    for (let i = 0; i < 70; i += 1) {
      const x = Math.floor(random() * p.w);
      const y = DIG_GROUND + 2 + Math.floor(random() * (p.h - DIG_GROUND - 2));
      p.dot(x, y, i % 3 === 0 ? "#8a6238" : "#3a2513");
    }

    /* 벌어둔 동전 더미 — 한 바퀴에 넷까지 쌓이고 다시 시작한다 */
    const minted = Math.floor(frame.time / 1200);
    for (let i = 0; i < minted; i += 1) {
      drawCoin(p, 14 + (i % 2) * 6, DIG_GROUND - 1 - Math.floor(i / 2) * 4);
    }

    /* 굴에서 튀어나와 더미로 날아가는 동전 — 굴 입구에서 출발해 포물선을 그린다 */
    const flight = clamp01((frame.time % 1200) / 700);
    if (flight > 0 && flight < 1) {
      const x = lerp(76, 18, flight);
      const y = lerp(DIG_GROUND - 14, DIG_GROUND - 2, flight) - Math.sin(Math.PI * flight) * 34;
      drawCoin(p, x, y);
    }

    /* 개미 — 내리찍는 순간 한 칸 주저앉는다 */
    const struck = strike > 0.45;
    const pose: AntPose = struck ? "dig2" : "dig1";
    const drop = struck && strike < 0.62 ? 1 : 0;
    p.sprite(antPixels(DIG_STAGE, pose), DIG_LEFT, DIG_TOP + drop, DIG_SCALE);

    /* 튀는 흙 — 내리찍은 뒤 0.45초 동안 산다 */
    const sinceStrike = frame.time - (Math.floor(frame.time / STRIKE_MS) + 0.45) * STRIKE_MS;
    for (const age of [sinceStrike, sinceStrike + STRIKE_MS]) {
      if (age < 0 || age > 450) continue;

      const clod = seededRandom(frame.seed + Math.floor((frame.time - age) / STRIKE_MS) * 7 + 3);
      for (let i = 0; i < 10; i += 1) {
        const speed = 0.05 + clod() * 0.06;
        const angle = 2.1 + clod() * 1.4;
        const x = STRIKE_X + Math.cos(angle) * speed * age;
        const y = STRIKE_Y - Math.sin(angle) * speed * age + 0.00028 * age * age;
        // 큰 덩어리와 잔 알갱이를 섞는다 — 같은 크기로만 튀면 흙이 아니라 점선으로 보인다.
        const size = i % 3 === 0 ? 2 : 1;
        p.rect(x, y, size, size, i % 2 === 0 ? "#8a6238" : "#5b3d1f");
      }
    }

    /*
     * 땀 — 머리에서 튀어 왼쪽으로 떨어진다. 셋이 시차를 두고 반복한다.
     * **한 칸짜리 점으로는 안 보인다** — 하늘색 배경에 얇은 하늘색이라, 흰 심을 박고
     * 두 칸으로 키워야 "땀"으로 읽힌다.
     */
    for (let i = 0; i < 3; i += 1) {
      const age = (frame.time + i * 400) % 1200;
      if (age > 900) continue;

      const x = DIG_LEFT + 7 * DIG_SCALE - age * 0.016;
      const y = DIG_TOP + 2 * DIG_SCALE - age * 0.028 + 0.00006 * age * age;
      p.rect(x, y, 2, 3, "#4a8fd8");
      p.rect(x, y + 1, 1, 2, "#ffffff");
    }

    return speak("dig", frame, DIG_LEFT + 8 * DIG_SCALE, DIG_TOP + 2 * DIG_SCALE - 2, DIG_LOOP);
  },
};

/** 이글거리는 해 — 살은 길이가 숨쉬듯 늘었다 줄었다 한다 */
function drawSun(p: Painter, cx: number, cy: number, a: number) {
  for (let i = 0; i < 12; i += 1) {
    // 살 간격(2칸)만큼만 돌린다 — 한 바퀴에 딱 두 칸이라 끝에서 처음으로 매끄럽게 이어진다.
    const angle = (TAU * i) / 12 + a * (TAU / 12) * 2;
    const inner = 11;
    const outer = inner + 3 + Math.sin((a * 3 + i * 0.27) * TAU) * 2;
    p.line(
      cx + Math.cos(angle) * inner,
      cy + Math.sin(angle) * inner,
      cx + Math.cos(angle) * outer,
      cy + Math.sin(angle) * outer,
      "#ffd24a",
    );
  }

  p.disc(cx, cy, 10, "#ffd24a");
  p.disc(cx, cy, 8, "#fff3b0");
}

function drawCoin(p: Painter, x: number, y: number) {
  p.disc(x, y, 2, "#c9962a");
  p.disc(x, y, 1, "#ffd24a");
  p.dot(x - 1, y - 1, "#fff3b0");
}

/* ════════════════════════════════════════════════════
   2. 탑승 — 산 · 구름 · 우주
   ════════════════════════════════════════════════════ */

const RIDE_LOOP = 7200;
const RIDE_CENTER = 54;

/**
 * 카메라가 훑는 세계. 아래(큰 값)가 땅이고 위(음수)가 우주다.
 * 하늘색은 **화면 위치가 아니라 세계 좌표**로 정해진다 — 그래야 올라가는 내내
 * 색이 이어지고, 산이 사라지는 높이와 별이 뜨는 높이가 늘 같은 곳에 있다.
 */
const SKY_STOPS: readonly [number, string][] = [
  [-420, "#03040c"],
  [-140, "#080d24"],
  [60, "#16306e"],
  [240, "#3576c8"],
  [400, "#5fb2ee"],
  [520, "#9ad8f7"],
];

/**
 * 세계에 놓인 것들의 높이. 첫 프레임(카메라 위쪽 = 300)에 **산과 차트가 화면 아래에
 * 걸려 있어야** 어디서 출발하는지가 읽힌다 — 화면은 세계 300~492를 본다.
 */
const RIDE_GROUND = 470;
/**
 * 달. 카메라가 올라오면서 **위에서 내려오듯 들어온다** — 너무 높이 달아두면
 * 마지막 몇 초에 화면 맨 윗줄만 스치고 끝나, 우주에 도착한 값이 없다.
 */
const RIDE_MOON = -190;

const ride: MemeScene = {
  id: "ride",
  title: "차트 탑승",
  blurb: "차트에 올라탔다. 산과 구름을 지나 우주까지.",
  loopMs: RIDE_LOOP,

  draw(p, frame) {
    const a = frame.time / RIDE_LOOP;
    const osc = oscillator(a);
    /* 세계에서 화면 맨 윗줄이 놓인 자리. 값이 줄수록 올라간다. */
    const camTop = 300 - a * 640;
    const sy = (worldY: number) => worldY - camTop;

    /* 하늘 — 세 칸씩 끊어 칠해 도트 결을 남긴다 */
    for (let row = 0; row < p.h; row += 3) {
      p.rect(0, row, p.w, 3, gradientAt(SKY_STOPS, camTop + row));
    }

    /* 별 — 높이 올라갈수록 짙어진다 */
    const starRandom = seededRandom(frame.seed + 7);
    for (let i = 0; i < 48; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const worldY = 120 - starRandom() * 580;
      const twinkle = 0.45 + 0.55 * osc(3, i * 0.16);
      const y = sy(worldY);
      if (y < -2 || y > p.h) continue;

      p.faded(clamp01(twinkle) * clamp01((260 - camTop) / 220), () => {
        p.dot(x, y, "#ffffff");
        if (i % 6 === 0) {
          p.dot(x - 1, y, "#dfe8ff");
          p.dot(x + 1, y, "#dfe8ff");
          p.dot(x, y - 1, "#dfe8ff");
          p.dot(x, y + 1, "#dfe8ff");
        }
      });
    }

    /* 달 */
    const moonY = sy(RIDE_MOON);
    if (moonY > -20 && moonY < p.h + 20) {
      p.disc(84, moonY, 13, "#e6ecf7");
      p.disc(79, moonY - 4, 3, "#c3cddd");
      p.disc(88, moonY + 3, 4, "#c3cddd");
      p.disc(80, moonY + 6, 2, "#c3cddd");
    }

    /*
     * 산줄기와 땅. **산은 땅이 화면 밖으로 내려간 뒤에도 봉우리가 남는다** —
     * 땅 여부로 산을 함께 가리면 아직 보여야 할 봉우리가 통째로 사라진다.
     */
    drawMountain(p, 16, sy(392), 40, RIDE_GROUND - 392, "#2f4a33");
    drawMountain(p, 92, sy(404), 44, RIDE_GROUND - 404, "#2f4a33");
    drawMountain(p, 54, sy(356), 52, RIDE_GROUND - 356, "#26402b", "#dfeef0");

    const groundY = sy(RIDE_GROUND);
    if (groundY < p.h) p.rect(0, groundY, p.w, p.h - groundY, "#1d3320");

    /*
     * 개미가 올라탄 그 차트. **왼쪽에서 계단처럼 올라와 가운데 봉으로 이어진다** —
     * 개미가 탄 봉을 가운데 두고 양옆에 흩어놓으면 어느 봉에 탄 건지가 안 보인다.
     */
    for (let i = 0; i < 5; i += 1) {
      const top = sy(462 - i * 13);
      const bottom = sy(RIDE_GROUND);
      if (bottom < 0 || top > p.h) continue;
      p.rect(4 + i * 10, top, 7, bottom - top, "#ff5c5c");
      p.rect(6 + i * 10, top - 4, 2, 4, "#ff8f8f");
    }

    /* 구름 — 고도에 흩어져 있고, 지나갈 때 옆으로도 조금 흐른다 */
    const cloudRandom = seededRandom(frame.seed + 23);
    for (let i = 0; i < 8; i += 1) {
      const worldY = 330 - cloudRandom() * 280;
      const x = 6 + cloudRandom() * 92 + osc(1, i * 0.3) * 3;
      const size = 5 + Math.floor(cloudRandom() * 4);
      const y = sy(worldY);
      if (y < -20 || y > p.h + 20) continue;
      drawCloud(p, x, y, size);
    }

    /*
     * 카메라가 개미에게 다가간다. 처음엔 차트 전체가 보이는 먼 그림이고,
     * 0.14~0.30 구간에서 개미로 붙는다 — 이 앱에서 봉은 늘 화면 가운데라
     * 배율만 키워도 개미가 화면을 채운다.
     */
    const zoom = easeInOut(clamp01((a - 0.14) / 0.16));
    const scale = lerp(2, 4.4, zoom);
    const feetY = lerp(150, 114, zoom);
    const antLeft = RIDE_CENTER - 8 * scale;
    const antTop = feetY - 16 * scale;

    /* 타고 있는 봉 — 발밑에서 화면 아래까지 뻗는다 */
    const barWidth = Math.round(6 * scale);
    p.rect(RIDE_CENTER - barWidth / 2, feetY, barWidth, p.h - feetY, "#ff5c5c");
    p.rect(RIDE_CENTER - barWidth / 2 + 1, feetY, 2, p.h - feetY, "#ff8f8f");

    /* 속도선 — 높이 올라갈수록 빨라지고 촘촘해진다 */
    const streakRandom = seededRandom(frame.seed + 31);
    const streaks = Math.round(6 + 16 * a);
    for (let i = 0; i < streaks; i += 1) {
      const x = Math.floor(streakRandom() * p.w);
      const length = 5 + Math.floor(streakRandom() * 9);
      // 한 바퀴에 정수 번 감기게 한다 — 임의의 속도로 흘리면 이음매에서 선들이 순간이동한다.
      const laps = 3 + Math.floor(streakRandom() * 4);
      const span = p.h + length;
      const y = ((streakRandom() * span + a * laps * span) % span) - length;
      // 진하면 비로 보인다 — 스쳐 지나가는 결만 남긴다.
      p.faded(0.18, () => p.rect(x, y, 1, length, "#ffffff"));
    }

    /* 개미 — 두 손 흔들며 간다 */
    p.sprite(antPixels(49, flip2(frame.time, 150) ? "wave1" : "wave2"), antLeft, antTop, scale);

    return speak("ride", frame, RIDE_CENTER, antTop + 2 * scale - 2, RIDE_LOOP);
  },
};

function drawMountain(
  p: Painter,
  cx: number,
  peakY: number,
  half: number,
  height: number,
  color: string,
  snow?: string,
) {
  for (let row = 0; row < height; row += 1) {
    const y = peakY + row;
    if (y < 0) continue;
    if (y > p.h) break;

    const width = (row / height) * half;
    p.rect(cx - width, y, width * 2, 1, snow && row < height * 0.13 ? snow : color);
  }
}

function drawCloud(p: Painter, cx: number, cy: number, size: number) {
  p.disc(cx, cy, size, "#eef4ff");
  p.disc(cx - size, cy + 1, size * 0.7, "#eef4ff");
  p.disc(cx + size, cy + 1, size * 0.8, "#eef4ff");
  p.rect(cx - size * 1.6, cy + 1, size * 3.2, size * 0.8, "#eef4ff");
  p.rect(cx - size * 1.6, cy + size * 0.8, size * 3.2, 2, "#c9d6ee");
}

/* ════════════════════════════════════════════════════
   3. 눈물바다 — 다 잃었다
   ════════════════════════════════════════════════════ */

const FLOOD_LOOP = 7200;
const FLOOD_GROUND = 156;
/** 우는 얼굴이 보여야 하는 판이라 셋 중 개미가 제일 크다 */
const FLOOD_SCALE = 4;
const FLOOD_LEFT = 22;
const FLOOD_TOP = FLOOD_GROUND - 16 * FLOOD_SCALE;
/** 눈 좌표에서 흐른다 — 개미 얼굴이 바뀌어도 눈물이 딴 데서 나오지 않는다 */
const TEAR_X = FLOOD_LEFT + ANT_EYE.x * FLOOD_SCALE + 1;
const TEAR_Y = FLOOD_TOP + ANT_EYE.y * FLOOD_SCALE + 2;
const TEAR_EVERY = 150;

const flood: MemeScene = {
  id: "flood",
  title: "눈물바다",
  blurb: "울다 보니 바다가 됐다. 다 잃은 개미의 밤.",
  loopMs: FLOOD_LOOP,

  draw(p, frame) {
    const a = frame.time / FLOOD_LOOP;
    const osc = oscillator(a);

    /*
     * 밤하늘 — 대시보드 무대와 같은 톤에서 시작하되 **지평선 쪽을 밝힌다.**
     * 탈진한 개미는 색이 빠져 어두운데, 뒤까지 어두우면 몸이 밤에 묻혀 우는 게 안 보인다.
     */
    p.vGradient(0, FLOOD_GROUND, "#0d1626", "#1e2b45");

    const starRandom = seededRandom(frame.seed + 17);
    for (let i = 0; i < 26; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const y = Math.floor(starRandom() * 90);
      p.faded(0.3 + 0.3 * osc(2, i * 0.13), () => p.dot(x, y, "#cfd8e8"));
    }

    /* 달은 오른쪽 위에 홀로 둔다 — 구름은 왼쪽에만 흘려 가리지 않게 한다 */
    p.disc(88, 24, 8, "#cfd8e8");
    p.disc(85, 21, 2, "#a8b4c8");
    p.disc(91, 27, 3, "#a8b4c8");

    const cloudRandom = seededRandom(frame.seed + 5);
    for (let i = 0; i < 3; i += 1) {
      const x = 8 + cloudRandom() * 52 + osc(1, i * 0.31) * 4;
      p.faded(0.9, () => drawFlatCloud(p, x, 20 + i * 18, 9 + i * 3));
    }

    /* 땅 */
    p.rect(0, FLOOD_GROUND, p.w, 3, "#241a12");
    p.rect(0, FLOOD_GROUND + 3, p.w, p.h - FLOOD_GROUND - 3, "#150f0a");

    /* 물이 차오르는 높이 — 발목에서 가슴께까지 */
    const waterY = lerp(p.h - 1, 126, easeOut(clamp01((a - 0.05) / 0.8)));
    const surfaceAt = (x: number) =>
      waterY + Math.round(Math.sin(x * 0.22 + a * TAU * 3) * 1.6 + Math.sin(x * 0.11 - a * TAU * 2) * 0.8);

    /* 개미 — 흐느끼느라 어깨가 들썩이고 몸이 좌우로 떨린다 */
    const sob = flip2(frame.time, 300);
    const shake = flip2(frame.time, 150) ? 0 : 1;
    p.sprite(
      antPixels(2, sob ? "cry1" : "cry2"),
      FLOOD_LEFT + shake,
      FLOOD_TOP + (sob ? 0 : 1),
      FLOOD_SCALE,
    );

    /*
     * 눈물. **볼을 타고 흐르는 줄기를 먼저 그린다** — 떨어지는 물방울만 있으면
     * 어디서 나오는지가 안 보여서 그냥 비 오는 그림이 된다.
     */
    p.rect(TEAR_X - 1, TEAR_Y - 2, 2, 6 + (sob ? 2 : 0), "#8fc4f0");
    p.rect(TEAR_X - 1, TEAR_Y - 2, 1, 4, "#cfe9ff");

    /* 두 줄기가 시차를 두고 떨어져 수면에서 튄다 */
    for (let stream = 0; stream < 2; stream += 1) {
      const x = TEAR_X - stream * 6;
      const offset = stream * (TEAR_EVERY / 2);

      for (let i = 0; i < 6; i += 1) {
        const age = (frame.time + offset + i * TEAR_EVERY) % (TEAR_EVERY * 6);
        const y = TEAR_Y + 4 + 0.00042 * age * age;
        const splash = surfaceAt(x);
        if (y > splash) {
          /* 수면에 닿은 물방울은 파문으로 바뀐다 */
          const spread = Math.min(5, (y - splash) * 0.5);
          p.faded(clamp01(1 - spread / 5), () => {
            p.rect(x - spread - 1, splash - 1, 2, 1, "#cfe9ff");
            p.rect(x + spread, splash - 1, 2, 1, "#cfe9ff");
          });
          continue;
        }

        p.rect(x, y, 2, 3, "#4a8fd8");
        p.rect(x, y + 1, 1, 2, "#cfe9ff");
      }
    }

    /* 물 — 개미 위에 덮어 그린다. 잠긴 다리가 물빛에 먹히는 게 맞다. */
    for (let x = 0; x < p.w; x += 1) {
      const top = surfaceAt(x);
      p.rect(x, top, 1, 2, "#5b9ad6");
      p.rect(x, top + 2, 1, 10, "#2f6299");
      p.rect(x, top + 12, 1, p.h - top - 12, "#1d4270");
    }

    /* 물비늘 — 수면 바로 아래에서 옆으로 흐른다 */
    const glintRandom = seededRandom(frame.seed + 13);
    for (let i = 0; i < 9; i += 1) {
      const base = glintRandom() * p.w;
      const x = (base + a * (1 + Math.floor(glintRandom() * 3)) * p.w) % p.w;
      const y = surfaceAt(x) + 3 + Math.floor(glintRandom() * 8);
      if (y > p.h) continue;
      p.faded(0.5, () => p.rect(x, y, 3, 1, "#7fb6e8"));
    }

    /* 떠내려가는 파란 봉 — 잃은 것들이 물 위를 지난다. 심지를 남겨야 봉으로 읽힌다. */
    for (let i = 0; i < 2; i += 1) {
      const x = i === 0 ? 10 : 98;
      const top = surfaceAt(x) - 7 + (flip2(frame.time + i * 450, 450) ? 0 : 1);
      p.rect(x, top - 3, 1, 3, "#5c9dff");
      p.rect(x - 3, top, 6, 9, "#5c9dff");
      p.rect(x - 2, top + 1, 2, 7, "#8fc0ff");
      p.rect(x - 3, surfaceAt(x), 6, 1, "#5b9ad6");
    }

    return speak("flood", frame, FLOOD_LEFT + 8 * FLOOD_SCALE, FLOOD_TOP + 2 * FLOOD_SCALE - 2, FLOOD_LOOP);
  },
};

function drawFlatCloud(p: Painter, cx: number, cy: number, size: number) {
  p.disc(cx, cy, size * 0.6, "#2f3644");
  p.disc(cx - size * 0.7, cy + 1, size * 0.45, "#2f3644");
  p.disc(cx + size * 0.7, cy + 1, size * 0.5, "#2f3644");
  p.rect(cx - size, cy, size * 2, size * 0.5, "#2f3644");
}

/* ════════════════════════════════════════════════════
   4. 클로즈업 — 얼굴에 눈물이 또르르
   ════════════════════════════════════════════════════ */

/**
 * 한 바퀴에 말풍선 세 마디(`BEAT_MS` × 3). 우는 얼굴은 움직임이 크지 않아서,
 * 이 판의 리듬은 사실상 말풍선이 만든다.
 */
const FACE_LOOP = 7200;
/** 52칸 얼굴을 2배로 — 104칸이라 화면 폭(108)을 꽉 채운다 */
const FACE_SCALE = 2;
const FACE_LEFT = Math.round((108 - ANT_FACE_W * FACE_SCALE) / 2);
/**
 * 맵 아래끝이 화면 아래끝과 맞도록 앉힌다 — **몸은 잘려야 한다.**
 * 아래를 띄우면 개미가 바닥에 놓인 인형처럼 보이고, 클로즈업이 아니라 전신 컷이 된다.
 */
const FACE_TOP = 192 - ANT_FACE_H * FACE_SCALE;
/**
 * 껍질 색 단계. 창백한 쪽(2~8)으로 두면 어두운 배경에 얼굴이 통째로 묻힌다 —
 * 이 판은 손익을 안 그리므로 단계가 뜻하는 건 색뿐이고, 여기서는 **읽히는 쪽**을 고른다.
 */
const FACE_STAGE = 20;
/** 눈 아래에서 쏟아지는 줄기의 좌우 벌어짐 (얼굴 격자 기준) — 눈마다 넷씩 여덟 줄기 */
const TEAR_LANES = [-6, -2, 2, 6] as const;

const face: MemeScene = {
  id: "face",
  title: "클로즈업",
  blurb: "우는 얼굴만 크게. 두 눈에서 눈물이 줄줄.",
  loopMs: FACE_LOOP,

  draw(p, frame) {
    const a = frame.time / FACE_LOOP;
    const osc = oscillator(a);

    /* 차가운 새벽 방 */
    p.vGradient(0, p.h, "#0a1120", "#182742");

    /* 내려꽂는 차트 — 얼굴 뒤로 파란 봉이 오른쪽으로 갈수록 낮아진다 */
    for (let i = 0; i < 9; i += 1) {
      const x = 6 + i * 12;
      const top = 12 + i * 4 + osc(1, i * 0.11);
      p.faded(0.4, () => {
        p.rect(x + 3, top - 4, 1, 4, "#5c9dff");
        p.rect(x, top, 8, 6 + i, "#5c9dff");
        p.rect(x + 1, top + 1, 2, 4 + i, "#8fc0ff");
      });
    }

    /* 흐느낌 — 얼굴이 한 칸 들썩인다 */
    const sob = flip2(frame.time, 400);
    const top = FACE_TOP + (sob ? 0 : 1);
    /*
     * 눈은 1.6초마다 한 번 꽉 감긴다 (우는 얼굴이 계속 뜨고 있으면 인형처럼 보인다).
     * **깜빡임이 루프 끝에 걸리지 않게 반 박자 밀어둔다** — 마지막 프레임에서 감고
     * 첫 프레임에서 뜨면, 반복 재생될 때마다 이음매에서 눈이 튄다.
     */
    const blink = (frame.time + 500) % 1600 > 1320;

    /* 얼굴·목·가슴·팔이 한 장이라 여기서 몸을 따로 그리지 않는다 */
    p.sprite(antFacePixels(FACE_STAGE, blink), FACE_LEFT, top, FACE_SCALE);

    /*
     * 눈물은 **줄기로 흐른다.** 방울만 뚝뚝 떨어뜨리면 비 오는 그림이 되고, 우는 얼굴
     * 밈의 그 표정은 두 눈에서 턱 아래까지 물이 이어져 있어야 나온다. 줄기 안에서 밝은
     * 마디가 내려가며 흐르는 티를 낸다. **줄기는 얇게 둔다** — 굵으면 표정이 물에 덮인다.
     */
    for (const eye of ANT_FACE_EYES) {
      for (const lane of TEAR_LANES) {
        const baseX = FACE_LEFT + (eye.x + lane) * FACE_SCALE;
        const from = top + eye.y * FACE_SCALE;
        const phase = (eye.x + lane) * 0.8;
        /* 줄기마다 굽이가 어긋나야 여덟 줄이 한 빗살처럼 안 보인다 */
        const bend = (y: number) => Math.round(Math.sin(y * 0.2 + phase) * 2);

        for (let y = from; y < p.h; y += 1) {
          p.rect(baseX + bend(y), y, 2, 1, "#4a8fd8");
          p.dot(baseX + bend(y), y, "#8fc4f0");
        }

        /* 흐르는 마디 — 줄기 안에서 밝은 토막이 내려간다 */
        /* 한 바퀴에 여섯 번 — 초를 그대로 쓰면 루프 끝에서 마디가 순간이동한다 */
        const flow = from + (((a * 6 + phase * 0.2) % 1) * (p.h - from));
        for (let y = flow; y < flow + 6; y += 1) {
          p.rect(baseX + bend(y), y, 2, 1, "#cfe9ff");
        }
      }
    }

    return speak("face", frame, 54, top - 2, FACE_LOOP);
  },
};

/* ════════════════════════════════════════════════════
   5. 돈방석 — 양옆으로 양봉이 선다
   ════════════════════════════════════════════════════ */

const CUSHION_LOOP = 4800;
/** 동전 더미 꼭대기 = 개미가 앉는 높이 */
const PILE_TOP = 142;
const CUSHION_SCALE = 4;
const CUSHION_LEFT = 54 - 8 * CUSHION_SCALE;
/**
 * **다리 네 줄이 더미에 묻히도록** 개미를 내려 앉힌다 (동전을 개미 위에 덮어 그린다).
 * 서 있는 자세 그대로 두면 돈 위에 올라선 그림이라 "앉아 있다"가 안 된다.
 */
const CUSHION_TOP = PILE_TOP - 12 * CUSHION_SCALE;
const CUSHION_STAGE = 49;

const cushion: MemeScene = {
  id: "cushion",
  title: "돈방석",
  blurb: "돈방석에 앉아 양옆으로 장대양봉. 훗.",
  loopMs: CUSHION_LOOP,

  draw(p, frame) {
    const a = frame.time / CUSHION_LOOP;
    const osc = oscillator(a);

    /* 금빛이 도는 어두운 방 */
    p.vGradient(0, p.h, "#3a2413", "#150d06");

    /*
     * 개미 뒤 후광. **가운데는 오히려 어둡게 판다** — 금빛을 개미 뒤까지 깔면 붉은 개미와
     * 명도가 붙어 실루엣이 통째로 묻힌다 (한 번 그렇게 그려서 개미가 안 보였다).
     * 빛은 테두리로 돌리고 개미는 어두운 주머니 안에 세운다.
     */
    p.faded(0.1, () => p.disc(54, 116, 52, "#ffd24a"));
    p.faded(0.16, () => p.disc(54, 116, 36, "#ffd24a"));
    p.faded(0.55, () => p.disc(54, 120, 25, "#241505"));

    /*
     * 양옆 장대양봉. **두 봉이 같이 자라되 어긋나게** 올라간다 — 나란히 같은 높이로
     * 자라면 기둥 둘이 서 있는 그림이 되고, 오르는 느낌이 안 산다.
     * 폭은 좁게 잡는다: 굵으면 화면 양쪽이 벽이 되어 가운데 개미가 좁은 골목에 앉는다.
     */
    for (let i = 0; i < 2; i += 1) {
      const x = i === 0 ? 8 : 88;
      const grow = easeOut(clamp01((a - i * 0.08) / 0.62));
      const barTop = lerp(PILE_TOP - 6, 28 + i * 10, grow);
      const height = PILE_TOP + 6 - barTop;

      p.faded(0.28, () => p.rect(x - 3, barTop - 3, 18, height + 3, "#ff5c5c"));
      p.rect(x + 5, barTop - 9, 2, 9, "#ff8f8f");
      p.rect(x, barTop, 12, height, "#ff5c5c");
      p.rect(x + 2, barTop + 2, 2, height - 4, "#ffb3b3");
      p.rect(x + 10, barTop, 2, height, "#c0392b");
    }

    /*
     * 개미 — 가끔 한쪽 팔을 들어 보인다 (훗).
     * **테두리를 한 도트 두른다**: 붉은 개미와 금빛 후광은 명도가 비슷해서, 선이 없으면
     * 개미가 배경에 녹아 형체만 남는다.
     */
    const antPose: AntPose = flip2(frame.time, 800) ? "stand" : "wave1";
    outlined(p, antPixels(CUSHION_STAGE, antPose), CUSHION_LEFT, CUSHION_TOP, CUSHION_SCALE, "#1c1005");

    /*
     * 돈방석 — 가운데가 봉긋한 더미. 개미 다리를 덮으며 "앉은" 그림을 만든다.
     * **바탕은 어둡게 깔고 동전만 밝게** 얹는다: 바탕까지 금색이면 노란 언덕 한 덩이가
     * 되고, 그 위에 뿌린 동전이 언덕에 묻혀 부스러기로 보인다.
     */
    const pileAt = (x: number) => PILE_TOP + ((x - 54) / 54) ** 2 * 26;

    for (let x = 0; x < p.w; x += 1) {
      const surface = pileAt(x);
      p.rect(x, surface, 1, p.h - surface, "#8a6216");
    }

    /* 낱개 동전 — 표면에 촘촘히, 아래로 갈수록 성기게 */
    const pileRandom = seededRandom(frame.seed + 41);
    for (let i = 0; i < 120; i += 1) {
      const x = Math.floor(pileRandom() * p.w);
      const depth = pileRandom() ** 2 * 36;
      const y = pileAt(x) + 1 + depth;
      if (y > p.h) continue;
      drawCoin(p, x, y);
    }

    for (let i = 0; i < 4; i += 1) {
      const x = 8 + i * 28 + Math.floor(pileRandom() * 6);
      const y = pileAt(x) + 6 + i * 3;
      p.rect(x, y, 13, 7, "#8fd8b0");
      p.rect(x, y + 3, 13, 1, "#3f7a5c");
      p.rect(x + 5, y + 2, 3, 3, "#3f7a5c");
    }

    /*
     * 위에서 쏟아지는 동전. 화면 위쪽이 통째로 비어 있으면 개미가 바닥에 눌린 그림이 된다 —
     * 떨어지는 것들이 그 자리를 채우고, 더미가 왜 쌓이는지도 같이 말해준다.
     */
    const rainRandom = seededRandom(frame.seed + 47);
    for (let i = 0; i < 7; i += 1) {
      const x = 12 + Math.floor(rainRandom() * 84);
      const age = (frame.time + i * 700) % CUSHION_LOOP;
      if (age > 2400) continue;

      drawCoin(p, x, -8 + (pileAt(x) + 8) * (age / 2400) ** 2);
    }

    /* 반짝임 — 돈은 반짝여야 돈이다 */
    const sparkRandom = seededRandom(frame.seed + 53);
    for (let i = 0; i < 12; i += 1) {
      const x = Math.floor(sparkRandom() * p.w);
      const y = 40 + Math.floor(sparkRandom() * 120);
      const phase = osc(3, i * 0.3);
      if (phase < 0.4) continue;
      drawSparkle(p, x, y, phase > 0.85 ? 3 : 2);
    }

    return speak(
      "cushion",
      frame,
      CUSHION_LEFT + 8 * CUSHION_SCALE,
      CUSHION_TOP + 2 * CUSHION_SCALE - 2,
      CUSHION_LOOP,
    );
  },
};

/**
 * 스프라이트에 한 도트짜리 테두리를 둘러 그린다.
 *
 * 같은 그림을 상하좌우로 **한 도트(=scale)씩** 밀어 어두운 색으로 깔고 그 위에 본 그림을
 * 얹는다. 밀어내는 폭을 1픽셀로 잡으면 개미 도트보다 가는 선이 생겨 해상도가 어긋나 보인다.
 */
function outlined(
  p: Painter,
  pixels: readonly { x: number; y: number; fill: string }[],
  left: number,
  top: number,
  scale: number,
  color: string,
  flip = false,
) {
  const shadow = pixels.map((pixel) => ({ ...pixel, fill: color }));

  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    p.sprite(shadow, left + dx * scale, top + dy * scale, scale, flip);
  }

  p.sprite(pixels, left, top, scale, flip);
}

function drawSparkle(p: Painter, cx: number, cy: number, size: number) {
  p.rect(cx - size, cy, size * 2 + 1, 1, "#fff3b0");
  p.rect(cx, cy - size, 1, size * 2 + 1, "#fff3b0");
  p.dot(cx, cy, "#ffffff");
}

/* ════════════════════════════════════════════════════
   6. 롤러코스터 — 기둥이 양봉과 음봉
   ════════════════════════════════════════════════════ */

const COASTER_LOOP = 7200;
/**
 * 놀이공원 바닥. **기둥이 서는 선이자 천막이 놓이는 선**이라 너무 내려 잡으면
 * 기둥이 화면 아래 절반을 벽처럼 채워 뒤의 놀이공원이 통째로 가린다.
 */
const COASTER_GROUND = 156;
/** 수레가 서 있는 화면 자리. 세계가 왼쪽으로 흐르고 수레는 제자리에 있다. */
const CAR_X = 54;
/**
 * 한 바퀴에 흐르는 거리. **레일의 물결이 이 거리에서 딱 떨어져야** 시작과 끝이 이어진다 —
 * 아무 주기나 쓰면 루프 이음매에서 레일 높이가 툭 튄다. 기둥 간격(12)도 이 값의 약수다.
 */
const COASTER_SPAN = 216;
const RAIL_WAVES: readonly [number, number][] = [
  [2, 28],
  [5, 9],
];

/** 세계 좌표 x에서의 레일 높이 */
function railAt(worldX: number): number {
  return RAIL_WAVES.reduce(
    (y, [cycles, amplitude]) =>
      y + Math.sin((worldX / COASTER_SPAN) * cycles * Math.PI * 2) * amplitude,
    94,
  );
}

const coaster: MemeScene = {
  id: "coaster",
  title: "롤러코스터",
  blurb: "다 같이 탑승. 기둥은 장대양봉과 장대음봉.",
  loopMs: COASTER_LOOP,

  draw(p, frame) {
    const a = frame.time / COASTER_LOOP;
    const osc = oscillator(a);
    const scroll = a * COASTER_SPAN;

    /* 밤의 놀이공원 */
    p.vGradient(0, COASTER_GROUND, "#241a3f", "#5a3566");

    const starRandom = seededRandom(frame.seed + 61);
    for (let i = 0; i < 30; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const y = Math.floor(starRandom() * 70);
      p.faded(0.4 + 0.4 * osc(3, i * 0.12), () => p.dot(x, y, "#ffe9c4"));
    }

    /* 전구 줄 — 처지는 곡선을 따라 색이 번갈아 켜진다 */
    for (let i = 0; i < 13; i += 1) {
      const x = 2 + i * 9;
      const y = 10 + Math.sin((i / 12) * Math.PI) * 9;
      p.dot(x, y - 1, "#6b5a7a");
      const on = osc(4, i * 0.14) > -0.2;
      p.faded(on ? 1 : 0.35, () =>
        p.disc(x, y, 1, i % 3 === 0 ? "#ffd24a" : i % 3 === 1 ? "#ff8f8f" : "#8fd8b0"),
      );
    }

    /* 대관람차 — 한 바퀴에 딱 한 번 돈다 (이음매가 안 보이게) */
    drawFerrisWheel(p, 20, 46, 17, a * Math.PI * 2);

    /* 천막 */
    for (let i = 0; i < 4; i += 1) drawTent(p, 62 + i * 15, COASTER_GROUND, 6 + (i % 2) * 2);

    /* 땅 */
    p.rect(0, COASTER_GROUND, p.w, 2, "#6b4b7a");
    p.rect(0, COASTER_GROUND + 2, p.w, p.h - COASTER_GROUND, "#2a2033");

    /*
     * 줄 선 개미들. 아래 띠가 비어 있으면 화면이 두 동강 나 보이고, 무엇보다
     * **탄 개미만 있으면 놀이공원이 아니라 시험대처럼 보인다** — 기다리는 줄이 있어야 놀이기구다.
     */
    for (let i = 0; i < 5; i += 1) {
      const x = 8 + i * 21;
      const pose: AntPose = flip2(frame.time + i * 300, 600) ? "stand" : "wave1";
      p.sprite(antPixels(20 + i * 6, pose), x, p.h - 22, 1);
    }

    /*
     * 기둥 — 레일을 떠받치는 장대봉. **오르는 구간은 양봉(빨강), 내리는 구간은 음봉(파랑)**이라
     * 색만 봐도 다음이 오르막인지 알 수 있다. 아래로 심지를 남겨야 봉으로 읽힌다.
     */
    for (let i = 0; i * 12 <= COASTER_SPAN; i += 1) {
      const worldX = Math.ceil(scroll / 12) * 12 + i * 12;
      const x = worldX - scroll;
      if (x < -8 || x > p.w + 8) continue;

      const top = railAt(worldX);
      const rising = railAt(worldX + 6) < top;
      const body = rising ? "#ff5c5c" : "#5c9dff";
      const core = rising ? "#ff8f8f" : "#8fc0ff";

      p.rect(x - 3, top, 7, COASTER_GROUND - 6 - top, body);
      p.rect(x - 1, top + 2, 2, COASTER_GROUND - 12 - top, core);
      p.rect(x, COASTER_GROUND - 6, 1, 6, body);
    }

    /* 레일 */
    for (let x = -1; x <= p.w; x += 1) {
      const y = railAt(x + scroll);
      p.rect(x, y - 2, 1, 2, "#e8d8b0");
      p.rect(x, y, 1, 1, "#7a6a4a");
    }

    /* 수레와 개미들 */
    const carWorldX = scroll + CAR_X;
    const carY = railAt(carWorldX) - 2;
    /* 내리막이면 팔이 올라간다 — 기울기로 신남을 정한다 */
    const dropping = railAt(carWorldX + 6) > railAt(carWorldX);
    const bounce = flip2(frame.time, 120) ? 0 : 1;

    for (let i = 0; i < 3; i += 1) {
      const x = CAR_X - 19 + i * 19;
      const pose: AntPose = dropping
        ? flip2(frame.time + i * 120, 120)
          ? "wave1"
          : "wave2"
        : "stand";

      outlined(p, antPixels(44 - i * 10, pose), x - 16, carY - 30 + bounce, 2, "#1c1024");
    }

    /* 수레는 개미 뒤가 아니라 앞에 그린다 — 앞판이 다리를 가려야 "타고 있다"가 된다 */
    p.rect(CAR_X - 32, carY - 12, 64, 12, "#c0392b");
    p.rect(CAR_X - 32, carY - 9, 64, 2, "#ffd24a");
    p.rect(CAR_X - 32, carY - 12, 64, 1, "#e05a4a");
    p.rect(CAR_X + 30, carY - 16, 4, 4, "#c0392b");
    p.disc(CAR_X - 20, carY + 1, 3, "#2a2033");
    p.disc(CAR_X + 20, carY + 1, 3, "#2a2033");

    /* 속도선 — 내리막에서만 그어진다 */
    if (dropping) {
      const streak = seededRandom(frame.seed + 71);
      for (let i = 0; i < 7; i += 1) {
        const x = CAR_X - 44 + Math.floor(streak() * 88);
        const y = carY - 34 + Math.floor(streak() * 40);
        p.faded(0.4, () => p.rect(x, y, 9, 1, "#cfe9ff"));
      }
    }

    return speak("coaster", frame, CAR_X, carY - 34, COASTER_LOOP);
  },
};

function drawFerrisWheel(p: Painter, cx: number, cy: number, r: number, angle: number) {
  p.line(cx, cy, cx - r * 0.7, COASTER_GROUND, "#6b5a7a");
  p.line(cx, cy, cx + r * 0.7, COASTER_GROUND, "#6b5a7a");

  for (let i = 0; i < 8; i += 1) {
    const spoke = angle + (Math.PI * 2 * i) / 8;
    p.line(cx, cy, cx + Math.cos(spoke) * r, cy + Math.sin(spoke) * r, "#8a76a0");
  }

  /*
   * 테두리 링. **없으면 바퀴가 아니라 폭죽으로 보인다** — 살만 그렸더니 가운데서
   * 사방으로 뻗은 불꽃이 됐다. 링을 두르는 순간 대관람차로 읽힌다.
   */
  for (let i = 0; i < 48; i += 1) {
    const around = (Math.PI * 2 * i) / 48;
    p.dot(cx + Math.cos(around) * r, cy + Math.sin(around) * r, "#b49ec8");
  }

  /* 관람차 칸 — 살 끝마다 하나씩 */
  for (let i = 0; i < 8; i += 1) {
    const spoke = angle + (Math.PI * 2 * i) / 8;
    p.disc(cx + Math.cos(spoke) * r, cy + Math.sin(spoke) * r, 1, i % 2 === 0 ? "#ffd24a" : "#ff8f8f");
  }

  p.disc(cx, cy, 2, "#e8d8b0");
}

function drawTent(p: Painter, cx: number, groundY: number, half: number) {
  for (let row = 0; row < half * 2; row += 1) {
    const width = (row / (half * 2)) * half;
    const y = groundY - half * 2 + row;
    p.rect(cx - width, y, width * 2, 1, row % 4 < 2 ? "#e8d8b0" : "#c0392b");
  }

  p.rect(cx, groundY - half * 2 - 3, 1, 3, "#6b5a7a");
}


/* ════════════════════════════════════════════════════
   7. 만원 열차 — 정류장에서 타고, 봉 라인을 달린다
   ════════════════════════════════════════════════════ */

/**
 * 네 막이라 한 바퀴가 길다 — 도착·탑승(0~0.42) · 출발과 줌아웃(~0.55) · 주행(~1).
 * 인스타 스토리가 15초까지 받으므로 12초는 한 편으로 들어간다.
 */
const TRAIN_LOOP = 12000;
const TRAIN_BOARD_FROM = 0.16;
const TRAIN_DEPART_FROM = 0.42;
const TRAIN_RIDE_FROM = 0.55;

/** 역 이름. **여기만 고치면 다른 종목 역이 된다.** */
const STATION_NAME = "하이닉스";

/** 열차 한 칸의 도트 크기 (칸 단위). 줌은 정수로만 밟는다 — 소수 배율은 도트를 뭉갠다. */
const TRAIN_ZOOM = [3, 2, 1] as const;
/** 한 칸의 길이 (유닛). 역과 주행이 같은 그림을 쓰므로 여기 하나로 정해진다. */
const CAR_LEN = 18;
/** 첫 문의 자리 (유닛) */
const DOOR_AT = 5;
/** 열차가 선 선로 높이와 승강장 윗면 — 개미는 승강장에, 열차는 그 뒤에 선다 */
const TRAIN_BASE = 138;
const PLATFORM_TOP = 154;
/** 주행할 때 붙는 칸 수. **둘이면 족하다** — 길수록 곡선에서 레일과 어긋난 게 눈에 띈다. */
const TRAIN_CARS = 2;
/**
 * 구간의 가로(=지나는 데 걸리는 시간)와 오르내림.
 *
 * **오르막과 내리막을 다르게 잡는다** — 오래 걸려 많이 오르고, 짧은 사이에 더 많이
 * 떨어진다. 카메라는 일정한 속도라 가로가 곧 시간이라, 이 두 상수가 "천천히 올라가서
 * 순식간에 무너진다"를 만든다.
 */
/**
 * 구간 가로. **한 화면(108칸)에 꼭지가 둘까지만** 보이도록 오르막+내리막 한 쌍을
 * 화면 폭 언저리로 잡는다 — 좁게 두면 오르내림이 서너 개씩 겹쳐 무슨 움직임인지 안 읽힌다.
 *
 * 오르막은 **눕혀야 한다**: 칸을 곧게 그리므로 기울기가 세면 레일이 칸을 관통한다.
 * 반대로 내리막은 거의 절벽으로 세운다 — 그러면 칸이 곧은 채로 뚝 떨어져서, 기울일
 * 필요가 아예 없어지고 낙차도 제일 크게 보인다.
 */
const RISE_W = 95;
const RISE_DY = 0.32;
const FALL_W = 10;
const FALL_DY = 0.44;
const CHART_BASE = 150;
/**
 * 봉 높이의 폭. **너무 크면 열차가 레일에서 뜬다** — 칸은 수평인데 선로가 가파르면
 * 칸의 앞뒤 끝이 선로에서 벌어진다. 칸을 짧게(18유닛) 잡고 기울기를 눕혀 맞춘다.
 */
/**
 * 봉 높이의 폭. 낙폭을 키워달라는 요청으로 1.5배 올렸다 (86 → 129).
 * 기울기가 가팔라진 만큼 구간 가로도 같이 넓혀야 칸이 레일에서 안 뜬다.
 */
const CHART_AMP = 129;

interface ChartPoint {
  /** 세계 가로 좌표 (1 = 격자 한 칸) */
  x: number;
  /** 높이 0~1 */
  y: number;
}

/**
 * 봉의 꺾은선. **오르내림을 번갈아 못 박는다** — 무작위로 두면 한 방향으로만 이어지는
 * 판이 나오고, 그러면 "말풍선이 봉을 따라 바뀐다"는 게 화면에서 안 보인다.
 * 가로는 구간마다 다르다 (오르막은 길게, 내리막은 짧게).
 */
function trainChart(seed: number): ChartPoint[] {
  const random = seededRandom(seed + 91);
  const points: ChartPoint[] = [{ x: 0, y: 0.24 }];

  for (let i = 0; i < 9; i += 1) {
    const rising = i % 2 === 0;
    const previous = points[i] as ChartPoint;
    const width = rising
      ? RISE_W * (0.8 + random() * 0.45)
      : FALL_W * (0.75 + random() * 0.5);
    const delta = rising
      ? RISE_DY * (0.75 + random() * 0.5)
      : -FALL_DY * (0.8 + random() * 0.55);

    points.push({
      x: previous.x + width,
      y: Math.min(0.94, Math.max(0.06, previous.y + delta)),
    });
  }

  return points;
}

const train: MemeScene = {
  id: "train",
  title: "만원 열차",
  blurb: "정류장에 열차가 선다. 우르르 타고, 봉 라인을 달린다.",
  loopMs: TRAIN_LOOP,

  draw(p, frame) {
    const a = frame.time / TRAIN_LOOP;
    const osc = oscillator(a);
    const chart = trainChart(frame.seed);

    if (a < TRAIN_DEPART_FROM) return drawStationAct(p, frame, a, osc);

    /* ── 출발 이후 — 하늘과 차트 ── */
    p.vGradient(0, p.h, "#101c33", "#2a3f63");

    const starRandom = seededRandom(frame.seed + 77);
    for (let i = 0; i < 30; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const y = Math.floor(starRandom() * 90);
      p.faded(0.3 + 0.4 * osc(3, i * 0.11), () => p.dot(x, y, "#cfd8e8"));
    }

    /* 달 — 위쪽이 통째로 비면 열차가 화면 아래에 눌린 것처럼 보인다 */
    p.disc(84, 32, 9, "#cfd8e8");
    p.disc(81, 29, 2, "#a8b4c8");
    p.disc(87, 35, 3, "#a8b4c8");

    /* 멀어지는 도시 — 열차가 역을 떠났다는 걸 배경이 말해준다 */
    const cityRandom = seededRandom(frame.seed + 83);
    for (let i = 0; i < 14; i += 1) {
      const w = 5 + Math.floor(cityRandom() * 7);
      const x = Math.floor(cityRandom() * p.w);
      const h = 10 + Math.floor(cityRandom() * 26);
      p.rect(x, p.h - 18 - h, w, h + 18, "#16243c");
      if (i % 2 === 0) p.rect(x + 1, p.h - 16 - h, 1, 1, "#ffd24a");
    }

    /*
     * 카메라. **한 구간 앞에서 시작한다** — 0에서 출발하면 화면 왼쪽에 레일이 없어서
     * 열차가 허공에 뜬 것처럼 보인다. 세계 한 칸이 격자 한 칸이라 가로는 그대로 쓴다.
     *
     * **속도는 일정하다.** 가속을 넣었더니 뒤쪽 구간이 순식간에 지나가 말풍선이 뜨다
     * 말았다. 대신 구간의 가로가 제각각이라, 같은 속도로 가도 오르막은 오래 걸리고
     * 내리막은 순식간에 끝난다 — 그게 이 판이 노리는 리듬이다.
     */
    const move = clamp01((a - TRAIN_DEPART_FROM) / (1 - TRAIN_DEPART_FROM));
    const first = chart[1] as ChartPoint;
    /** 한 바퀴에 지나는 구간 수 — 오르막 둘·내리막 둘이면 이야기가 한 번 완결된다 */
    const last = chart[5] as ChartPoint;
    const camX = lerp(first.x, last.x, move);

    const segmentAt = (worldX: number) => {
      for (let i = 0; i < chart.length - 1; i += 1) {
        if (worldX < (chart[i + 1] as ChartPoint).x) return Math.max(0, i);
      }
      return chart.length - 2;
    };
    const priceAt = (worldX: number) => {
      const i = segmentAt(worldX);
      const from = chart[i] as ChartPoint;
      const to = chart[i + 1] as ChartPoint;
      return lerp(from.y, to.y, (worldX - from.x) / (to.x - from.x));
    };
    const railY = (worldX: number) => CHART_BASE - priceAt(worldX) * CHART_AMP;
    const screenX = (worldX: number) => 54 + (worldX - camX);

    /* ── 봉 ── */
    for (let i = 0; i < chart.length - 1; i += 1) {
      const from = chart[i] as ChartPoint;
      const to = chart[i + 1] as ChartPoint;
      const width = Math.max(6, Math.min(18, (to.x - from.x) * 0.55));
      const cx = screenX((from.x + to.x) / 2);
      if (cx < -24 || cx > p.w + 24) continue;

      const open = CHART_BASE - from.y * CHART_AMP;
      const close = CHART_BASE - to.y * CHART_AMP;
      const up = close < open;
      const top = Math.min(open, close);
      const height = Math.max(3, Math.abs(close - open));

      p.rect(cx - 1, top - 8, 2, height + 16, up ? "#ff8f8f" : "#8fc0ff");
      p.rect(cx - width / 2, top, width, height, up ? "#ff5c5c" : "#5c9dff");
      p.rect(cx - width / 2 + 2, top + 2, Math.max(2, width * 0.25), height - 4, up ? "#ffb3b3" : "#a8ccff");
    }

    /* ── 레일 — 봉 끝을 잇는 선이 곧 선로다 ── */
    for (let x = -1; x <= p.w; x += 1) {
      const worldX = camX + (x - 54);
      if (worldX < 0 || worldX > last.x + FALL_W) continue;
      const y = railY(worldX);
      p.rect(x, y, 1, 2, "#e8d8b0");
      p.rect(x, y + 2, 1, 1, "#7a6a4a");
    }

    /* ── 열차 — 칸마다 제 자리의 높이와 기울기로 놓아 선로를 따라간다 ── */
    const zoom = TRAIN_ZOOM[
      Math.min(
        TRAIN_ZOOM.length - 1,
        Math.floor(
          clamp01((a - TRAIN_DEPART_FROM) / (TRAIN_RIDE_FROM - TRAIN_DEPART_FROM)) *
            TRAIN_ZOOM.length,
        ),
      )
    ] as number;
    const carSpan = (CAR_LEN + 2) * zoom;

    for (let i = TRAIN_CARS - 1; i >= 0; i -= 1) {
      const worldX = camX - i * carSpan;
      if (worldX < 0) continue;

      drawTrainCar(p, screenX(worldX) - carSpan / 2, railY(worldX), zoom, {
        packed: true,
        lead: i === 0,
        bob: flip2(frame.time + i * 90, 180) ? 0 : 1,
      });
    }

    if (a < TRAIN_RIDE_FROM) {
      return speakWindow(
        "train",
        frame,
        TRAIN_DEPART_FROM * TRAIN_LOOP,
        TRAIN_RIDE_FROM * TRAIN_LOOP,
        1,
        54,
        railY(camX) - 13 * zoom,
      );
    }

    /*
     * 말풍선은 **지금 지나는 구간의 방향**을 따른다. 오를 때와 내릴 때 할 말이 다르고,
     * 그게 이 판의 전부다 — 박자(BEAT_MS)로 끊으면 구간이 바뀌는 순간과 어긋난다.
     * 내리막은 순식간이라 페이드도 그 길이에 맞춰 줄인다 (안 그러면 뜨다 만다).
     */
    /*
     * **말풍선은 한 박자 늦게 따라온다.** 내리막은 순식간이라 구간에 딱 맞춰 띄우면
     * 뜨다 만다 — 조금 뒤처져 읽으면 떨어지는 동안 떴다가 바닥에 닿고 나서 사라진다.
     * 사라지는 속도도 구간 길이가 아니라 **지나온 거리**로 재야 길고 짧은 구간이
     * 같은 리듬으로 뜬다.
     */
    const readAt = camX - 8;
    const segment = segmentAt(readAt);
    const from = chart[segment] as ChartPoint;
    const to = chart[segment + 1] as ChartPoint;
    const edge = Math.min(readAt - from.x, to.x - readAt);

    return {
      text: pickMemeLine(
        to.y > from.y ? "trainUp" : "trainDown",
        frame.seed,
        segment,
        chart.length - 1,
      ),
      x: 54,
      y: railY(camX) - 13 * zoom,
      alpha: clamp01(edge / 5),
    };
  },
};

/** 1막 — 정류장에 열차가 서고 개미들이 우르르 탄다 */
function drawStationAct(
  p: Painter,
  frame: SceneFrame,
  a: number,
  osc: (cycles: number, phase?: number) => number,
): SceneBubble {
  /* 지하 승강장 — 벽 · 선로 · 승강장이 위에서 아래로 층을 이룬다 */
  p.vGradient(0, TRAIN_BASE, "#161d2a", "#28323f");

  /* 벽 기둥과 타일 줄눈 — 없으면 위쪽 절반이 통째로 빈 색면이 된다 */
  for (let x = 4; x < p.w; x += 26) {
    p.rect(x, 0, 7, TRAIN_BASE - 30, "#1f2836");
    p.rect(x, 0, 1, TRAIN_BASE - 30, "#2c384a");
  }
  for (let y = 58; y < TRAIN_BASE - 30; y += 14) {
    for (let x = 0; x < p.w; x += 6) p.rect(x, y, 4, 1, "#2c384a");
  }

  /* 역 이름 간판 — 판때기는 도트로, 글자는 늘린 뒤에 얹는다 */
  p.rect(14, 20, 80, 3, "#7a838f");
  p.rect(16, 23, 76, 30, "#f3ece2");
  p.rect(16, 23, 76, 1, "#ffffff");
  p.rect(16, 52, 76, 1, "#b6ada0");

  /* 열차가 오른쪽에서 미끄러져 들어와 선다. 두 칸을 물려 화면을 채운다. */
  const arrive = easeOut(clamp01(a / TRAIN_BOARD_FROM));
  const lead = lerp(p.w + 30, 44, arrive);
  const doorOpen = a > TRAIN_BOARD_FROM;
  const packed = a > TRAIN_BOARD_FROM + 0.18;
  const bob = arrive < 1 && flip2(frame.time, 120) ? 1 : 0;

  for (const index of [1, 0]) {
    drawTrainCar(p, lead - index * (CAR_LEN + 1) * 3, TRAIN_BASE, 3, {
      packed,
      lead: index === 0,
      doorOpen,
      bob,
    });
  }

  /* 선로 그늘과 승강장 — 개미는 승강장(앞쪽)에 서고 열차는 그 뒤에 선다 */
  p.rect(0, TRAIN_BASE, p.w, PLATFORM_TOP - TRAIN_BASE, "#0e131c");
  p.rect(0, PLATFORM_TOP, p.w, 3, "#c9a83a");
  p.rect(0, PLATFORM_TOP + 3, p.w, p.h, "#39404d");
  for (let x = 2; x < p.w; x += 8) p.rect(x, PLATFORM_TOP + 7, 4, 1, "#2c323d");

  /*
   * 개미들 — 승강장에서 문 쪽으로 우르르 몰렸다가 하나씩 사라진다.
   * **오르는 시늉으로 위로도 옮긴다**: 옆으로만 밀면 문을 지나쳐 걸어가는 그림이 된다.
   */
  const board = clamp01((a - TRAIN_BOARD_FROM) / (TRAIN_DEPART_FROM - TRAIN_BOARD_FROM));
  const crowd = seededRandom(frame.seed + 29);
  const door = lead + DOOR_AT * 3;

  for (let i = 0; i < 10; i += 1) {
    const start = 2 + i * 10 + crowd() * 5;
    const enter = clamp01((board - i * 0.07) / 0.34);
    if (enter >= 1) continue;

    const pose: AntPose = flip2(frame.time + i * 60, 150) ? "crawl1" : "crawl2";
    /* 먼저 걸어가고(0~0.65) 문 앞에서 올라탄다(0.65~1) — 처음부터 위로 끌면 날아간다 */
    const walk = clamp01(enter / 0.65);
    const step = clamp01((enter - 0.65) / 0.35);

    p.faded(enter > 0.82 ? (1 - enter) * 5.5 : 1, () =>
      p.sprite(
        antPixels(22 + i * 2, pose),
        lerp(start, door - 7, walk),
        lerp(PLATFORM_TOP + 2, TRAIN_BASE - 6, step) - 16,
        1,
      ),
    );
  }

  /* 출입문 표시등 — 출발이 가까울수록 깜빡인다 */
  p.faded(osc(10) > 0 ? 1 : 0.2, () => p.rect(door + 3, TRAIN_BASE - 42, 4, 2, "#ff8f8f"));

  /*
   * **막의 창 안에서 두 마디** 한다. 전역 박자(`speak`)로 끊으면 막이 바뀌는 순간
   * 말풍선이 중간에 잘려 사라진다 — 도착·탑승은 한 막이라 그 창을 그대로 쓴다.
   */
  const bubble = speakWindow(
    "train",
    frame,
    0,
    TRAIN_DEPART_FROM * TRAIN_LOOP,
    2,
    34,
    PLATFORM_TOP - 24,
  );

  return {
    ...bubble,
    /* 역 이름은 이 판의 제목이라 말풍선보다 크게 (11의 배수라 88px) */
    labels: [{ text: STATION_NAME, x: 54, y: 33, alpha: 1, unit: 8 }],
  };
}

/**
 * 열차 한 칸. **문과 창문이 있어야 열차로 읽힌다** — 네모에 바퀴만 달면 화물칸이 된다.
 *
 * 길이를 18유닛으로 잡은 건 **역과 주행이 같은 그림을 쓰기 위해서다**: 3배면 승강장에서
 * 반 화면을 채우고, 1배면 네 칸을 이어 붙여도 화면에 들어온다. 가까울 때와 멀 때 다른
 * 열차를 그리면 줌아웃하는 동안 열차가 다른 물건으로 바뀐다.
 */
function drawTrainCar(
  p: Painter,
  left: number,
  baseY: number,
  unit: number,
  opts: { packed?: boolean; lead?: boolean; doorOpen?: boolean; bob?: number },
) {
  const u = (n: number) => n * unit;
  const top = baseY - u(13) + (opts.bob ?? 0);

  /*
   * **기울여 그린다.** 칸을 수평 네모로 두면 가파른 구간에서 앞뒤 끝이 레일에서 떠오른다.
   * 도트 그림은 회전을 못 하므로, 세로 한 줄씩 제 자리의 높이만큼 내려 찍어 평행사변형을
   * 만든다 — 한 줄의 폭이 도트 하나(unit)라 계단이 그림의 해상도와 어긋나지 않는다.
   */
  /*
   * **칸은 곧게 그린다.** 한때 세로로 밀어 기울였는데(도트 그림은 회전을 못 한다),
   * 밀기는 길이를 늘여서 칸이 사선 얼룩으로 늘어났다 — 열차가 열차로 안 보이면
   * 기울기를 맞춘 보람이 없다. 대신 봉을 넓게 잡아 기울기를 눕히고, 레일을 칸보다
   * 먼저 그려 **칸 밑에서 가려지게** 둔다. 그러면 어긋난 만큼이 눈에 안 걸린다.
   */
  const slant = (x: number, y: number, w: number, h: number, color: string) =>
    p.rect(x, y, w, h, color);

  slant(left, top, u(CAR_LEN), u(12), "#d8dde6");
  slant(left, top, u(CAR_LEN), u(1), "#9aa3b0");
  slant(left, top + u(9), u(CAR_LEN), u(1), "#ff5c5c");
  slant(left, top + u(11), u(CAR_LEN), u(1), "#7c8593");

  /* 창문 — 탄 개미들이 여기로 보인다 */
  for (const wx of [2, 8, 13]) {
    slant(left + u(wx), top + u(2), u(3), u(4), "#2b3a4f");
    if (!opts.packed) continue;

    for (let k = 0; k < 2; k += 1) {
      const hx = left + u(wx + 0.3) + k * u(1.4);
      slant(hx, top + u(3), u(1.1), u(2.6), "#8a6238");
      slant(hx + u(0.25), top + u(3.6), u(0.35), u(0.5), "#ffffff");
    }
  }

  /* 문 */
  for (const dx of [DOOR_AT, DOOR_AT + 6]) {
    slant(left + u(dx), top + u(2), u(2), u(8), opts.doorOpen ? "#141a24" : "#8fb4d8");
    if (!opts.doorOpen) slant(left + u(dx + 0.9), top + u(2), u(0.3), u(8), "#5f7ea0");
  }

  /* 앞칸이면 기관실 창과 전조등 */
  if (opts.lead) {
    slant(left + u(CAR_LEN - 3), top + u(2), u(2), u(4), "#38506b");
    slant(left + u(CAR_LEN - 1), top + u(7), u(1), u(2), "#ffe9a8");
  }

  /* 바퀴 */
  for (const wx of [3, 6, 12, 15]) {
    slant(left + u(wx), baseY - u(1), u(2), u(1.4), "#2a2f38");
  }
}

/* ════════════════════════════════════════════════════
   8. 로켓 발사 — 화성 간다더니
   ════════════════════════════════════════════════════ */

/**
 * 네 막 — 점화(~0.12) · 상승(~0.56) · 추진 꺼짐(~0.66) · 추락(~1).
 * 상승은 탑승처럼 **하늘색을 세계 좌표로** 정한다 — 그래야 올라가는 내내 색이 이어진다.
 * 추락은 처음으로 되돌아오지 않는다 — 한 바퀴 끝은 흠이 아니라 컷이다.
 */
const ROCKET_LOOP = 9600;
/** 막 경계 (한 바퀴 안의 위치) */
const RKT_IGNITE = 0.06;
const RKT_LIFT = 0.12;
/** 로켓이 화면 가운데로 올라와 멈추는 시점 — 이후는 카메라(고도)만 오른다 */
const RKT_HOVER = 0.34;
const RKT_CUT = 0.56;
const RKT_DEAD = 0.64;
const RKT_APEX = 0.66;
/** 정점에서 코가 옆으로 넘어가 있는 구간 — 이 시점을 지나면 180도 뒤집혀 떨어진다 */
const RKT_TIP = 0.71;

/** 발사대가 놓인 세계 좌표와, 서 있을 때 발사대의 화면 높이 */
const RKT_GROUND = 540;
const RKT_PAD_Y = 160;
/** 정점 고도와, 한 바퀴 끝까지 잃는 고도 (세계 단위) */
const RKT_PEAK = 880;
const RKT_FALL = 460;
const RKT_X = 54;
/** 로켓 전체 키 — 엔진 4 + 몸통 36 + 코 9. 몸통은 세로 워드마크가 들어가는 길이다. */
const RKT_H = 49;

/**
 * 몸통에 세로로 새기는 SPACEX 워드마크 (한 글자 7×5). 진짜 팰컨 9도 부스터에 세로로
 * 적는다 — 몸통이 14칸이라 가로로는 여섯 글자가 못 들어가고, 세로가 크게 쓰는 유일한
 * 길이다. 마지막 X만 회색인 건 로고의 회색 스우시 흉내다.
 */
const RKT_WORDMARK: readonly (readonly string[])[] = [
  [".111111", "11.....", ".11111.", ".....11", "111111."], // S
  ["111111.", "11...11", "111111.", "11.....", "11....."], // P
  [".11111.", "11...11", "1111111", "11...11", "11...11"], // A
  [".111111", "11.....", "11.....", "11.....", ".111111"], // C
  ["1111111", "11.....", "11111..", "11.....", "1111111"], // E
  ["11...11", ".11.11.", "..111..", ".11.11.", "11...11"], // X
];
/** 화성이 떠 있는 세계 높이 — 정점에서 화면 가운데쯤 온다. 끝내 못 닿는 목적지다. */
const RKT_MARS = -430;

const RKT_SKY: readonly [number, string][] = [
  [-560, "#03040c"],
  [-300, "#0a1233"],
  [-40, "#1b4382"],
  [220, "#2f74b8"],
  [420, "#5fb2ee"],
  [560, "#a2daf6"],
];

/**
 * 코에 올라탄 세 마리. 가운데가 꼭짓점, 양옆은 코 어깨에 매달린다 — 간격을 더 벌리면
 * 로켓 폭을 벗어나 허공에 떠 보이고, 좁히면 셋이 한 덩어리가 된다. 가운데를 마지막에
 * 그려 앞줄로 세운다.
 */
const RKT_RIDERS = [
  { dx: -12, drop: 8, stage: 36 },
  { dx: 12, drop: 8, stage: 28 },
  { dx: 0, drop: 2, stage: 46 },
] as const;

const rocket: MemeScene = {
  id: "rocket",
  title: "로켓 발사",
  blurb: "불 뿜으며 화성으로. 연료가 다 떨어지기 전까진.",
  loopMs: ROCKET_LOOP,

  draw(p, frame) {
    const a = frame.time / ROCKET_LOOP;
    const osc = oscillator(a);

    /* 고도 — 정점까지 차오르고, 추진이 꺼지면 가속하며 떨어진다 */
    const climb = easeInOut(clamp01((a - 0.14) / (RKT_APEX - 0.14)));
    const fall = clamp01((a - RKT_APEX) / (1 - RKT_APEX));
    const alt = RKT_PEAK * climb - RKT_FALL * fall * fall;
    const camTop = RKT_GROUND - RKT_PAD_Y - alt;
    const sy = (worldY: number) => worldY - camTop;

    /* 로켓의 화면 자리 — 이륙하면 가운데로 올라와 멈추고, 떨어지면 아래로 처진다 */
    const bottom =
      lerp(RKT_PAD_Y, 118, easeInOut((a - RKT_LIFT) / (RKT_HOVER - RKT_LIFT))) +
      70 * fall * fall;
    /* 추진 중엔 부르르 떨고, 떨어질 땐 좌우로 크게 흔들린다 */
    const thrusting = a >= RKT_IGNITE && a < RKT_DEAD;
    let jx = 0;
    if (a >= RKT_APEX) jx = flip2(frame.time, 160) ? -1 : 1;
    else if (thrusting) jx = flip2(frame.time, 100) ? 1 : 0;
    const cx = RKT_X + jx;

    /* 하늘 — 세 칸씩 끊어 칠한다. 색은 화면 위치가 아니라 세계 좌표가 정한다. */
    for (let row = 0; row < p.h; row += 3) {
      p.rect(0, row, p.w, 3, gradientAt(RKT_SKY, camTop + row));
    }

    /* 별 — 높이 올라갈수록 짙어진다 */
    const starRandom = seededRandom(frame.seed + 19);
    for (let i = 0; i < 44; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const worldY = 60 - starRandom() * 700;
      const twinkle = 0.45 + 0.55 * osc(3, i * 0.16);
      const y = sy(worldY);
      if (y < -2 || y > p.h) continue;

      p.faded(clamp01(twinkle) * clamp01((200 - camTop) / 240), () => {
        p.dot(x, y, "#ffffff");
        if (i % 7 === 0) {
          p.dot(x - 1, y, "#dfe8ff");
          p.dot(x + 1, y, "#dfe8ff");
          p.dot(x, y - 1, "#dfe8ff");
          p.dot(x, y + 1, "#dfe8ff");
        }
      });
    }

    /* 화성 — 정점에서 눈앞까지 오지만 끝내 닿지 않는다 */
    const marsY = sy(RKT_MARS);
    if (marsY > -16 && marsY < p.h + 16) {
      p.faded(0.16, () => p.disc(86, marsY, 9, "#d8542f"));
      p.disc(86, marsY, 7, "#d8542f");
      p.disc(83, marsY - 2, 2, "#a83c22");
      p.disc(89, marsY + 3, 3, "#a83c22");
      p.dot(83, marsY - 5, "#f0906a");
    }

    /* 구름 — 이륙하며 아래로 스쳐 내려간다 */
    const cloudRandom = seededRandom(frame.seed + 23);
    for (let i = 0; i < 7; i += 1) {
      const worldY = 430 - cloudRandom() * 280;
      const x = 6 + cloudRandom() * 92 + osc(1, i * 0.3) * 3;
      const size = 4 + Math.floor(cloudRandom() * 4);
      const y = sy(worldY);
      if (y < -20 || y > p.h + 20) continue;
      drawCloud(p, x, y, size);
    }

    /* 신기루 얼굴 — 추락하는 하늘에 우는 얼굴이 흐리게 비친다 */
    const mirage = clamp01((a - 0.7) / 0.08) * clamp01((0.985 - a) / 0.045);
    if (mirage > 0) drawMirageFace(p, a, osc, mirage);

    /* ── 발사대 — 이륙하면 통째로 화면 아래로 빠진다 ── */
    const groundY = sy(RKT_GROUND);
    if (groundY < p.h) {
      p.rect(0, groundY, p.w, 3, "#5a6a4a");
      p.rect(0, groundY + 3, p.w, p.h - groundY - 3, "#3c4a34");
      /* 콘크리트 패드와 로켓 밑 화염 배출구 */
      p.rect(26, groundY, 56, 4, "#7d8694");
      p.rect(26, groundY, 56, 1, "#9aa3b0");
      p.rect(44, groundY + 1, 20, 3, "#2a2f38");

      /* 발사탑 — 가로대와 빗대가 있어야 철탑으로 읽힌다 */
      const towerTop = groundY - 54;
      p.rect(70, towerTop, 2, 54, "#4a5568");
      p.rect(78, towerTop, 2, 54, "#4a5568");
      for (let yy = towerTop; yy < groundY - 8; yy += 9) {
        p.rect(70, yy, 10, 1, "#5a6578");
        p.line(70, yy + 9, 79, yy, "#3c4658");
      }
      p.faded(osc(8) > 0 ? 1 : 0.25, () => p.rect(74, towerTop - 3, 2, 2, "#ff5c5c"));

      /* 거치대 — 이륙하면 로켓만 떠난다 */
      if (a < RKT_LIFT) {
        p.rect(RKT_X - 10, RKT_PAD_Y - 3, 3, 3, "#5a6578");
        p.rect(RKT_X + 7, RKT_PAD_Y - 3, 3, 3, "#5a6578");
      }

      /* 점화 수증기 — 로켓을 안 따라가고 발사대에 남아 옆으로 퍼진다 */
      for (let i = 0; i < 6; i += 1) {
        const age = clamp01((a - RKT_IGNITE - i * 0.015) / 0.3);
        if (age <= 0 || age >= 1) continue;
        const dir = i % 2 === 0 ? 1 : -1;
        const x = RKT_X + dir * (8 + age * 34 + i);
        const y = groundY - 2 - age * 6 - (i % 3);
        p.faded(0.5 * (1 - age), () => p.disc(x, y, 3 + age * 6, "#dfe4ea"));
      }
    }

    /* 속도선 — 오를 때는 아래로, 떨어질 때는 위로 스친다. 막에 갇혀 있어 이음매와 무관하다. */
    const rush = clamp01((a - 0.18) / 0.1) * clamp01((RKT_CUT + 0.04 - a) / 0.08);
    const plunge = clamp01((a - 0.72) / 0.08) * clamp01((0.99 - a) / 0.05);
    if (rush > 0 || plunge > 0) {
      const streakRandom = seededRandom(frame.seed + 43);
      for (let i = 0; i < 14; i += 1) {
        const x = Math.floor(streakRandom() * p.w);
        const length = 6 + Math.floor(streakRandom() * 8);
        const laps = 3 + Math.floor(streakRandom() * 4);
        const span = p.h + length;
        const travel = (streakRandom() * span + a * laps * span) % span;
        if (rush > 0) p.faded(0.2 * rush, () => p.rect(x, travel - length, 1, length, "#ffffff"));
        if (plunge > 0)
          p.faded(0.2 * plunge, () => p.rect(x, span - travel - length, 1, length, "#cfe9ff"));
      }
    }

    /* 불꽃과 배기 불티 */
    const flameLen = rocketFlameLength(a, frame.time);
    if (flameLen > 1) drawRocketFlame(p, cx, bottom, flameLen);

    if (a >= RKT_LIFT && a < RKT_CUT) {
      const spark = seededRandom(frame.seed + 37);
      for (let i = 0; i < 4; i += 1) {
        const phase = ((frame.time + i * 240) % 480) / 480;
        const x = cx - 5 + Math.floor(spark() * 10);
        const y = bottom + flameLen + 2 + phase * 12;
        p.faded(1 - phase, () => p.dot(x, y, i % 2 === 0 ? "#ffd24a" : "#ff8f3f"));
      }
    }

    /*
     * 꺼진 엔진에서 새는 연기. 로켓은 떨어지고 연기는 그 자리에 남아야 해서,
     * **뿜은 순간의 로켓 위치**를 같은 공식으로 되짚어 그 자리에 그린다 (상태를 안 쥔다).
     * 뒤집히는 동안 엔진 끝이 위로 넘어가므로 몸통 가운데 높이에 걸어둔다.
     */
    if (a >= RKT_DEAD) {
      for (let i = 0; i < 4; i += 1) {
        const emit = RKT_DEAD + 0.01 + i * 0.055;
        const age = (a - emit) / 0.22;
        if (age <= 0 || age >= 1) continue;
        const emitBottom = 118 + 70 * clamp01((emit - RKT_APEX) / (1 - RKT_APEX)) ** 2;
        const x = RKT_X + (i % 2 === 0 ? -3 : 3) * (1 + age);
        const y = emitBottom - RKT_H / 2 - age * 26;
        p.faded(0.4 * (1 - age), () => p.disc(x, y, 2 + age * 4, "#aab4c2"));
      }
    }

    /*
     * 로켓과 올라탄 셋. 정점을 지나면 축이 넘어간다 — 옆모습 한 박자(side)를 거쳐
     * 코가 아래를 보며(down) 떨어진다. 회전 중심이 몸통 가운데라 자세가 바뀌어도 안 튄다.
     */
    const ccy = bottom - RKT_H / 2;
    const attitude: RocketAttitude =
      a < RKT_APEX ? "up" : a < RKT_TIP ? "side" : "down";
    drawRocketShip(p, cx, ccy, attitude);

    const noseTip = bottom - RKT_H;
    if (attitude === "up") {
      const panic = a >= RKT_CUT;
      RKT_RIDERS.forEach((rider, i) => {
        /* 오를 땐 느긋하게 손 흔들고, 추진이 꺼지면 빠르게 허우적대며 이리저리 돌아본다 */
        const pose: AntPose = panic
          ? flip2(frame.time + i * 70, 150)
            ? "wave1"
            : "wave2"
          : flip2(frame.time + i * 150, 300)
            ? "wave1"
            : "wave2";
        const flip = panic ? flip2(frame.time + i * 240, 480) : rider.dx < 0;
        const jitter = panic && flip2(frame.time + i * 80, 160) ? 1 : 0;

        outlined(
          p,
          antPixels(rider.stage, pose),
          cx + rider.dx - 8 + jitter,
          noseTip + rider.drop - 16,
          1,
          "#141a26",
          flip,
        );
      });
    } else {
      /*
       * 뒤집힌 뒤 — 꼭대기가 된 면(옆구리 → 엔진 꽁무니) 위를 우왕좌왕 뛰어다닌다.
       * 삼각파로 갔다 되돌아오고, 가는 방향을 따라 몸도 뒤집는다. 셋의 위상을 어긋나게
       * 두어 서로 스쳐 지나가야 갈팡질팡으로 읽힌다.
       */
      const surfaceY = attitude === "side" ? ccy - 7 : ccy - RKT_H / 2;
      const range = attitude === "side" ? 22 : 12;
      RKT_RIDERS.forEach((rider, i) => {
        const run = ((frame.time + i * 400) % 1200) / 1200;
        const tri = run < 0.5 ? run * 2 : 2 - run * 2;
        const off = Math.round((tri - 0.5) * range);
        const base = attitude === "side" ? rider.dx : Math.round(rider.dx / 2);
        const crawl: AntPose = flip2(frame.time + i * 60, 120) ? "crawl1" : "crawl2";

        outlined(
          p,
          antPixels(rider.stage, crawl),
          cx + base + off - 8,
          surfaceY - 16,
          1,
          "#141a26",
          run >= 0.5,
        );
      });
    }

    /* 말풍선 — 오를 땐 환호, 떨어질 땐 탄식. 엔진이 꺼지고 뒤집히는 사이는 말을 잃는다. */
    if (frame.time < 6200) {
      return speakWindow("rocket", frame, 1450, 5250, 2, RKT_X, noseTip - 16);
    }
    /* 하강은 늘 down 자세라 개미들이 선 엔진 꽁무니 위에 단다 */
    return speakWindow("rocketDown", frame, 7000, 9350, 1, RKT_X, ccy - RKT_H / 2 - 18);
  },
};

/** 불꽃 길이. 점화 때 자라고, 추진 중엔 일렁이고, 꺼질 땐 짧아지며 켜졌다 꺼졌다 한다. */
function rocketFlameLength(a: number, time: number): number {
  if (a < RKT_IGNITE || a >= RKT_DEAD) return 0;
  if (a < RKT_LIFT) return 16 * easeOut((a - RKT_IGNITE) / (RKT_LIFT - RKT_IGNITE));
  if (a < RKT_CUT) return flip2(time, 100) ? 16 : 13;

  /* 마지막 기침 */
  if (!flip2(time, 120)) return 0;
  return lerp(12, 3, (a - RKT_CUT) / (RKT_DEAD - RKT_CUT));
}

/** 노즐 불꽃 — 겉주황·속노랑·심흰색 세 겹이 아래로 좁아진다 */
function drawRocketFlame(p: Painter, cx: number, top: number, len: number) {
  const layer = (l: number, halfWidth: number, color: string) => {
    for (let i = 0; i < l; i += 1) {
      const half = Math.max(1, Math.round(halfWidth * (1 - i / l)));
      p.rect(cx - half, top + i, half * 2, 1, color);
    }
  };

  layer(len, 6, "#ff8f3f");
  layer(len * 0.72, 4, "#ffd24a");
  layer(len * 0.4, 2, "#fff3b0");
}

/** 로켓의 자세 — 서 있다가(up), 정점에서 옆으로 넘어가(side), 코를 아래로 떨어진다(down) */
type RocketAttitude = "up" | "side" | "down";

/**
 * 로켓 본체. 흰 원통에 그리드핀, 그리고 세로로 크게 새긴 SPACEX 워드마크 — **미장
 * 로켓이라는 표식은 이 로고가 맡는다.** 짤에 못 넣는 건 손익 숫자지 간판 글자가 아니다
 * (만원 열차의 역 이름과 같은 결). 검은 단 띠와 성조기는 워드마크에 자리를 내줬다 —
 * 14칸 몸통에 셋을 다 넣으면 서로를 가린다.
 *
 * 좌표는 **로켓 로컬**(u: 가로 -7~7, v: 엔진 끝 0 → 코끝 RKT_H)로 적고, 자세가 화면
 * 좌표로 돌린다 — 뒤집힌 로켓을 딴 그림으로 그리면 두 로켓이 서서히 다른 물건이 된다.
 * 회전 중심은 몸통 한가운데(cx, cy)라 자세가 바뀌어도 로켓이 튀지 않는다.
 * 180도로 돌면 워드마크도 거꾸로 선다 — 그게 뒤집힌 티다.
 */
function drawRocketShip(p: Painter, cx: number, cy: number, attitude: RocketAttitude) {
  const H2 = RKT_H / 2;
  const rect = (u: number, v: number, du: number, dv: number, color: string) => {
    if (attitude === "up") p.rect(cx + u, cy + H2 - v - dv, du, dv, color);
    else if (attitude === "down") p.rect(cx - u - du, cy - H2 + v, du, dv, color);
    else p.rect(cx - H2 + v, cy + u, dv, du, color);
  };

  /* 엔진부 — 노즐 세 개 */
  rect(-6, 0, 12, 4, "#3a4250");
  for (const nx of [-5, -1, 3]) rect(nx, -1, 2, 2, "#242a34");

  /* 몸통 — 한쪽에 하이라이트, 반대쪽에 그늘을 세워 원통으로 만든다 */
  rect(-7, 4, 14, 36, "#e8ecf2");
  rect(-6, 4, 1, 36, "#ffffff");
  rect(4, 4, 3, 36, "#c2cad6");

  /* 접힌 그리드핀 */
  rect(-9, 34, 2, 4, "#8a93a2");
  rect(7, 34, 2, 4, "#8a93a2");

  /* 워드마크 — 몸통 한가운데 기둥(u -3~3)에 코 쪽부터 아래로 */
  RKT_WORDMARK.forEach((letter, index) => {
    const ink = index === RKT_WORDMARK.length - 1 ? "#8a93a2" : "#123d6e";
    letter.forEach((row, ry) => {
      [...row].forEach((char, col) => {
        if (char === "1") rect(-3 + col, 38 - index * 6 - ry, 1, 1, ink);
      });
    });
  });

  /* 코 — 끝으로 갈수록 좁아진다 */
  for (let i = 0; i < 9; i += 1) {
    const half = Math.max(1, Math.round((7 * (i + 2)) / 10));
    rect(-half, RKT_H - 1 - i, half * 2, 1, i < 2 ? "#c2cad6" : "#e8ecf2");
  }
}

/**
 * 추락하는 하늘에 비치는 우는 얼굴. 클로즈업의 그 문자맵(`antFacePixels`)을 **반투명으로만**
 * 얹는다 — 도트에는 블러가 없으니 신기루는 투명도와 ±1도트 흔들림으로 만든다. 색을 여기서
 * 새로 만들지 않아야 클로즈업 판과 같은 개미로 읽힌다.
 * 눈물은 두 눈에서 시차를 두고 볼을 타고 또르르 내려간다.
 */
function drawMirageFace(
  p: Painter,
  a: number,
  osc: (cycles: number, phase?: number) => number,
  alpha: number,
) {
  const left = Math.round((p.w - ANT_FACE_W) / 2) + Math.round(osc(2, 0.35));
  const top = 14;

  /* 얼굴은 흐려야 신기루다 — 대신 눈물은 밝게 세워 여기만 또렷이 읽히게 한다 */
  p.faded(alpha * (0.2 + 0.03 * osc(3, 0.6)), () => p.sprite(antFacePixels(20), left, top, 1));

  ANT_FACE_EYES.forEach((eye, i) => {
    const roll = clamp01((a - 0.74 - i * 0.07) / 0.16);
    if (roll <= 0) return;

    const x = left + eye.x + (i === 0 ? -1 : 1);
    const from = top + eye.y + 2;
    const dropY = from + roll * 32;

    /* 지나온 자국을 얇게 남겨야 "흘러내린" 게 보인다 */
    p.faded(alpha * 0.45, () => p.rect(x, from, 1, dropY - from, "#8fc4f0"));
    p.faded(alpha * 0.9, () => {
      p.rect(x, dropY, 2, 3, "#4a8fd8");
      p.rect(x, dropY + 1, 1, 2, "#cfe9ff");
    });
  });
}

/* ════════════════════════════════════════════════════
   9~11. 책상 세 판 — 같은 얼굴, 다른 차트
   ════════════════════════════════════════════════════ */

/**
 * 어두운 방 · 흰 모니터 · 클로즈업 얼굴. **세 판이 이 무대 하나를 공유하고 다른 건
 * 차트 방향과 표정뿐이다** (무념무상=요동·무표정, 안 울어=하강·눈물, 존버 중=상승·미소).
 * 무대를 세 벌 그리면 셋이 서서히 다른 방이 되고, 탭을 오갈 때 그게 그대로 보인다.
 */
const ZEN_LOOP = 7200;
/**
 * 눈 연기 대본 — [ms, 상태]. 껌뻑임 셋, 흘긋(모니터 쪽) 둘, 그리고 마지막엔 스르르
 * 감은 채 루프가 끝난다. **끝이 감은 눈이라 이음매가 안 보인다** — 다음 바퀴 첫
 * 프레임에서 뜨는 게 긴 깜빡임에서 깨어나는 것으로 읽힌다. 무작위로 깜빡이지 않는 건
 * 흘긋과 겹치는 순간이 생기기 때문이다 — 대본 하나가 순서를 못 박는다.
 */
const ZEN_GAZE: readonly (readonly [number, AntGaze])[] = [
  [0, "front"],
  [700, "closed"],
  [850, "front"],
  [1050, "closed"],
  [1200, "front"],
  [1900, "up"],
  [2500, "front"],
  [3100, "closed"],
  [3280, "front"],
  [3900, "up"],
  [4500, "front"],
  [5000, "closed"],
  [5150, "front"],
  [5900, "closed"],
];
/**
 * 모니터 베젤 바깥 상자. **화면 밖으로 넘겨 잡는다** — 좌우와 위를 프레임에 딱 맞추면
 * 베젤 두께만큼 흰 화면이 안쪽으로 밀려 위에 띠가 남는다. 넘겨 잡아야 베젤이 잘리면서
 * 차트가 폭을 꽉 채우고 위쪽 여백이 사라진다.
 */
const ZEN_MON = { x: -3, y: -5, w: 114, h: 60 } as const;
/**
 * 얼굴은 2배(104칸)로 화면 폭을 채우고, 눈이 화면 한가운데 오도록 앉힌다 —
 * 아래(입 밑의 몸)는 잘린다. 클로즈업 판과 같은 규칙이다.
 */
const ZEN_FACE_TOP = 56;
const ZEN_STAGE = 20;
/**
 * 봉 하나가 흐르는 시간. 한 바퀴에 들어가는 봉 수가 곧 수열 길이라, 스크롤이 한 바퀴
 * 돌면 봉이 제자리로 맞물린다.
 *
 * **화면에 보이는 봉보다 수열이 길어야 한다.** 짧으면 한 화면 안에서 같은 봉이 두 번
 * 보이고, 벽지처럼 반복되는 게 그대로 눈에 띈다.
 *
 * 그래서 **이 값이 곧 속도의 하한이다** — 반복이 안 보이려면 한 바퀴에 적어도 화면
 * 하나만큼은 흘러야 한다. 모니터를 폭 가득 키웠을 때 한 번 걸렸던 자리인데(그때는 얇은
 * 봉이 열여섯 칸씩 들어와 400ms까지 몰렸다), 봉을 굵혀 아홉 칸만 들이면서 도로 느긋해졌다.
 */
const ZEN_CANDLE_MS = 600;
const ZEN_CANDLES = ZEN_LOOP / ZEN_CANDLE_MS;
/**
 * 봉 하나가 차지하는 가로 (몸통 9 + 사이 3).
 *
 * **굵게 잡은 건 장대봉을 세우기 위해서다.** 추세 판에서 봉 몸통은 "카메라가 따라
 * 내려간 높이 + 값이 움직인 폭"인데, 한 화면에 봉이 많으면 카메라 낙폭을 잘게 쪼개야
 * 계단이 화면에 들어온다. 그러면 장대봉을 세울 밑천이 없어 **꼬리만 무성한 차트**가 된다.
 * 봉을 굵게 해 한 화면에 아홉 개만 들이면 칸당 낙폭을 두 배로 줄 수 있다.
 */
const ZEN_PITCH = 12;

/**
 * 봉 한 벌. **원형 수열이라 마지막 봉 다음이 처음 봉이고**, 그래서 무한 스크롤이
 * 어디서 이어 붙어도 표가 안 난다.
 *
 * 시가와 종가를 따로 들고 있는 건 **갭을 그리기 위해서다** — 값 하나를 이웃과 나눠 쓰면
 * 봉과 봉 사이가 늘 붙어 있어, 값을 되돌릴 자리가 봉 몸통밖에 없다 (`zenChart` 참고).
 *
 * **한 칸씩 번갈아 오르내리게 두지 말 것.** 예전엔 방향을 못 박아 빨강·파랑이 골고루
 * 나오게 했는데, 그러면 톱니 무늬가 되어 **차트가 아니라 지그재그 무늬**로 보인다.
 * 지금은 방향이 한두 칸씩 이어지기도 하고(연속 양봉·음봉), 큰 봉 사이에 도지가 섞인다 —
 * 골고루 나오는 건 방향을 뒤집는 빈도가 맡고, 변주는 길이와 크기가 맡는다.
 */
interface ZenChart {
  /** 봉 i의 시가 */
  open: number[];
  /** 봉 i의 종가. 보통 다음 봉의 시가와 같지만, **갭이 나면 벌어진다** */
  close: number[];
  /** 봉 i가 꼬리 없이 꽉 찬 장대봉인가 */
  bare: boolean[];
}

function zenChart(seed: number, trend: -1 | 0 | 1, swing: number): ZenChart {
  const random = seededRandom(seed + 53);
  const open: number[] = [];
  const close: number[] = [];
  const bare: boolean[] = [];
  /** 추세선(요동 판은 화면 한가운데)에서 벗어난 칸수. **아래가 +다.** */
  let offset = 0;
  let dir = 1;
  let run = 0;
  /** 이번 무리가 추세 쪽으로 민 칸수 — 무리 끝에서 갭으로 되돌린다 */
  let pushed = 0;

  for (let i = 0; i < ZEN_CANDLES; i += 1) {
    open.push(offset);

    /** 이 봉이 값을 옮기는 칸수 (화면 기준, 아래가 +) */
    let move: number;
    /** 이 봉과 다음 봉 사이가 벌어지는 칸수 — 몸통으로 안 그려지는 몫이다 */
    let gap = 0;
    let solid: boolean;

    if (trend === 0) {
      /* 요동 판 — 방향이 한 칸에서 세 칸까지 이어지고, 민짜와 꼬리 봉이 번갈아 선다 */
      solid = (i % 2 === 0) !== (random() < 0.16);
      if (run <= 0) {
        run = 1 + Math.floor(random() * 3);
        dir = -dir;
      }
      run -= 1;
      move = dir * (solid ? 0.45 + random() * 0.5 : 0.03 + random() * 0.22) * swing;

      /* 화면 밖으로 나가려 하면 되돌린다 — 깎으면 그 봉만 납작해진다 */
      const limit = swing * 0.46;
      if (Math.abs(offset + move) > limit) move = -move;
      offset = Math.max(-limit, Math.min(limit, offset + move));
    } else {
      /*
       * 추세 판 — 세 칸이 한 무리다. **[장대봉 · 잔봉 · 마무리]**를 밀고, 무리 끝에서
       * 갭으로 제자리에 돌려놓는다.
       *
       * **되돌림을 봉이 떠안게 하지 않는다.** 밀어낸 만큼을 봉 하나로 되돌리면 그
       * 봉이 장대봉만큼 커지고, 하필 그게 추세와 반대색이라 화면에서 제일 눈에 띈다.
       * 값을 봉과 봉 **사이에서** 되돌리면(=갭) 반대색 봉을 안 쓰고도 제자리로 온다 —
       * 갭은 차트에서 흔한 그림이라 어색하지도 않다.
       *
       * 그래서 반대색은 **무리 걸러 한 번, 마무리 자리에서만** 나온다 (여섯 칸에 하나).
       */
      const step = i % 3;
      solid = step === 0;
      const counter = step === 2 && Math.floor(i / 3) % 2 === 1;

      /*
       * 추세 쪽으로 미는 칸수. **잔봉도 추세 쪽으로 민다** — 반대로 조금만 밀어도
       * 카메라가 따라온 만큼(`ZEN_DRIFT`)을 넘겨 색이 뒤집힌다.
       */
      const push = counter
        ? -(6 + random() * 4)
        : solid
          ? 15 + random() * 4
          : 1 + random() * 2.5;

      if (solid) pushed = 0;
      pushed += push;
      move = -trend * push;
      if (step === 2) gap = -trend * -pushed + (random() - 0.5) * 2;

      offset += move;
    }

    bare.push(solid);
    close.push(offset);
    offset += gap;
  }

  return { open, close, bare };
}

/**
 * 지금 몇 번째 봉까지 흘렀나. **일정한 속도로 흐른다.**
 *
 * 잠잠하다 훅 밀려가도록 속도를 흔들어봤는데, 밀려가는 구간이 눈으로 좇을 수 없을 만큼
 * 빨랐다 — 이 차트는 배경이라 시선을 뺏으면 안 되고, 무엇보다 **봉 자체가 이미 변주**라
 * 속도까지 출렁이면 둘이 겹쳐 그냥 어수선해진다. 변주는 봉 길이가 맡고 흐름은 일정하게 둔다.
 */
function zenScroll(time: number): number {
  return time / ZEN_CANDLE_MS;
}

/** 대본에서 지금 눈 상태를 찾는다 — 지나온 항목 중 마지막 것 */
function zenGazeAt(time: number): AntGaze {
  let state: AntGaze = "front";
  for (const [from, next] of ZEN_GAZE) {
    if (time < from) break;
    state = next;
  }
  return state;
}

/**
 * 추세 판에서 봉 한 칸이 밀려 내려가는(올라가는) 높이. **화면이 넓어진 만큼 눕혀야 한다** —
 * 한 화면에 열여섯 칸이 들어오므로 칸당 높이를 그대로 두면 계단이 화면 높이를 훌쩍 넘어,
 * 양 끝이 잘린 채 가운데 토막만 보인다.
 */
const ZEN_DRIFT = 2.5;

/**
 * 책상 무대 — 방 · 모니터 · 흐르는 봉. `trend`가 0이면 요동, -1이면 하강, +1이면 상승.
 *
 * **추세 판은 카메라가 최신 봉을 따라간다.** 봉이 한 칸 흐를 때 화면도 그만큼 위아래로
 * 밀려서, 끝없이 내려가는(올라가는) 계단이 된다 — 그래서 값이 화면 밖으로 달아나지도,
 * 어딘가에서 되돌아오지도 않는다. **한 칸마다 그림이 제자리로 돌아오므로 이음매가 없다**:
 * 추세를 좌표에 그냥 쌓았다면 한 바퀴 끝에서 차트가 통째로 튀었을 자리다.
 */
function drawDesk(p: Painter, frame: SceneFrame, trend: -1 | 0 | 1): void {
  const osc = oscillator(frame.time / ZEN_LOOP);

  /* 어두운 방 — 모니터가 유일한 광원이다 */
  p.vGradient(0, p.h, "#0d0f1a", "#20242e");

  /*
   * 모니터 불빛이 방으로 쏟아진 자리 — 숨쉬듯 밝기가 흔들린다. 빛깔은 장이 정한다
   * (수익=빨강·손실=파랑). **모니터 아래에 깐다**: 모니터가 위쪽을 통째로 덮으므로
   * 뒤에 두면 한 도트도 안 보인다.
   */
  const glow = trend > 0 ? "#e8a0a0" : trend < 0 ? "#8fb4e8" : "#9fc0e8";
  p.faded(0.11 + 0.03 * osc(2), () => p.disc(54, 62, 58, glow));

  /* 모니터 — 베젤 · 흰 화면 · 전원 불 */
  p.rect(ZEN_MON.x, ZEN_MON.y, ZEN_MON.w, ZEN_MON.h, "#2a2f38");
  p.rect(ZEN_MON.x + 1, ZEN_MON.y + 1, ZEN_MON.w - 2, 1, "#3a4250");
  const sx = ZEN_MON.x + 3;
  const sy = ZEN_MON.y + 3;
  const sw = ZEN_MON.w - 6;
  const sh = ZEN_MON.h - 6;
  p.rect(sx, sy, sw, sh, "#f4f6f9");
  p.dot(ZEN_MON.x + ZEN_MON.w - 5, ZEN_MON.y + ZEN_MON.h - 2, "#8fd8b0");

  /* 눈금줄 — 흰 바탕만 있으면 차트가 아니라 그냥 판때기다 */
  for (let line = 12; line < sh; line += 12) p.rect(sx, sy + line, sw, 1, "#e2e7ef");

  /*
   * 봉 — 오른쪽에서 왼쪽으로 하염없이 흐른다. 위치는 스크롤에서만 나오므로
   * 상태가 없고, 화면 밖으로 나가는 조각은 클리핑이 잘라낸다.
   */
  const chart = zenChart(frame.seed, trend, sh - 6);
  const scroll = zenScroll(frame.time);
  const slide = scroll - Math.floor(scroll);
  /*
   * 값 1을 몇 칸으로 그릴지. 요동 판은 화면을 꽉 채우고, 추세 판은 잘게 뽑은 걸음을
   * 이 눈금으로 되키운다 (위 `zenChart` 참고 — 몸통 높이는 걸음 × 눈금이다).
   */
  /*
   * 오른쪽 끝이 **지금 그려지는 중인 봉**이고 왼쪽으로 갈수록 지나간 봉이다.
   * `k`는 오른쪽에서 몇 번째냐이고, 봉은 `k`가 커질수록 카메라가 지나온 만큼 위(아래)에 선다.
   *
   * 제일 새 봉이 서는 높이는 **자랄 자리를 남겨 끝에서 띄운다** — 내려가는 판의 새 봉은
   * 화면 제일 아래라, 가장자리에 붙여두면 아래로 뻗는 몸통이 그대로 잘린다.
   */
  const baseY = trend === 0 ? sy + sh / 2 : trend < 0 ? sy + sh - 24 : sy + 24;
  const yOf = (k: number, offset: number) =>
    baseY + (trend === 0 ? 0 : trend * (k + slide) * ZEN_DRIFT) + offset;

  p.clipped(sx, sy, sw, sh, () => {
    for (let k = Math.ceil(sw / ZEN_PITCH) + 1; k >= 0; k -= 1) {
      const slot = Math.floor(scroll) - k;
      const idx = ((slot % ZEN_CANDLES) + ZEN_CANDLES) % ZEN_CANDLES;
      /* 종가는 **다음 봉이 설 자리**에서 잰다 — 그래야 봉들이 한 줄기로 이어진다 */
      const openY = yOf(k, chart.open[idx] as number);
      const closeY = yOf(k - 1, chart.close[idx] as number);
      const x = sx + sw - Math.round((k + slide) * ZEN_PITCH);

      /*
       * **맨 오른쪽 봉은 자라는 중이다.** 시가에서 종가 쪽으로 뻗어 나가고, 다 자라면
       * 그대로 왼쪽으로 밀려간다 — 양봉은 아래에서 위로, 음봉은 위에서 아래로 그려진다.
       * 다 그려진 봉이 통째로 밀려 들어오면 값이 정해져 있는 그림처럼 보인다.
       */
      const grow = k === 0 ? slide : 1;

      /* 화면에서 위로 갈수록 비싼 값이라, 종가가 더 위면 양봉이다 */
      const up = closeY < openY;

      /*
       * 꼬리 — **꽉 찬 봉에는 안 단다.** 모든 봉에 꼬리를 달았더니 차트가 잔가시밭이
       * 되어 몸통이 그 사이에 묻혔다. 민짜 장대봉이 사이사이 서야 꼬리 달린 봉도
       * 비로소 꼬리로 읽힌다. 어느 봉이 민짜인지는 길이를 정할 때 함께 정해진다.
       */
      const bare = chart.bare[idx] === true;
      const wickRandom = seededRandom(frame.seed + 67 + idx * 13);
      /*
       * **꼬리는 장대봉보다 길면 안 된다.** 길게 뽑았더니 몸통 두 칸짜리 봉이 꼬리로만
       * 스무 칸이 되어, 옆에 선 장대봉보다 키가 컸다 — 그러면 장대봉이 있어도 화면은
       * 꼬리밭으로 보인다. 요동 판은 몸통 자체가 커서 꼬리를 길게 둬도 안 묻힌다.
       */
      const long = trend === 0 ? 9 : 5;
      const tail = () =>
        (wickRandom() < 0.5 ? 3 + wickRandom() * long : 1 + wickRandom() * 2) * grow;
      const wickTop = bare ? 0 : tail();
      const wickBottom = bare ? 0 : tail();

      /* 민짜 봉은 몸통이 두툼해야 꽉 찬 것으로 읽힌다 — 얇으면 그냥 가로줄이다 */
      const full = Math.max(bare ? 6 : 2, Math.abs(closeY - openY));
      const height = Math.max(1, full * grow);
      /* 자라는 쪽은 시가에서 종가로 — 양봉은 위로 뻗고, 음봉은 아래로 내려간다 */
      const top = up ? openY - height : openY;
      const color = up ? "#ff5c5c" : "#5c9dff";

      p.rect(x + 4, top - wickTop, 1, height + wickTop + wickBottom, color);
      p.rect(x, top, 9, height, color);
      p.rect(x + 2, top + 1, 2, Math.max(1, height - 2), up ? "#ffb3b3" : "#a8ccff");
    }
  });
}

/** 얼굴을 앉힌다 — 숨은 아주 얕게 쉬고, 눈은 대본대로 껌뻑이고 흘긋대다 감는다. */
function drawDeskFace(p: Painter, frame: SceneFrame, mood: AntFaceMood): void {
  const breathe = flip2(frame.time, 1800) ? 0 : 1;
  p.sprite(
    antFaceCalmPixels(ZEN_STAGE, zenGazeAt(frame.time), mood),
    2,
    ZEN_FACE_TOP + breathe,
    2,
  );
}

const zen: MemeScene = {
  id: "zen",
  title: "무념무상",
  blurb: "차트가 요동쳐도 개미는 생각이 없다. 눈만 껌뻑.",
  loopMs: ZEN_LOOP,

  draw(p, frame) {
    drawDesk(p, frame, 0);
    drawDeskFace(p, frame, {});

    return speak("zen", frame, 54, 84, ZEN_LOOP);
  },
};

/* ── 10. 안 울어 — 하염없이 내려가는 차트, 고이기만 하는 눈물 ── */

const stoic: MemeScene = {
  id: "stoic",
  title: "안 울어",
  blurb: "차트는 계속 흘러내리고, 눈물은 고이기만 한다.",
  loopMs: ZEN_LOOP,

  draw(p, frame) {
    drawDesk(p, frame, -1);

    /*
     * 눈물은 **차오르기만 하고 안 흐른다.** 차오르는 데 시간이 걸려야 "참는 중"으로
     * 읽히는데, 그러면 한 바퀴 끝에서 그렁한 눈이 갑자기 마른 눈으로 튄다 —
     * 그래서 **눈을 감는 마지막 구간(5900ms~)에 맞춰 되돌린다.** 감은 눈에는 눈물
     * 도트가 없어 되돌아가는 게 안 보이고, 다음 바퀴는 마른 눈에서 다시 시작한다.
     */
    const welling = easeOut(clamp01((frame.time - 700) / 4600)) * 0.9;
    drawDeskFace(p, frame, { welling });

    return speak("stoic", frame, 54, 84, ZEN_LOOP);
  },
};

/* ── 11. 존버 중 — 올라가는 차트, 새어 나오는 웃음 ── */

const hodl: MemeScene = {
  id: "hodl",
  title: "존버 중",
  blurb: "차트가 올라간다. 입꼬리도 같이 올라간다.",
  loopMs: ZEN_LOOP,

  draw(p, frame) {
    drawDesk(p, frame, 1);
    /*
     * 미소와 홍조는 **한 바퀴 내내 그대로 둔다.** 차오르는 눈물과 달리 이건 눈꺼풀
     * 뒤로 숨길 수가 없어서(볼은 눈을 감아도 보인다), 시간을 따라 짙어지게 하면
     * 루프 이음매에서 볼빛이 툭 꺼진다.
     */
    drawDeskFace(p, frame, { smile: true, blush: true });

    return speak("hodl", frame, 54, 84, ZEN_LOOP);
  },
};


/* ════════════════════════════════════════════════════
   9. 빈 지갑 — 있었는데요, 없었습니다
   ════════════════════════════════════════════════════ */

/** 한 바퀴에 "닫았다 폈다"를 두 번. 같은 농담을 두 번 보여줘야 리듬이 생긴다. */
const WALLET_LOOP = 9600;
const WALLET_CYCLE = WALLET_LOOP / 2;
/**
 * **개미를 한 배로 줄였다.** 두 배로 그리면 얼굴이 화면을 다 먹어, 몸을 틀어 지갑을
 * 들어올릴 자리가 안 나온다. 도트 크기도 무대(10px)와 같아져 지갑과 한 해상도가 된다.
 */
const WALLET_SCALE = 1;
/** 몸을 왼쪽으로 튼 자세라 얼굴도 왼쪽에 앉는다 (사진처럼 지갑은 오른쪽 위로) */
const WALLET_LEFT = 8;
const WALLET_TOP = 34;
const WALLET_STAGE = 20;
/**
 * 얼굴 맵에서 **머리까지만** 쓴다. 몸까지 그리면 얼굴이 화면을 다 먹어 지갑이 턱 밑에
 * 눌린다 — 이 판의 주인공은 지갑이라, 아래를 비워주고 어깨는 무대가 따로 그린다.
 */
const WALLET_HEAD_ROWS = 64;
/** 지갑이 놓이는 자리 (가슴 앞) */
const PURSE_X = 74;
const PURSE_Y = 112;

const wallet: MemeScene = {
  id: "wallet",
  title: "빈 지갑",
  blurb: "지갑을 펴는 순간. 있었는데요, 없었습니다.",
  loopMs: WALLET_LOOP,

  draw(p, frame) {
    const phase = (frame.time % WALLET_CYCLE) / WALLET_CYCLE;
    const cycle = Math.floor(frame.time / WALLET_CYCLE);

    /*
     * **밝은 배경.** 이 판만 스튜디오 사진처럼 환하다 — 나머지 여섯 판이 전부 밤이라,
     * 밝기만으로도 다른 농담이라는 게 먼저 읽힌다.
     */
    p.vGradient(0, p.h, "#efe9dd", "#cfc6b6");

    /*
     * 지갑이 벌어지는 정도. 앞뒤로 잠깐씩만 움직이고 대부분은 닫혔거나 펴져 있다 —
     * 말풍선 둘이 각각 머무를 시간이 있어야 "있었는데 / 없었습니다"가 성립한다.
     * 한 바퀴 끝에서 다시 닫히므로 이음매가 안 보인다.
     */
    const open =
      phase < 0.42
        ? 0
        : phase < 0.5
          ? easeInOut((phase - 0.42) / 0.08)
          : phase < 0.92
            ? 1
            : 1 - easeInOut((phase - 0.92) / 0.08);

    /*
     * 몸통 — **왼쪽으로 튼 자세**다. 얼굴 아래 그대로 두면 정면으로 선 개미가 되고,
     * 그러면 지갑을 두 손으로 들어올릴 자리가 안 생긴다. 어깨를 왼쪽으로 밀고 오른쪽
     * 어깨를 앞으로 내밀어, 그쪽 팔이 지갑을 받치게 한다.
     */
    const tone = antFacePalette(WALLET_STAGE);
    /*
     * 턱 바로 아래에서 시작해야 머리가 몸에 붙는다 — 띄우면 얼굴만 공중에 뜬다.
     * **윤곽을 먼저 깔고 몸을 그 위에 얹는다.** 반대로 하면 윤곽 원이 몸을 통째로
     * 덮어 검은 덩어리가 된다 (한 번 그렇게 나왔다).
     */
    const torso = (cx: number, cy: number, rx: number, ry: number, color: string) => {
      for (let dy = -ry; dy <= ry; dy += 1) {
        const halfWidth = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
        p.rect(cx - halfWidth, cy + dy, halfWidth * 2, 1, color);
      }
    };

    /* 원으로 그리면 턱까지 닿게 하려다 몸이 화면을 다 먹는다 — 타원이라야 어깨 폭이 산다 */
    torso(32, 182, 42, 88, tone.outline);
    torso(32, 180, 42, 88, tone.body);
    p.faded(0.4, () => p.disc(14, 168, 26, tone.bodyGloss));

    /* 눈은 2.4초마다 한 번 깜빡인다 — 놀란 채로 굳어 있으면 인형처럼 보인다 */
    const blink = (frame.time + 700) % 2400 > 2130;

    p.sprite(
      antShockFacePixels(WALLET_STAGE, blink).filter((pixel) => pixel.y <= WALLET_HEAD_ROWS),
      WALLET_LEFT,
      WALLET_TOP,
      WALLET_SCALE,
    );

    drawPurse(p, PURSE_X, PURSE_Y, open, frame.time, tone);

    /*
     * "있었는데요 없었습니다" — **말풍선이 지갑의 상태를 따른다.** 닫혀 있을 때와 펴진
     * 뒤에 서로 다른 풀에서 뽑고, 벌어지는 동안에는 둘 다 비운다 (그 사이가 뜸이다).
     */
    const said = open < 0.5;
    const settle = said ? clamp01((0.42 - phase) / 0.08) : clamp01((phase - 0.5) / 0.08);
    const leaving = said ? 1 : clamp01((0.92 - phase) / 0.06);

    return {
      text: pickMemeLine(said ? "wallet" : "walletEmpty", frame.seed, cycle, WALLET_LOOP / WALLET_CYCLE),
      x: 32,
      y: WALLET_TOP - 2,
      alpha: clamp01(Math.min(settle, leaving)),
    };
  },
};

/**
 * 지갑과 그걸 쥔 두 손. `open`이 0이면 반으로 접힌 채고, 1이면 활짝 펴져 속이 보인다.
 *
 * **펴질수록 손이 벌어진다** — 지갑만 넓어지고 손이 제자리면 지갑이 늘어난 것처럼 보인다.
 */
function drawPurse(
  p: Painter,
  cx: number,
  cy: number,
  open: number,
  time: number,
  tone: { body: string; outline: string; bodyGloss: string },
) {
  /*
   * **위아래로 펼친다.** 좌우로 펼치면 지갑이 화면을 가로지르는 띠가 되고, 무엇보다
   * 개미가 정면으로 서서 두 손을 벌린 자세가 된다 — 사진처럼 몸을 틀어 한 손은 위,
   * 한 손은 아래를 잡는 자세라야 "펼쳐 보이는" 그림이 나온다.
   */
  const width = 34;
  const half = Math.round(lerp(9, 24, open));
  const left = cx - width / 2;

  /*
   * 팔 — 지갑보다 먼저 그린다. **굵고 짧게**: 가늘고 길게 그으면 팔이 아니라 막대기로
   * 보인다. 위쪽 팔은 어깨에서 올라와 지갑 윗단을, 아래쪽 팔은 몸통 앞에서 아랫단을 잡는다.
   */
  for (const [handY, fromX, fromY] of [
    [cy - half + 3, 44, 118],
    [cy + half - 3, 50, 150],
  ] as const) {
    /* 몸통과 같은 색이면 팔이 통째로 묻힌다 — 밝게 칠하고 아래위로 선을 둘러 떼어낸다 */
    p.line(left + 4, handY - 4, fromX, fromY - 4, tone.outline);
    for (let thickness = 0; thickness < 6; thickness += 1) {
      p.line(left + 4, handY + thickness - 3, fromX, fromY + thickness - 3, tone.bodyGloss);
    }
    p.line(left + 4, handY + 3, fromX, fromY + 3, tone.outline);
  }

  /* 가죽 — 펴지면 위아래로 길어지는 한 장 */
  p.rect(left, cy - half, width, half * 2, "#6b4a2e");
  p.rect(left, cy - half, width, 2, "#8a6238");
  p.rect(left, cy + half - 2, width, 2, "#4a3018");
  p.rect(left, cy - half, 2, half * 2, "#8a6238");
  p.rect(left + width - 2, cy - half, 2, half * 2, "#4a3018");
  for (let y = cy - half + 3; y < cy + half - 2; y += 4) p.dot(left + 3, y, "#a8814e");

  /*
   * 속 — **펴지면 이쪽이 주인공이다.** 가죽을 안쪽까지 덮어 그렸더니 활짝 편 지갑인데도
   * 갈색 판때기로 보여서 "비었다"가 안 읽혔다.
   */
  const inner = Math.round((half - 5) * open);
  if (inner > 1) {
    p.rect(left + 4, cy - inner, width - 8, inner * 2, "#241708");
    /* 카드 자리 — 칸은 있는데 아무것도 안 꽂혀 있다 */
    for (const side of [-1, 1] as const) {
      const slot = cy + side * Math.round(inner * 0.5);
      p.rect(left + 8, slot - 1, width - 16, 2, "#3d2a14");
    }
  }
  /* 접힌 자국은 가로로 지난다 (위아래로 펴지므로) */
  p.rect(left, cy - 1, width, 2, "#3c2612");

  /* 쥔 손 — 위아래 끝을 잡고 벌어진 만큼 따라 벌어진다 */
  for (const side of [-1, 1] as const) {
    const hy = cy + side * (half - 2);
    p.rect(left - 2, hy - 5, 14, 10, tone.body);
    p.rect(left - 2, hy - 5, 14, 2, "#a8814e");
    p.rect(left - 2, hy + 4, 14, 1, tone.outline);
    /* 엄지 — 지갑 앞면을 짚는다 */
    p.rect(left + 6, hy - 2, 5, 4, tone.body);
  }

  /* 펴진 뒤엔 먼지만 날린다 */
  if (open > 0.7) {
    for (let i = 0; i < 4; i += 1) {
      const age = (time + i * 600) % 2400;
      p.faded(clamp01(1 - age / 2400) * 0.85, () =>
        p.dot(left + 8 + i * 6, cy - 6 - age * 0.014, "#8a7a62"),
      );
    }
  }
}

export const MEME_SCENES: readonly MemeScene[] = [
  dig,
  ride,
  flood,
  face,
  cushion,
  coaster,
  train,
  rocket,
  zen,
  stoic,
  hodl,
  wallet,
];

export function findScene(id: MemeSceneId): MemeScene {
  return MEME_SCENES.find((scene) => scene.id === id) ?? dig;
}
