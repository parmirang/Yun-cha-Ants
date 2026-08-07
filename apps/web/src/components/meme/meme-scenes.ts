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
  type AntPose,
  antFacePalette,
  antFacePixels,
  antPixels,
} from "../ant-sprite";
import { type MemeSceneId, pickMemeLine } from "./meme-lines";

/**
 * 짤 여섯 판. 전부 **한 격자(108×192, 9:16)** 위에 절차적으로 그려지고,
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

function speak(scene: MemeSceneId, frame: SceneFrame, x: number, y: number): SceneBubble {
  const beat = Math.floor(frame.time / BEAT_MS);
  const inBeat = frame.time - beat * BEAT_MS;
  const alpha =
    inBeat < FADE_MS
      ? inBeat / FADE_MS
      : inBeat > BEAT_MS - FADE_MS
        ? (BEAT_MS - inBeat) / FADE_MS
        : 1;

  return { text: pickMemeLine(scene, frame.seed, beat), x, y, alpha: clamp01(alpha) };
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

    return speak("dig", frame, DIG_LEFT + 8 * DIG_SCALE, DIG_TOP + 2 * DIG_SCALE - 2);
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

    return speak("ride", frame, RIDE_CENTER, antTop + 2 * scale - 2);
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

    return speak("flood", frame, FLOOD_LEFT + 8 * FLOOD_SCALE, FLOOD_TOP + 2 * FLOOD_SCALE - 2);
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
/** 48칸 얼굴을 2배로 — 96칸이라 화면 폭(108)을 거의 채운다 */
const FACE_SCALE = 2;
const FACE_LEFT = Math.round((108 - 48 * FACE_SCALE) / 2);
const FACE_TOP = 46;
/** 탈진한 창백한 단계. 얼굴이 화면을 채우니 대비는 눈과 윤곽선이 맡는다. */
const FACE_STAGE = 8;
/** 눈 아래에서 쏟아지는 줄기의 좌우 벌어짐 (얼굴 격자 기준) */
const TEAR_LANES = [-5, -1, 3] as const;

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

    /* 어깨 — 턱 아래를 받쳐준다. 없으면 머리가 허공에 떠 있다. */
    p.disc(54, 206, 56, antFacePalette(FACE_STAGE).shade);
    p.disc(54, 208, 56, antFacePalette(FACE_STAGE).outline);

    p.sprite(antFacePixels(FACE_STAGE, blink), FACE_LEFT, top, FACE_SCALE);

    /*
     * 눈물은 **줄기로 흐른다.** 방울만 뚝뚝 떨어뜨리면 비 오는 그림이 되고, 우는 얼굴
     * 밈의 그 표정은 두 눈에서 턱 아래까지 물이 이어져 있어야 나온다. 줄기 안에서 밝은
     * 마디가 내려가며 흐르는 티를 낸다. **줄기는 얇게 둔다** — 굵으면 표정이 물에 덮인다.
     */
    for (const eye of ANT_FACE_EYES) {
      for (const lane of TEAR_LANES) {
        const x = FACE_LEFT + (eye.x + lane) * FACE_SCALE;
        const from = top + eye.y * FACE_SCALE;
        const wobble = Math.round(osc(2, (eye.x + lane) * 0.07));

        p.rect(x, from, 2, p.h - from, "#4a8fd8");
        p.rect(x, from, 1, p.h - from, "#8fc4f0");

        /* 흐르는 마디 — 줄기마다 시작 위치를 어긋나게 둔다 */
        const flow = ((frame.time / 1200 + (eye.x + lane) * 0.13) % 1) * (p.h - from);
        p.rect(x, from + flow + wobble, 2, 5, "#cfe9ff");
      }
    }

    return speak("face", frame, 54, top - 2);
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
) {
  const shadow = pixels.map((pixel) => ({ ...pixel, fill: color }));

  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    p.sprite(shadow, left + dx * scale, top + dy * scale, scale);
  }

  p.sprite(pixels, left, top, scale);
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

    return speak("coaster", frame, CAR_X, carY - 34);
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

export const MEME_SCENES: readonly MemeScene[] = [dig, ride, flood, face, cushion, coaster];

export function findScene(id: MemeSceneId): MemeScene {
  return MEME_SCENES.find((scene) => scene.id === id) ?? dig;
}
