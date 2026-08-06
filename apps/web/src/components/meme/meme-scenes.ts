import {
  type Painter,
  clamp01,
  easeInOut,
  easeOut,
  gradientAt,
  lerp,
  seededRandom,
} from "@/lib/pixel-canvas";

import { ANT_EYE, type AntPose, antPixels } from "../ant-sprite";
import { type MemeSceneId, pickMemeLine } from "./meme-lines";

/**
 * 짤 세 판. 전부 **한 격자(108×192, 9:16)** 위에 절차적으로 그려지고,
 * 시간만 넣으면 같은 그림이 나온다 (`draw(p, { time, seed })`).
 *
 * 시간을 인자로 받는 게 규칙이다 — 내부에 타이머나 상태를 두면 미리보기에서 본 화면과
 * 녹화된 영상이 어긋난다. 무작위가 필요한 곳(별자리·흙 얼룩·땀방울)은 `seededRandom`을
 * 쓰고, 씨앗은 "한 번의 촬영"을 뜻하는 `seed` 하나에서 갈라 쓴다.
 *
 * 세 판이 공유하는 것: 개미 몸(`ant-sprite`의 문자맵), 색 규칙(수익=빨강·손실=파랑),
 * 말풍선 박자(`BEAT_MS`). 나머지는 판마다 다르다 — 배경도 카메라도 물리도.
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

/** 두 프레임을 초당 몇 번 갈아끼울지 */
function flip2(time: number, ms: number): boolean {
  return Math.floor(time / ms) % 2 === 0;
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
  title: "땅 파는 개미",
  blurb: "해는 쨍쨍, 땀은 뻘뻘. 그런데 왜 파고 있냐면..",
  loopMs: DIG_LOOP,

  draw(p, frame) {
    const t = frame.time / 1000;
    const strike = (frame.time % STRIKE_MS) / STRIKE_MS;
    const random = seededRandom(frame.seed + 11);

    /* 하늘 — 위는 파랗고 지평선은 더위로 누렇다 */
    p.vGradient(0, DIG_GROUND, "#4aa8ea", "#ffdfae");
    drawSun(p, 22, 22, t);

    /* 지평선 위로 아지랑이. 두 줄이 서로 어긋나게 흔들린다. */
    for (let i = 0; i < 5; i += 1) {
      const y = DIG_GROUND - 14 + (i % 2) * 5;
      const x = 6 + i * 20 + Math.round(Math.sin(t * 2.4 + i) * 2);
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
      const age = (frame.time + i * 380) % 1140;
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
function drawSun(p: Painter, cx: number, cy: number, t: number) {
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + t * 0.25;
    const inner = 11;
    const outer = inner + 3 + Math.sin(t * 3 + i * 1.7) * 2;
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
  title: "탑승한 개미",
  blurb: "차트에 올라탔다. 산과 구름을 지나 우주까지.",
  loopMs: RIDE_LOOP,

  draw(p, frame) {
    const t = frame.time / 1000;
    const a = frame.time / RIDE_LOOP;
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
      const twinkle = 0.45 + 0.55 * Math.sin(t * 2.6 + i);
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
      const x = 6 + cloudRandom() * 92 + Math.sin(t * 0.4 + i) * 3;
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
      const speed = 90 + streakRandom() * 130 + a * 180;
      const y = ((streakRandom() * p.h + t * speed) % (p.h + length)) - length;
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
  title: "눈물바다 개미",
  blurb: "울다 보니 바다가 됐다. 다 잃은 개미의 밤.",
  loopMs: FLOOD_LOOP,

  draw(p, frame) {
    const t = frame.time / 1000;
    const a = frame.time / FLOOD_LOOP;

    /*
     * 밤하늘 — 대시보드 무대와 같은 톤에서 시작하되 **지평선 쪽을 밝힌다.**
     * 탈진한 개미는 색이 빠져 어두운데, 뒤까지 어두우면 몸이 밤에 묻혀 우는 게 안 보인다.
     */
    p.vGradient(0, FLOOD_GROUND, "#0d1626", "#1e2b45");

    const starRandom = seededRandom(frame.seed + 17);
    for (let i = 0; i < 26; i += 1) {
      const x = Math.floor(starRandom() * p.w);
      const y = Math.floor(starRandom() * 90);
      p.faded(0.3 + 0.3 * Math.sin(t * 1.7 + i), () => p.dot(x, y, "#cfd8e8"));
    }

    /* 달은 오른쪽 위에 홀로 둔다 — 구름은 왼쪽에만 흘려 가리지 않게 한다 */
    p.disc(88, 24, 8, "#cfd8e8");
    p.disc(85, 21, 2, "#a8b4c8");
    p.disc(91, 27, 3, "#a8b4c8");

    const cloudRandom = seededRandom(frame.seed + 5);
    for (let i = 0; i < 3; i += 1) {
      const x = 8 + cloudRandom() * 52 + Math.sin(t * 0.25 + i * 2) * 4;
      p.faded(0.9, () => drawFlatCloud(p, x, 20 + i * 18, 9 + i * 3));
    }

    /* 땅 */
    p.rect(0, FLOOD_GROUND, p.w, 3, "#241a12");
    p.rect(0, FLOOD_GROUND + 3, p.w, p.h - FLOOD_GROUND - 3, "#150f0a");

    /* 물이 차오르는 높이 — 발목에서 가슴께까지 */
    const waterY = lerp(p.h - 1, 126, easeOut(clamp01((a - 0.05) / 0.8)));
    const surfaceAt = (x: number) =>
      waterY + Math.round(Math.sin(x * 0.22 + t * 2.2) * 1.6 + Math.sin(x * 0.11 - t * 1.4) * 0.8);

    /* 개미 — 흐느끼느라 어깨가 들썩이고 몸이 좌우로 떨린다 */
    const sob = flip2(frame.time, 260);
    const shake = flip2(frame.time, 130) ? 0 : 1;
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
      const x = (base + t * (4 + glintRandom() * 6)) % p.w;
      const y = surfaceAt(x) + 3 + Math.floor(glintRandom() * 8);
      if (y > p.h) continue;
      p.faded(0.5, () => p.rect(x, y, 3, 1, "#7fb6e8"));
    }

    /* 떠내려가는 파란 봉 — 잃은 것들이 물 위를 지난다. 심지를 남겨야 봉으로 읽힌다. */
    for (let i = 0; i < 2; i += 1) {
      const x = i === 0 ? 10 : 98;
      const top = surfaceAt(x) - 7 + (flip2(frame.time + i * 400, 420) ? 0 : 1);
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

export const MEME_SCENES: readonly MemeScene[] = [dig, ride, flood];

export function findScene(id: MemeSceneId): MemeScene {
  return MEME_SCENES.find((scene) => scene.id === id) ?? dig;
}
