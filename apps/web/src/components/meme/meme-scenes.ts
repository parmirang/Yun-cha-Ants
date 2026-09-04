import {
  type Painter,
  clamp01,
  easeInOut,
  easeOut,
  gradientAt,
  lerp,
  mixColor,
  seededRandom,
} from "@/lib/pixel-canvas";

import {
  ANT_EYE,
  ANT_FACE_EYES,
  antBigKey,
  antBigPoseRows,
  antPalette,
  ANT_FACE_H,
  ANT_FACE_W,
  type AntFaceMood,
  type AntGaze,
  type AntPixel,
  type AntPose,
  antFaceCalmPixels,
  antFacePalette,
  antFacePixels,
  antPixels,
  antShockFacePixels,
} from "../ant-sprite";
import {
  APE_CHEER,
  BLOCK_ENEMY_FLAG,
  BLOCK_STOMP_TAUNTS,
  BLOCK_TRIPLE_SCRIPT,
  BOARD_CLOCK,
  BOARD_CUE_SCRIPT,
  BOARD_MOTTO,
  BOARD_OPEN_SCRIPT,
  WORLD_COUNTRIES,
  WORLD_NAMES,
  WORLD_SCRIPT,
  PILLAR_SCRIPT,
  POLAR_SCRIPT,
  STAIR_SCRIPT,
  STOIC_SCRIPT,
  STORM_SCRIPT,
  WATER_SCRIPT,
  type MemeLinePool,
  type MemeSceneId,
  pickMemeLine,
} from "./meme-lines";
import {
  FLAG_W,
  WHALE_EYE,
  type FlagId,
  chiveCutY,
  drawApe,
  drawChive,
  drawFlag,
  drawHamster,
  drawLocust,
  drawRows,
  drawSardine,
  drawWhale,
} from "./world-cast";

/**
 * 짤 판들(`MEME_SCENES`). 전부 **한 격자(108×192, 9:16)** 위에 절차적으로 그려지고,
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
  /**
   * 동시에 뜨는 나머지 말풍선 — **여럿이 한꺼번에 떠드는 판만 쓴다**(일개미 행진).
   * 대부분의 판은 개미가 하나라 이 자리를 안 채운다.
   */
  extra?: readonly { text: string; x: number; y: number; alpha: number }[];
}

export interface SceneLabel {
  text: string;
  /** 글자 상자의 가운데 위 좌표, 격자 칸 단위 */
  x: number;
  y: number;
  alpha: number;
  /** 글자 크기 (11px 격자의 배수) */
  unit: number;
  /** 굵게. 도트 하나만큼 옆으로 겹쳐 찍는다 (아래 `drawLabels` 참고) */
  bold?: boolean;
  /** 글자색. 없으면 먹색이다 — 밝은 판때기 위에 얹는 게 기본이라서. */
  color?: string;
  /** 외곽선색. 배경색을 못 고르는 자리(하늘·물 위)에 글자를 띄울 때만 쓴다. */
  outline?: string;
}

export interface MemeScene {
  id: MemeSceneId;
  /** 탭에 적히는 이름 */
  title: string;
  /** 탭 아래 한 줄 설명 */
  blurb: string;
  /** 한 바퀴 (ms). 영상은 딱 한 바퀴를 굽는다 — 이음매가 안 보이려면 시작과 끝이 같아야 한다. */
  loopMs: number;
  /**
   * 한 컷으로 뽑을 때 멈춰 세우는 순간 (ms).
   *
   * **판마다 "제일 그 판다운 순간"이 다르다** — 곡괭이가 흙을 튀기는 찰나, 눈물이 다
   * 차오른 뒤, 봉이 천장을 뚫은 자리. 0으로 두면 대개 아무 일도 안 일어난 첫 프레임이라,
   * 이미지 탭을 연 사람이 제일 먼저 보는 그림이 빈 무대가 된다.
   *
   * 화면에서 순간을 옮길 수는 있지만(슬라이더) 그건 고르는 사람 몫이고, 여기 값은
   * **아무것도 안 만졌을 때 나오는 한 컷**이다.
   */
  stillMs: number;
  draw(p: Painter, frame: SceneFrame): SceneBubble;
}

/** 말풍선 한 마디가 떠 있는 시간. 루프 길이는 이 값의 배수여야 한다. */
const BEAT_MS = 2400;
/** 떴다 사라지는 데 걸리는 시간 — 루프 끝에서 0이라 이음매에서 말풍선이 튀지 않는다. */
const FADE_MS = 280;

function speak(scene: MemeLinePool, frame: SceneFrame, x: number, y: number): SceneBubble {
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
 * `speak`과 박자는 같지만 **개미마다 다른 줄을 뽑는다** — `voice`(개미 번호)로 seed를
 * 갈라써서, 같은 순간에도 옆 개미와 같은 말을 안 한다(가끔 겹쳐도 그건 그것대로
 * 채팅창답다). 여럿이 동시에 떠드는 "일개미 행진"만 쓴다.
 */
function speakVoice(scene: MemeLinePool, frame: SceneFrame, voice: number, x: number, y: number): SceneBubble {
  const beat = Math.floor(frame.time / BEAT_MS);
  const inBeat = frame.time - beat * BEAT_MS;
  const alpha =
    inBeat < FADE_MS
      ? inBeat / FADE_MS
      : inBeat > BEAT_MS - FADE_MS
        ? (BEAT_MS - inBeat) / FADE_MS
        : 1;

  return { text: pickMemeLine(scene, frame.seed + voice * 97, beat), x, y, alpha: clamp01(alpha) };
}

/**
 * 정해진 대본을 **순서대로** 띄운다 — 한 바퀴를 줄 수만큼 나눠 한 칸에 한 줄씩.
 *
 * `speak`와 달리 seed를 안 본다. 앞뒤가 이어지는 말("뭔가 잘못됐어" → "단단히")은
 * 순서가 곧 농담이라 뽑기에 맡길 수 없다 — 다시 뽑아도 같은 대본이 나온다.
 *
 * 칸 길이는 `BEAT_MS`가 아니라 **루프 ÷ 줄 수**다. 박자를 못박으면 줄이 하나 늘 때마다
 * 루프 길이를 같이 고쳐야 하고, 안 고치면 마지막 줄이 이음매에서 잘린다.
 */
function speakScript(
  script: readonly string[],
  frame: SceneFrame,
  loopMs: number,
  x: number,
  y: number,
): SceneBubble {
  const span = loopMs / script.length;
  const index = Math.min(script.length - 1, Math.floor(frame.time / span));
  const inSlot = frame.time - index * span;

  return {
    text: script[index] ?? "",
    x,
    y,
    alpha: clamp01(Math.min(inSlot, span - inSlot) / FADE_MS),
  };
}

/**
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

  return { text: pickMemeLine(pool, frame.seed, index), x, y, alpha };
}

/**
 * 경계가 못 박힌 대본을 순서대로 띄운다. `speakScript`가 한 바퀴를 **똑같이** 나누는 것과
 * 달리, 컷마다 길이가 다른 판이 쓴다 — 물타기처럼 컷이 물주기 박자에 얹혀 있으면
 * 균등하게 나눌 수가 없다. 경계는 컷 수보다 하나 많다(시작·끝).
 */
function speakCuts(
  script: readonly string[],
  frame: SceneFrame,
  bounds: readonly number[],
  x: number,
  y: number,
): SceneBubble {
  const time = frame.time;

  for (let i = 0; i < script.length; i += 1) {
    const from = bounds[i] as number;
    const to = bounds[i + 1] as number;
    if (time < from || time >= to) continue;

    return {
      text: script[i] ?? "",
      x,
      y,
      alpha: clamp01(Math.min(time - from, to - time) / FADE_MS),
    };
  }

  return { text: "", x, y, alpha: 0 };
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
  stillMs: 2000,

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
  stillMs: 5100,

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
  stillMs: 3200,

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
  stillMs: 4200,

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
  stillMs: 3200,

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
  stillMs: 3600,

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
  stillMs: 3000,

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
      text: pickMemeLine(to.y > from.y ? "trainUp" : "trainDown", frame.seed, segment),
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
  stillMs: 3050,

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
  stillMs: 3600,

  draw(p, frame) {
    drawDesk(p, frame, 0);
    drawDeskFace(p, frame, {});

    return speak("zen", frame, 54, 84);
  },
};

/* ── 10. 안 울어 — 하염없이 내려가는 차트, 고이기만 하는 눈물 ── */

const stoic: MemeScene = {
  id: "stoic",
  title: "안 울어",
  blurb: "차트는 계속 흘러내리고, 눈물은 고이기만 한다.",
  loopMs: ZEN_LOOP,
  stillMs: 5000,

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

    return speakScript(STOIC_SCRIPT, frame, ZEN_LOOP, 54, 84);
  },
};

/* ── 11. 존버 중 — 올라가는 차트, 새어 나오는 웃음 ── */

const hodl: MemeScene = {
  id: "hodl",
  title: "존버 중",
  blurb: "차트가 올라간다. 입꼬리도 같이 올라간다.",
  loopMs: ZEN_LOOP,
  stillMs: 5100,

  draw(p, frame) {
    drawDesk(p, frame, 1);
    /*
     * 미소와 홍조는 **한 바퀴 내내 그대로 둔다.** 차오르는 눈물과 달리 이건 눈꺼풀
     * 뒤로 숨길 수가 없어서(볼은 눈을 감아도 보인다), 시간을 따라 짙어지게 하면
     * 루프 이음매에서 볼빛이 툭 꺼진다.
     */
    drawDeskFace(p, frame, { smile: true, blush: true });

    return speak("hodl", frame, 54, 84);
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
  stillMs: 3200,

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
      text: pickMemeLine(said ? "wallet" : "walletEmpty", frame.seed, cycle),
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

/* ════════════════════════════════════════════════════
   12. 불기둥 — 9시엔 전고점, 종가엔 무슨 일
   ════════════════════════════════════════════════════ */

/**
 * 봉 하나짜리 판. 이야기는 봉이 혼자 다 하고 **개미는 보기만 한다** — 올려다보고, 뛰고,
 * 엎드려 내려다보는 게 개미가 하는 일의 전부다.
 *
 * **무대가 흰 차트 창이다.** 다른 판들이 무대(흙·물·하늘)를 그리는 것과 달리 여기는
 * 화면 자체가 시세 창이라, 창 테두리 안쪽에서만 모든 일이 일어난다 — 폭죽도 비도
 * 창 안에서 친다 (`p.clipped`). 창을 화면 가장자리에서 떼어 앉히는 것도 규칙이다:
 * **여백이 곧 "이건 차트 창이다"라는 표시**고, 그만큼 봉과 개미가 작아져 한 화면에
 * 이야기가 다 들어온다.
 *
 * **기준선이 곧 시가(始價)다.** 봉은 늘 이 선에서 시작해 위(양봉)나 아래(음봉)로 뻗으므로
 * 기둥이 창을 오르내리는 게 아니라 **한 자리에서 뒤집힌다** — 차트에서 실제로 일어나는
 * 일이 그렇고, 개미가 같은 자리를 올려봤다 내려보는 그림도 여기서 나온다.
 *
 * 하루가 흐르는 판이라 막이 넷이다. 아침에 솟고(불기둥+폭죽) · 전고점에서 이글거리고 ·
 * 뒤집혀 내려가고(음봉+비) · 창 밖으로 미끄러져 나간다. **되돌아오지 않는 움직임이라
 * 한 바퀴 끝은 컷이다** — 대신 마지막 막에서 봉을 창 밖까지 내려보내, 이음매에서는
 * 빈 차트와 서 있는 개미만 남게 해뒀다.
 */
const PILLAR_LOOP = 9600;
/** 흰 창 — 화면 가장자리에서 떼어 앉힌다 (여백이 곧 창이라는 표시다) */
const PLR_PANEL = { x: 8, y: 28, w: 92, h: 136 } as const;
/** 기준선 = 시가. 개미가 서는 선이자 봉이 뒤집히는 선이다. */
const PLR_BASE = 126;
/** 고가 — 창 위쪽에 한 뼘 남겨 천장에 안 붙인다 */
const PLR_HIGH = 42;
/** 창 아래 밖. 종가가 여기까지 내려가면 음봉이 창을 세로로 다 채운다. */
const PLR_DEEP = PLR_PANEL.y + PLR_PANEL.h + 4;
const PLR_X = 58;
const PLR_W = 30;
/** 봉 가운데 — 꼬리·불꽃이 이 선을 기준으로 선다 */
const PLR_MID = PLR_X + PLR_W / 2;
/** 막 경계 (ms). 대본 여섯 컷(1.6초씩)과 맞물려 있으니 함께 옮길 것. */
const PLR_RISE = 2600;
const PLR_APEX = 3400;
/** 창 아래에 닿는 시점. 여기서부터는 봉이 통째로 창 밖으로 미끄러진다. */
const PLR_DIVE = 5600;
const PLR_GONE = 8600;
/** 천장을 뚫는 즈음 — 개미가 여기서 뛴다 */
const PLR_BREAK = 2200;
/** 한 번 뛰었다 내려오는 데 걸리는 시간 */
const PLR_HOP_MS = 560;
const PLR_SCALE = 2;
const PLR_ANT_LEFT = 20;
const PLR_ANT_TOP = PLR_BASE - 16 * PLR_SCALE;
/** 흰 창 앞에 서므로 붉은 단계로 둔다 — 창백한 쪽은 흰 바탕에 묻힌다 */
const PLR_STAGE = 44;

/**
 * 종가의 화면 높이. **기준선보다 위면 양봉, 아래면 음봉이다** — 색이 뒤집히는 자리를
 * 따로 정하지 않고 이 한 값이 정하게 둔다.
 */
function pillarPrice(time: number): number {
  if (time < PLR_RISE) return lerp(PLR_BASE, PLR_HIGH, easeOut(time / PLR_RISE));
  if (time < PLR_APEX) return PLR_HIGH;

  /* 떨어지는 건 가속한다 — 오를 때(easeOut)와 대칭이라 "붙잡을 새도 없이"가 된다 */
  const dive = clamp01((time - PLR_APEX) / (PLR_DIVE - PLR_APEX));
  return lerp(PLR_HIGH, PLR_DEEP, dive * dive);
}

/**
 * 마지막 막에서 **몸통만** 창 밖으로 미끄러진 거리.
 *
 * 시가에 붙어 있는 한 몸통 위쪽은 기준선에 못 박혀 있어서, 아무리 내려가도 화면에서는
 * 파란 판때기 하나가 그대로 서 있는 그림이 된다. 그래서 마지막엔 몸통을 시가에서 떼어
 * 내려보낸다 — 사라지는 게 보여야 "야 너 어디가"가 성립한다.
 *
 * **꼬리는 안 따라간다.** 꼬리는 고가와 시가 사이에 남는 자국이라 제자리에서 색만
 * 파랗게 바뀐다 — 같이 내려보냈더니 기둥이 아니라 차트가 통째로 미끄러지는 그림이 됐다.
 */
function pillarSlip(time: number): number {
  if (time < PLR_DIVE) return 0;

  /* 몸통 꼭대기가 창 아래로 나가는 거리 — 한 줄이라도 남으면 이음매에서 그게 사라진다 */
  return (PLR_DEEP - PLR_BASE) * easeInOut(clamp01((time - PLR_DIVE) / (PLR_GONE - PLR_DIVE)));
}

const pillar: MemeScene = {
  id: "pillar",
  title: "불기둥",
  blurb: "9시엔 전고점 돌파. 종가엔 무슨 일이 있었나.",
  loopMs: PILLAR_LOOP,
  stillMs: 2800,

  draw(p, frame) {
    const time = frame.time;
    const osc = oscillator(time / PILLAR_LOOP);
    const slip = pillarSlip(time);
    const close = pillarPrice(time) + slip;
    const open = PLR_BASE + slip;
    /* 종가가 시가보다 위(=화면에서 작은 y)면 양봉이다 */
    const up = close < open;
    const mood = up ? "#ff5c5c" : "#5c9dff";
    const top = Math.min(open, close);
    const bottom = Math.max(open, close);

    /* ── 흰 차트 창 ── */
    p.clear("#161c2b");
    p.rect(PLR_PANEL.x - 1, PLR_PANEL.y - 1, PLR_PANEL.w + 2, PLR_PANEL.h + 2, "#39435c");
    p.rect(PLR_PANEL.x, PLR_PANEL.y, PLR_PANEL.w, PLR_PANEL.h, "#f4f6f9");

    /*
     * 창 머리띠 — **글자는 안 넣는다.** 종목명을 적으면 이 판이 남의 계좌를 보여주는
     * 화면이 되고, 짤에 숫자·종목을 안 싣는다는 규칙과도 어긋난다. 단추 세 개면
     * "창"으로 읽히는 데 충분하다.
     */
    p.rect(PLR_PANEL.x, PLR_PANEL.y, PLR_PANEL.w, 5, "#dfe5ee");
    p.rect(PLR_PANEL.x, PLR_PANEL.y + 5, PLR_PANEL.w, 1, "#c3ccdb");
    for (let i = 0; i < 3; i += 1) p.rect(PLR_PANEL.x + 3 + i * 4, PLR_PANEL.y + 2, 2, 2, "#b6c0d0");

    /* 눈금 — 흰 바탕만 있으면 차트 창이 아니라 그냥 판때기다 */
    for (let y = PLR_PANEL.y + 18; y < PLR_PANEL.y + PLR_PANEL.h; y += 16) {
      p.rect(PLR_PANEL.x, y, PLR_PANEL.w, 1, "#e6eaf1");
    }
    for (let x = PLR_PANEL.x + 14; x < PLR_PANEL.x + PLR_PANEL.w; x += 14) {
      p.rect(x, PLR_PANEL.y + 6, 1, PLR_PANEL.h - 6, "#eef1f6");
    }

    /* 말풍선 꼬리가 붙을 자리. 개미 자세가 정하므로 그리면서 채운다. */
    let bubbleAt = { x: PLR_ANT_LEFT + 8 * PLR_SCALE, y: PLR_ANT_TOP + 2 * PLR_SCALE - 2 };

    p.clipped(PLR_PANEL.x, PLR_PANEL.y + 6, PLR_PANEL.w, PLR_PANEL.h - 6, () => {
      /*
       * 날씨는 앱과 같은 규칙이다 — **오르면 폭죽, 내리면 비**. 둘 다 창 안에서만 친다:
       * 밖으로 넘치면 차트 창이 아니라 화면 전체가 하늘이 된다.
       */
      const party = clamp01((time - 700) / 400) * clamp01((PLR_APEX + 300 - time) / 500);
      if (party > 0) {
        for (let i = 0; i < 7; i += 1) {
          const age = (time - (800 + i * 380)) / 1100;
          if (age <= 0 || age >= 1) continue;

          /*
           * 터지는 자리는 **개미 머리 위쪽으로만** 잡는다 — 아무 데나 터뜨리면 개미
           * 얼굴 앞에서 터져 표정도 폭죽도 안 보인다.
           */
          const spot = seededRandom(frame.seed + 101 + i * 7);
          drawBurst(
            p,
            PLR_PANEL.x + 12 + spot() * (PLR_PANEL.w - 24),
            PLR_PANEL.y + 12 + spot() * 38,
            age,
            party,
            frame.seed + i,
            i,
          );
        }
      }

      /* 비 — 주기(800ms)가 한 바퀴를 정수로 나눠 이음매에서 빗줄기가 안 튄다 */
      const wet = clamp01((time - PLR_APEX) / 700) * clamp01((PILLAR_LOOP - 250 - time) / 500);
      if (wet > 0) {
        const rainRandom = seededRandom(frame.seed + 97);
        for (let i = 0; i < 26; i += 1) {
          const x = PLR_PANEL.x + rainRandom() * PLR_PANEL.w;
          const y = PLR_PANEL.y - 8 + (((time / 800 + rainRandom()) % 1) * (PLR_PANEL.h + 14));
          p.faded(wet * 0.8, () => p.line(x, y, x - 1, y + 5, "#8fb4e8"));
        }
      }

      /* 기준선 = 시가. 점선이라 봉·개미와 안 다툰다. */
      for (let x = PLR_PANEL.x; x < PLR_PANEL.x + PLR_PANEL.w; x += 3) {
        p.rect(x, PLR_BASE, 2, 1, "#b8c2d4");
      }

      /*
       * 꼬리 — 고가에서 몸통까지. 몸통보다 먼저 그려 밑에 깔린다.
       *
       * **고가는 지금까지 닿은 제일 높은 곳이다** — 천장(PLR_HIGH)을 그대로 쓰면 아직
       * 자라는 중인 봉 위로, 닿지도 않은 데까지 꼬리가 미리 서 있다. 솟는 동안은 몸통
       * 꼭대기가 곧 고가라 꼬리가 아예 없다.
       *
       * **꼬리 위 끝은 안 움직이고, 아래로만 늘어난다.** 몸통이 창 밖으로 미끄러져도
       * 꼬리는 고가에 박힌 채 **몸통 꼭대기까지 따라 내려와 붙어 있는다** — 위 끝까지
       * 같이 내리면 기둥이 아니라 차트가 통째로 미끄러지고, 기준선에서 끊으면 기둥과
       * 꼬리가 두 동강 나 남남이 된다. 색은 몸통을 따라 파랗게 바뀐다.
       *
       * 몸통이 창 밖으로 나간 뒤에도 꼬리는 창을 세로로 가로질러 남으므로 **한 바퀴
       * 끝에서 지워준다** — 안 그러면 다음 바퀴 첫 프레임에서 파란 줄 하나가 툭 없어진다.
       */
      const high = time < PLR_RISE ? top : PLR_HIGH;
      const wickBottom = top;
      if (wickBottom > high) {
        p.faded(clamp01((PILLAR_LOOP - 300 - time) / 600), () =>
          p.rect(PLR_MID - 2, high, 4, wickBottom - high, mood),
        );
      }

      /*
       * 몸통. **한 줄도 안 될 때는 아예 안 그린다** — 최소 두께를 두면 봉이 없는
       * 순간(씨앗 자리·본전)에도 파란 막대가 한 줄 서 있어서, 이음매에서 그게 툭 나타난다.
       */
      const height = bottom - top;
      if (height >= 1) {
        p.rect(PLR_X, top, PLR_W, height, mood);
        p.rect(PLR_X + 3, top + 2, 3, Math.max(1, height - 4), up ? "#ffb3b3" : "#a8ccff");
        p.rect(PLR_X + PLR_W - 5, top, 5, height, up ? "#c0392b" : "#2f6bcc");
      }

      /*
       * 불 — 몸통 꼭대기에서 혀가 날름거린다. 정점에서 꺼지고, 꺼진 다음에야 봉이 떨어진다.
       * **봉 폭을 넘겨 그리지 않는다**: 넓게 퍼지면 불기둥이 아니라 산불이 되고 기둥의
       * 윤곽이 흐려진다. 흰 바탕이라 노랑은 겉이 아니라 **주황 안쪽**에만 둔다.
       */
      const fire = clamp01(Math.min(time / 400, (PLR_APEX + 200 - time) / 700));
      if (fire > 0) {
        for (let i = 0; i < 5; i += 1) {
          const x = PLR_X + 2 + i * 6;
          const tongue = (4 + 5 * Math.abs(osc(4, i * 0.17))) * fire;
          p.rect(x, top - tongue * 0.6, 4, tongue * 0.6 + 2, "#ff6a24");
          p.rect(x + 1, top - tongue, 2, tongue + 2, "#ff6a24");
          p.rect(x + 1, top - tongue * 0.5, 2, tongue * 0.5 + 2, "#ffb02e");
        }
      }

      /*
       * 개미 — **뭘 하는지는 봉이 정한다.** 천장을 뚫을 즈음 뛰고, 봉이 눈높이 위에
       * 있으면 올려다보고, 기준선 아래로 내려가면(=음봉) 엎드려 내려다본다. 막(시간)에
       * 걸어두면 봉은 아직 하늘에 있는데 개미가 먼저 고개를 숙인다. 봉이 창 밖으로
       * 사라진 뒤에는 도로 앞을 본다 — 한 바퀴의 끝과 시작이 같은 자세라야 이음매에서
       * 개미가 안 튄다.
       */
      const eyeLevel = PLR_ANT_TOP + 3 * PLR_SCALE;
      const hop =
        time >= PLR_BREAK && time < PLR_APEX
          ? Math.sin(Math.PI * (((time - PLR_BREAK) % PLR_HOP_MS) / PLR_HOP_MS))
          : 0;
      const pose: AntPose =
        time < 500 || time > PLR_GONE
          ? "stand"
          : hop > 0.3
            ? "jump"
            : close > PLR_BASE
              ? "prone"
              : top < eyeLevel - 6
                ? "lookUp"
                : "lookDown";
      const lift = Math.round(hop * 9);
      p.sprite(antPixels(PLR_STAGE, pose), PLR_ANT_LEFT, PLR_ANT_TOP - lift, PLR_SCALE);

      /* 뛴 자리에 이는 먼지 — 발이 떠 있는 동안만 남는다 */
      if (lift > 1) {
        p.faded(0.5, () => {
          p.rect(PLR_ANT_LEFT + 3 * PLR_SCALE, PLR_BASE - 1, 4, 1, "#c3ccdb");
          p.rect(PLR_ANT_LEFT + 11 * PLR_SCALE, PLR_BASE - 1, 4, 1, "#c3ccdb");
        });
      }

      /* 말풍선 꼬리는 개미 머리 위에 둔다 — 엎드리면 머리가 오른쪽 끝으로 간다 */
      bubbleAt =
        pose === "prone"
          ? { x: PLR_ANT_LEFT + 12 * PLR_SCALE, y: PLR_ANT_TOP + 10 * PLR_SCALE - 2 }
          : { x: PLR_ANT_LEFT + 8 * PLR_SCALE, y: PLR_ANT_TOP + 2 * PLR_SCALE - 2 - lift };
    });

    /*
     * 말은 **뽑지 않고 대본대로** 여섯 컷이 흐른다 (아침 장 → 장중 → 종가). 앞뒤가
     * 이어지는 하루라 순서가 곧 이야기고, 뽑기에 맡기면 종가 얘기가 첫 컷에 뜬다.
     * 그래서 이 판도 `MEME_LINES`에 없고 **"다시 뽑기"가 말은 안 바꾼다** (안 울어와 같다).
     */
    return speakScript(PILLAR_SCRIPT, frame, PILLAR_LOOP, bubbleAt.x, bubbleAt.y);
  },
};

/**
 * 폭죽 한 발 — 가운데에서 조각이 퍼지고 끝에서 처진다. **회전은 못 쓰므로**(도트 그림)
 * 조각 자리는 sin/cos로 미리 재서 찍는다.
 */
function drawBurst(
  p: Painter,
  cx: number,
  cy: number,
  age: number,
  alpha: number,
  seed: number,
  index: number,
) {
  const random = seededRandom(seed);
  const colors = ["#ff3b3b", "#ff9f1c", "#2ec27e", "#3b82f6", "#a855f7"] as const;
  /* 색은 순서로 돌린다 — 뽑으면 한 씨앗에서 같은 색이 연달아 터져 한 판이 통째로 붉다 */
  const color = colors[(index + Math.floor(seed)) % colors.length] ?? "#ff3b3b";
  /* 처음부터 한 뼘 벌어진 채 시작한다 — 0에서 퍼지면 터진 순간이 색 덩어리 하나로 보인다 */
  const spread = (0.28 + 0.72 * easeOut(clamp01(age))) * 16;
  /* 끝에서만 사그라든다 — 처음부터 옅어지면 흰 바탕에서 조각이 통째로 안 보인다 */
  const fade = alpha * clamp01((1 - age) * 2.2);

  /*
   * 두 겹으로 터뜨린다 — 한 겹이면 조각이 성겨서 흰 바탕에 점 몇 개로 흩어진다.
   * 안쪽 겹은 늦게 퍼지고 작아서 터진 자리에 심이 남는다.
   */
  for (const [count, radius, size] of [
    [16, 1, 2],
    [10, 0.62, 1],
  ] as const) {
    for (let i = 0; i < count; i += 1) {
      const angle = (TAU * i) / count + random() * 0.3;
      const distance = spread * radius * (0.78 + random() * 0.3);
      const x = cx + Math.cos(angle) * distance;
      /* 끝으로 갈수록 아래로 처져야 터진 것으로 읽힌다 — 동그란 고리는 굴렁쇠가 된다 */
      const y = cy + Math.sin(angle) * distance + age * age * 8;
      p.faded(fade, () => p.rect(x, y, size, size, color));
    }
  }

  /*
   * 터지는 순간의 섬광. **동그란 판이 아니라 십자다** — 원으로 그렸더니 사그라들기
   * 전까지 색공 하나가 떠 있는 것처럼 보였다.
   */
  p.faded(alpha * clamp01(1 - age * 6), () => {
    p.rect(cx - 4, cy, 9, 1, color);
    p.rect(cx, cy - 4, 1, 9, color);
  });
}

/* ════════════════════════════════════════════════════
   13. 물타기 — 물 주는 만큼 자라긴 하는데
   ════════════════════════════════════════════════════ */

/**
 * 개미가 물뿌리개로 제 주식에 물을 준다. **물은 돈이다** — 주둥이에서 나오는 건 동전과
 * 지폐고, 한 번 줄 때마다 봉이 **아주 조금씩** 자란다. 말장난이 그림이 된 판이라 그림
 * 쪽에서 더 보탤 게 없다: 물을 준다 = 물을 탄다.
 *
 * **작아지는 건 물건이지 그림이 아니다.** 개미를 한 배 작게(스케일 2) 그리고 봉·뿌리·
 * 이름표를 그에 맞춰 줄여 가운데에 모으되, **하늘과 땅은 화면을 끝까지 채운다** — 배경까지
 * 같이 줄여 액자에 넣었더니 짤이 아니라 액자 사진이 됐다. 여백은 배경 위의 빈자리다.
 *
 * **자란 키는 한 바퀴 끝에서 되돌아간다.** 돈방석의 동전 더미나 눈물바다의 수면과 같은
 * 자리다 — 되돌아오지 않는 움직임이라 이음매가 컷이 되지만, 그게 이 판의 농담이기도 하다
 * (네 번을 부어도 다음 날 아침이면 도로 그만큼이다). 대신 **한 번에 자라는 키를 작게**
 * 잡아 컷이 툭 튀지 않게 한다.
 *
 * 뿌리는 땅속 KOSPI에 닿아 있다. **이 판에 숫자는 없다** — 지수 이름만 이름표로 박고,
 * 얼마를 부었는지는 짤 밖의 일로 둔다.
 */
/**
 * 한 바퀴. **마지막 클로즈업에서 한 박자 더 머문다** — 카메라가 붙자마자 끝나면 새싹을
 * 볼 새가 없어서, 물주기 네 번(6.5초) 뒤로 4초를 남겨뒀다.
 */
const WATER_LOOP = 10600;
/** 잔디선 — 봉이 서는 자리이자 개미가 서는 자리 */
const WTR_GROUND = 125;
const WTR_X = 71;
const WTR_W = 14;
const WTR_MID = WTR_X + WTR_W / 2;
/** 처음 키 */
const WTR_START_H = 23;
/**
 * 한 번에 자라는 키. **작게 잡는다** — "아주 조금씩"이 이 판의 농담이고, 한 바퀴에 자란
 * 만큼이 이음매에서 그대로 되돌아가므로 크게 잡을수록 컷이 툭 튄다.
 */
const WTR_STEP = 3.2;
const WTR_POURS = 4;
/** 첫 물주기 시각과 간격 */
const WTR_FIRST = 700;
const WTR_GAP = 1600;
/** 돈이 날아가는 시간과, 그 뒤 봉이 자라는 시간 */
const WTR_FALL_MS = 480;
const WTR_GROW_MS = 620;
/** 한 번에 흘려보내는 돈 개수와 간격 — 촘촘해야 물줄기로 읽힌다 */
const WTR_DROPS = 8;
const WTR_DROP_GAP = 55;
const WTR_SCALE = 2;
const WTR_ANT_LEFT = 20;
const WTR_ANT_TOP = WTR_GROUND - 16 * WTR_SCALE;
/** 잔디·하늘 앞이라 붉은 단계로 둔다 */
const WTR_STAGE = 44;
/** 물뿌리개가 놓이는 자리 — 개미 팔 끝(스프라이트 13칸, 6줄) */
const WTR_CAN_X = WTR_ANT_LEFT + 13 * WTR_SCALE;
const WTR_CAN_Y = WTR_ANT_TOP + 6 * WTR_SCALE;
/** 주둥이 끝 — 돈이 여기서 나온다 */
const WTR_SPOUT_X = WTR_CAN_X + 12;
const WTR_SPOUT_Y = WTR_CAN_Y + 8;
/** 이름표가 박히는 깊이 (잔디선에서 아래로) */
const WTR_TAG_DROP = 27;
/**
 * 마지막 막 — **새싹으로 밀고 들어간다.** 네 번을 부어놓고 화면은 그대로 끝나면 "그래서
 * 얼마나 컸는데"가 안 보인다. 카메라가 붙어야 그 조그만 새싹이 이 판의 결론이 된다.
 */
const WTR_CLOSE_AT = 6500;
const WTR_CLOSE_MS = 900;
/** 클로즈업 배율. 봉이 화면 폭의 절반쯤 되는 크기다. */
const WTR_CLOSE_K = 3;
/** 클로즈업에서 잔디선이 가 있을 자리 — 화면 밖이라 땅이 통째로 빠진다 */
const WTR_CLOSE_GROUND = 207;
/**
 * 대본 다섯 컷의 경계. **물주기 한 번에 한 컷**이고 마지막 하나가 클로즈업이라,
 * 물 주는 박자(`WTR_FIRST`·`WTR_GAP`)를 옮기면 여기도 같이 옮겨야 한다.
 */
const WTR_CUTS = [400, 2000, 3600, 5200, WTR_CLOSE_AT, WATER_LOOP] as const;

/** 지금까지 부은 만큼 자란 키. 물이 닿은 뒤에야 자란다. */
function waterHeight(time: number): number {
  let height = WTR_START_H;

  for (let i = 0; i < WTR_POURS; i += 1) {
    const grew = (time - (WTR_FIRST + i * WTR_GAP + WTR_FALL_MS)) / WTR_GROW_MS;
    height += WTR_STEP * easeOut(clamp01(grew));
  }

  return height;
}

const water: MemeScene = {
  id: "water",
  title: "물타기",
  blurb: "물을 준다. 물을 탄다. 조금씩 크긴 큰다.",
  loopMs: WATER_LOOP,
  stillMs: 9200,

  draw(p, frame) {
    const time = frame.time;
    const osc = oscillator(time / WATER_LOOP);
    const height = waterHeight(time);

    /*
     * 카메라 — 0이면 멀리서 본 화단, 1이면 새싹 코앞이다. **한 그림을 배율만 바꿔
     * 그린다**: 클로즈업용 그림을 따로 두면 같은 새싹이 두 벌이 되어 서서히 갈라진다.
     */
    const close = easeInOut(clamp01((time - WTR_CLOSE_AT) / WTR_CLOSE_MS));
    const k = lerp(1, WTR_CLOSE_K, close);
    const groundY = lerp(WTR_GROUND, WTR_CLOSE_GROUND, close);
    const plantX = lerp(WTR_MID, 54, close);
    const top = groundY - height * k;

    /* 물주기 한 판 — 지금이 몇 번째고, 그 안에서 얼마나 지났나 */
    const index = Math.max(
      0,
      Math.min(WTR_POURS - 1, Math.floor((time - WTR_FIRST + 300) / WTR_GAP)),
    );
    const since = time - (WTR_FIRST + index * WTR_GAP);
    /* 마지막 방울이 닿을 때까지 기울인 채 둔다 — 먼저 세우면 허공에서 돈이 쏟아진다 */
    const pouring = since > -260 && since < WTR_FALL_MS + (WTR_DROPS - 1) * WTR_DROP_GAP;

    /*
     * **배경은 화면을 끝까지 채운다.** 줄인 건 개미와 봉이지 그림이 아니다 — 하늘과 땅을
     * 같이 줄여 액자에 넣었더니 짤이 아니라 액자 사진이 됐다. 여백은 배경 위의 빈자리로
     * 두고, 물건만 작게 그려 가운데에 모은다.
     */
    p.vGradient(0, groundY, "#7cc9f0", "#e3f5ff");
    p.faded(1 - close, () => {
      drawCloud(p, 24, 28, 4);
      drawCloud(p, 86, 48, 3);
    });

    /* 잔디와 흙 — 위 세 줄만 잔디고 그 아래는 뿌리가 사는 땅이다 */
    if (groundY < p.h) {
      p.rect(0, groundY, p.w, 3 * k, "#5fbf5a");
      p.rect(0, groundY + 3 * k, p.w, 2 * k, "#3f8f3f");
      p.rect(0, groundY + 5 * k, p.w, 16 * k, "#7a5330");
      p.rect(0, groundY + 21 * k, p.w, p.h, "#5c3f22");

      const soilRandom = seededRandom(frame.seed + 61);
      for (let i = 0; i < 70; i += 1) {
        const x = Math.floor(soilRandom() * p.w);
        const y = groundY + (6 + soilRandom() * 60) * k;
        if (y > p.h) continue;
        p.dot(x, y, i % 3 === 0 ? "#8a6238" : "#4a3018");
      }
      /* 잔디 포기 — 잔디선이 칼로 자른 듯 반듯하면 땅이 아니라 색 띠로 보인다 */
      for (let x = 0; x < p.w; x += 5 * k) {
        p.rect(x + (x % 3), groundY - 2 * k, 1 * k, 2 * k, "#5fbf5a");
      }

      /* 뿌리 — 봉 밑에서 갈라져 KOSPI 이름표까지 내려간다 */
      const rootRandom = seededRandom(frame.seed + 67);
      p.rect(plantX - 2 * k, groundY, 4 * k, 26 * k, "#9c7a4a");
      p.rect(plantX - 1 * k, groundY + 26 * k, 2 * k, 12 * k, "#9c7a4a");
      for (let i = 0; i < 6; i += 1) {
        const dir = i % 2 === 0 ? -1 : 1;
        const from = groundY + (5 + i * 4) * k;
        const reach = (9 + rootRandom() * 14) * k;
        const drop = (6 + rootRandom() * 8) * k;
        p.line(plantX, from, plantX + dir * reach, from + drop, "#9c7a4a");
        p.line(plantX, from + 1, plantX + dir * reach, from + drop + 1, "#8a6a3e");
        p.line(
          plantX + dir * reach * 0.7,
          from + drop * 0.7,
          plantX + dir * (reach + 6 * k),
          from + drop + 4 * k,
          "#7a5c33",
        );
      }

      /*
       * KOSPI 이름표 — **판때기는 도트로, 글자는 늘린 뒤에 얹는다** (역 이름 간판과 같은
       * 규칙). 흙빛 위에 검은 글자를 그냥 올리면 안 읽혀서 밝은 판때기가 꼭 있어야 한다.
       */
      const tagY = groundY + WTR_TAG_DROP * k;
      p.rect(plantX - 9 * k, tagY, 18 * k, 10 * k, "#f3ece2");
      p.rect(plantX - 9 * k, tagY, 18 * k, 1 * k, "#ffffff");
      p.rect(plantX - 9 * k, tagY + 9 * k, 18 * k, 1 * k, "#b6ada0");
      p.rect(plantX - 10 * k, tagY, 1 * k, 10 * k, "#c9c0b2");
      p.rect(plantX + 9 * k, tagY, 1 * k, 10 * k, "#c9c0b2");
    }

    /*
     * 봉 — 자라는 줄기다. 양봉이라 빨강이고, 위로는 꼬리가 아니라 **새싹**이 달린다.
     * 색 규칙은 다른 판과 같게 두되(수익=빨강) 잎만 초록이라, 차트인지 화분인지
     * 헷갈리는 게 이 판의 그림이다.
     */
    const width = WTR_W * k;
    p.rect(plantX - width / 2, top, width, groundY - top, "#ff5c5c");
    p.rect(plantX - width / 2 + 2 * k, top + 2 * k, 3 * k, Math.max(1, height * k - 4 * k), "#ffb3b3");
    p.rect(plantX + width / 2 - 4 * k, top, 4 * k, groundY - top, "#c0392b");
    drawSprout(p, plantX, top, k, osc);

    /*
     * 개미 — 클로즈업이 시작되면 화면 밖으로 빠진다. **같이 커지지 않는다**: 스프라이트
     * 배율은 정수뿐이라 2 → 6으로 뛰면 개미만 갑자기 세 배가 된다. 카메라가 새싹으로
     * 붙는 동안 옆으로 밀려나는 게 자연스럽고, 어차피 이 컷의 주인공은 새싹이다.
     */
    if (close < 0.85) {
      const antLeft = WTR_ANT_LEFT - close * 150;
      p.faded(clamp01(1 - close * 1.6), () => {
        const pose: AntPose = pouring ? "dig2" : "dig1";
        p.sprite(antPixels(WTR_STAGE, pose), antLeft, WTR_ANT_TOP, WTR_SCALE);
        drawWateringCan(
          p,
          antLeft + 13 * WTR_SCALE,
          WTR_CAN_Y + (pouring ? 2 : 0),
          pouring,
        );
      });
    }

    /*
     * 물 = 돈. 주둥이에서 나와 봉 밑동으로 날아가 흙에 스민다.
     * **동전과 지폐를 섞고 큼직하게 그린다** — 한 가지만 뿌리면 물이 아니라 동전
     * 던지기로 보이고, 잘게 그리면 그냥 빗방울이라 "물=돈"이 안 읽힌다.
     */
    for (let i = 0; i < WTR_POURS; i += 1) {
      for (let j = 0; j < WTR_DROPS; j += 1) {
        const age = time - (WTR_FIRST + i * WTR_GAP) - j * WTR_DROP_GAP;
        if (age < 0 || age > WTR_FALL_MS) continue;

        const t = age / WTR_FALL_MS;
        /* 떨어지는 자리는 밑동 언저리다 — 봉 위로 뿌리면 물이 아니라 던지는 그림이 된다 */
        const landX = WTR_X - 10 + j * 2;
        const x = lerp(WTR_SPOUT_X, landX, t);
        const y = lerp(WTR_SPOUT_Y, WTR_GROUND - 3, t) - Math.sin(Math.PI * t) * 10;
        if (j % 2 === 0) drawBigCoin(p, x, y);
        else drawBill(p, x, y);
      }
    }

    /* 스며든 자리 — 젖은 흙이 잠깐 짙어진다 */
    if (since > WTR_FALL_MS - 60 && since < WTR_FALL_MS + 420) {
      p.faded(clamp01((WTR_FALL_MS + 420 - since) / 420) * 0.5, () =>
        p.rect(WTR_X - 6, WTR_GROUND + 3, WTR_W + 10, 4, "#4a3018"),
      );
    }

    /*
     * 말풍선은 **네 컷 동안 개미 머리 위**에 있다가, 마지막 컷에서 **새싹 위**로 옮겨간다.
     * 옮겨 붙이는 게 아니라 컷이 바뀌며 새로 뜨는 것이라(사이에 알파가 0을 지난다)
     * 자리가 뛰는 게 안 보인다.
     */
    const speaking =
      time >= WTR_CLOSE_AT
        ? { x: plantX, y: top - SPROUT_H * k - 2 }
        : { x: WTR_ANT_LEFT + 8 * WTR_SCALE, y: WTR_ANT_TOP + 2 * WTR_SCALE - 2 };

    return {
      ...speakCuts(WATER_SCRIPT, frame, WTR_CUTS, speaking.x, speaking.y),
      /*
       * 판때기 크기는 **글자 폭을 재서** 잡았다 — Galmuri11에서 "KOSPI"는 11px 기준
       * 34px이라 unit 4면 136px(=13.6칸)이고, 굵게(+1도트) 해도 18칸 판때기 안에 든다.
       * 눈대중으로 넓게 잡으면 이름표 한가운데 작은 글자가 뜬 그림이 된다.
       *
       * **이름표는 그림 따라 작아지지 않는다** — 뿌리가 어디에 닿아 있는지를 말하는
       * 글자라 작고 흐리면 있으나 마나다. 그래서 굵게 찍는다. 클로즈업으로 밀려 내려가면
       * 땅과 함께 화면 밖으로 나가므로 그때는 안 그린다.
       */
      labels:
        groundY < p.h
          ? [
              {
                text: "KOSPI",
                x: plantX,
                y: groundY + (WTR_TAG_DROP + 2.6) * k,
                alpha: 1,
                unit: 4 * k,
                bold: true,
              },
            ]
          : [],
    };
  },
};

/**
 * 새싹 — 잎 두 장과 줄기. **문자맵으로 그린다** (개미 스프라이트와 같은 방식).
 *
 * 클로즈업에서 배율(`k`)이 3배가 되는데, 원·선으로 그리면 도트가 아니라 매끈한 도형이
 * 커져서 **가까이 갈수록 해상도만 높아진 그림**이 된다 — 도트 그림에서 제일 안 되는 일이다.
 * 문자맵을 한 칸 = `k`로 찍으면 가까이 가도 도트가 같이 굵어져 픽셀 그림으로 남는다.
 *
 * 잎은 봉보다 넓게 뻗는다 — 봉 폭 안에 두면 새싹이 아니라 꼬리 끝 장식으로 보인다.
 */
const SPROUT: readonly string[] = [
  "...lll.....lll...",
  "..lLLLl...lLLLl..",
  ".lLLLLL...LLLLLl.",
  "..LLLLLdsdLLLLL..",
  "....dLL.s.LLd....",
  "........s........",
  "........s........",
  "........s........",
];
/** 문자맵 가운데 칸(줄기)과 높이 — 봉 꼭대기에 얹을 때 기준이 된다 */
const SPROUT_MID = 8;
const SPROUT_H = SPROUT.length;
const SPROUT_KEY: Readonly<Record<string, string>> = {
  L: "#4ec07a",
  l: "#8fe0a0",
  d: "#2f7f3f",
  s: "#3f8f3f",
};

function drawSprout(
  p: Painter,
  cx: number,
  top: number,
  k: number,
  osc: (cycles: number, phase?: number) => number,
) {
  /*
   * 흔들림도 **도트 단위로 끊는다** — 소수로 밀면 잎 가장자리만 한 줄씩 어긋나 도트가
   * 뭉개진다. 한 바퀴에 정수 번 도는 물결을 세 칸(-1·0·+1)으로 접어 쓴다.
   */
  const wave = osc(3);
  const sway = (wave > 0.35 ? 1 : wave < -0.35 ? -1 : 0) * k;

  SPROUT.forEach((row, y) => {
    /* 흔들리는 건 잎뿐이다 — 줄기까지 밀면 봉에서 떨어져 나온 것처럼 보인다 */
    const shift = y < 5 ? sway : 0;

    [...row].forEach((char, x) => {
      const color = SPROUT_KEY[char];
      if (!color) return;

      p.rect(cx + (x - SPROUT_MID) * k + shift, top + (y - SPROUT_H) * k, k, k, color);
    });
  });
}

/**
 * 물뿌리개. **기울인 모습을 따로 그린다** — 도트 그림은 회전을 못 하므로, 몸통을 내리고
 * 주둥이 끝을 아래로 꺾은 한 벌을 더 둔다 (열차 칸을 안 기울인 것과 같은 이유).
 */
function drawWateringCan(p: Painter, x: number, y: number, tipped: boolean) {
  const body = "#5c9dff";
  const dark = "#2f6bcc";
  const light = "#a8ccff";

  /* 몸통 */
  p.rect(x, y, 9, 8, body);
  p.rect(x, y, 9, 2, light);
  p.rect(x, y + 6, 9, 2, dark);
  /* 손잡이 — 뒤쪽 위로 한 줄 */
  p.rect(x - 2, y - 3, 2, 4, dark);
  p.rect(x - 2, y - 3, 6, 2, dark);

  /* 주둥이 — 세워두면 위로, 기울이면 아래로 */
  if (tipped) {
    p.rect(x + 8, y + 3, 4, 3, body);
    p.rect(x + 10, y + 5, 4, 3, dark);
  } else {
    p.rect(x + 8, y + 1, 4, 3, body);
    p.rect(x + 10, y - 2, 4, 3, dark);
  }
}

/** 물방울 노릇을 하는 동전. **다른 판의 동전보다 크다** — 이 판에서는 이게 물이다. */
function drawBigCoin(p: Painter, x: number, y: number) {
  p.disc(x, y, 3, "#c9962a");
  p.disc(x, y, 2, "#ffd24a");
  p.dot(x - 1, y - 1, "#fff3b0");
  p.dot(x + 1, y + 1, "#a87c1e");
}

/** 지폐 한 장 — 동전과 섞어 뿌린다 */
function drawBill(p: Painter, x: number, y: number) {
  p.rect(x, y, 8, 5, "#6fc38a");
  p.rect(x, y, 8, 1, "#a8e0b4");
  p.rect(x, y + 4, 8, 1, "#2f7f52");
  p.rect(x + 3, y + 1, 3, 3, "#2f7f52");
}

/* ════════════════════════════════════════════════════
   14. 코인 상자 — 상자 셋을 걸어가며 박고, 괴물 둘을 밟고, 지폐를 먹고 불기둥을 탄다
   ════════════════════════════════════════════════════ */

/**
 * 옆으로 흐르는 무대. 개미가 왼쪽에서 오른쪽으로 걸으면 **화면이 따라 흐르고**(개미는
 * 화면에 못 박혀 있고, 세계가 왼쪽으로 간다), 물음표 상자 밑에 서면 **머리로 상자를
 * 들이받는다**.
 *
 * **상자는 한 줄에 셋이다 — 한 걸음씩 걸어가며 하나씩 박는다.** 상자마다 제자리로
 * 걸어가 그 상자 바로 밑에서 뛰어야 하고, 박을 때마다 코인이 아니라 **미니 캔들
 * 하나가 상자에서 자라난다** — 음봉(손실) → 더 긴 음봉 → 마지막엔 작은 양봉으로
 * 방향이 뒤집힌다. 캔들이 다 자란 **뒤에** "똥 밟았네 → 뭐야 이거 → 도파민이
 * 부족해"로 이어지는 개미의 말이 뜬다 — 차트를 보고 반응하는 순서라야 그 말이
 * 무엇에 대한 반응인지 읽힌다.
 *
 * **셋을 다 박고 나면 이야기가 이어진다.** 전쟁 깃발 괴물이, 그걸 밟아 죽이면 이어서
 * 금리 깃발 괴물이 **오른쪽 화면 밖에서 걸어 들어온다** (둘 다 한 방에 찌부러진다).
 * 그다음 두 번째 물음표 상자가 나타나고, 이번엔 개미에게 걸어오는 **지폐**가 나온다.
 * 지폐를 먹으면 몸이 커지며 "LEVEL UP!"이 뜨고, 몇 걸음 더 걸어가면 **바닥에 놓인**
 * 세 번째 물음표 상자를 만나 그 위로 뛰어오른다 — 그 순간 상자에서 **불기둥**(주식의
 * 그 불기둥)이 솟아오르고, 개미가 그걸 타고 화면 밖으로 사라진다.
 *
 * 상자 셋을 박기까지는 **세계 한 마디(`BLK_WORLD`)에 맞춰 건 예전 걸음 속도를 그대로
 * 쓴다** — 그래서 첫인상은 안 바뀐다. 그 뒤는 **한 번의 여정이라 되돌아오지 않는다** —
 * 물타기의 자라는 봉과 같은 예외다. 한 바퀴 끝은 "빈 화면"이 아니라 "개미가 막 사라진
 * 하늘"이고, 다음 바퀴는 다시 걸어 들어오는 첫 장면으로 시작한다 (이음매는 컷이다).
 */

/** 바닥 벽돌 윗면 */
const BLK_GROUND = 150;
const BLK_SCALE = 2;
/** 지폐를 먹은 뒤(레벨업)의 배율 */
const BLK_LEVEL_SCALE = 3;
/** 개미가 서 있는 화면 자리. **개미는 가로로는 안 움직이고 세계가 흐른다.** */
const BLK_ANT_X = 30;
const BLK_ANT_TOP = BLK_GROUND - 16 * BLK_SCALE;
const BLK_STAGE = 44;
/** 배경 무늬 한 마디 */
const BLK_WORLD = 216;
const BLK_BOX = 16;
const BLK_BOX_TOP = 76;
/** 상자가 개미 머리 위(38칸 앞)에 오는 스크롤 — 상자마다 이 간격을 유지하며 멈춰 선다 */
const BLK_BOX_OFFSET = 38;
/**
 * 걷는 속도(칸/ms). **상자를 몇 개 박든, 몇 걸음을 걷든 걷는 속도는 안 바뀐다** —
 * 예전 이 판이 걸어 들어오고 나가는 걸음이 같은 세계 눈금 위에 있었을 때 값
 * (216÷4800)을 그대로 물려받은 상수다.
 */
const BLK_SPEED = 0.045;
/** 첫 상자까지 걸어 들어가는 시각 — 첫 상자의 월드 좌표(150)를 그대로 물려받는다 */
const BLK_STOP = 150 - BLK_BOX_OFFSET;
const BLK_WALK_IN = BLK_STOP / BLK_SPEED;
/** 머리가 상자 밑면에 닿는 높이 */
const BLK_LIFT = 30;

/**
 * 1막: 상자 셋. **한 상자를 박고(`BLK_HIT_MS`) → 다음 상자로 한 걸음 걷고
 * (`BOX1_STEP_MS`) → 또 박는다**를 세 번 반복한다. `BLK_BOX1_STOP[i]`가 상자 i
 * 앞에 멈춰 서는 스크롤 값이고, 화면 좌표는 늘 `BLK_BOX1_STOP[i] + BLK_BOX_OFFSET
 * - scroll`이다 — 상자 하나당 세계 좌표를 따로 정의하지 않고 "몇 걸음째냐"에서
 * 곧바로 뽑아낸다.
 */
const BLK_HITS = 3;
const BLK_HIT_MS = 1200;
const BOX1_STEP_MS = 600;
const BOX1_CANDLE_LEN: readonly number[] = [10, 20, 7];
const BOX1_CANDLE_UP: readonly boolean[] = [false, false, true];

const BLK_HIT0_END = BLK_WALK_IN + BLK_HIT_MS;
const BLK_STEP1_END = BLK_HIT0_END + BOX1_STEP_MS;
const BLK_BOX1_STOP1 = BLK_STOP + BOX1_STEP_MS * BLK_SPEED;
const BLK_HIT1_END = BLK_STEP1_END + BLK_HIT_MS;
const BLK_STEP2_END = BLK_HIT1_END + BOX1_STEP_MS;
const BLK_BOX1_STOP2 = BLK_BOX1_STOP1 + BOX1_STEP_MS * BLK_SPEED;
const BLK_HIT2_END = BLK_STEP2_END + BLK_HIT_MS;
/** 상자 i가 멈춰 서는 스크롤 값 — 셋 다 여기서 찾는다 */
const BLK_BOX1_STOP: readonly number[] = [BLK_STOP, BLK_BOX1_STOP1, BLK_BOX1_STOP2];
/** 상자 i를 박기 시작하는 시각 */
const BLK_BOX1_HIT_START: readonly number[] = [BLK_WALK_IN, BLK_STEP1_END, BLK_STEP2_END];
/** 상자 셋을 다 박고 나면(=이 시각부터) 새 이야기가 시작된다 */
const BLK_BOX1_END = BLK_HIT2_END;

/* ── 2·3막: 괴물 둘 — 오른쪽 화면 밖에서 걸어 들어와 한 방에 밟혀 죽는다 ── */
/** 괴물이 최종적으로 멈춰 밟히는 화면 자리. 개미 스프라이트 폭(16×스케일) 안쪽이라
 *  개미가 따로 다가서지 않아도 뛰어오르면 겹친다. */
const BLK_ENEMY_X = 48;
/** 화면 폭(108칸) 밖에서부터 이 자리까지 걸어오는 데 걸리는 시간 — 짧으면 스크롤이
 *  민 것과 구분이 안 가 "갑자기 나타난 것"으로 보인다. */
const BLK_ENEMY_WALK_MS = 1500;
/** 한 번 뛰어올라 착지하기까지 — 착지 순간 바로 찌부러진다(한 방 죽음). */
const BLK_STOMP_HOP_MS = 260;
const BLK_STOMP_LIFT = 20;
/** 착지(찌부) + 입자로 사라지기까지, 한 마리당 전체 시간 */
const BLK_STOMP_MS = 600;

const BLK_E1_WALK_END = BLK_BOX1_END + BLK_ENEMY_WALK_MS;
const BLK_E1_STOP = BLK_BOX1_STOP2 + BLK_ENEMY_WALK_MS * BLK_SPEED;
const BLK_E1_WORLD_X = BLK_E1_STOP + BLK_ENEMY_X;
const BLK_E1_STOMP_END = BLK_E1_WALK_END + BLK_STOMP_MS;

const BLK_E2_WALK_END = BLK_E1_STOMP_END + BLK_ENEMY_WALK_MS;
const BLK_E2_STOP = BLK_E1_STOP + BLK_ENEMY_WALK_MS * BLK_SPEED;
const BLK_E2_WORLD_X = BLK_E2_STOP + BLK_ENEMY_X;
const BLK_E2_STOMP_END = BLK_E2_WALK_END + BLK_STOMP_MS;

/* ── 4·5막: 두 번째 물음표 상자 — 이번엔 지폐가 나와 걸어온다 ── */
const BLK_BOX2_WALK_MS = 700;
const BLK_BOX2_WALK_END = BLK_E2_STOMP_END + BLK_BOX2_WALK_MS;
const BLK_BOX2_STOP = BLK_E2_STOP + BLK_BOX2_WALK_MS * BLK_SPEED;
const BLK_BOX2_X = BLK_BOX_OFFSET;
const BLK_BOX2_WORLD_X = BLK_BOX2_STOP + BLK_BOX2_X;
const BLK_BOX2_TOP = BLK_BOX_TOP;

const BLK_BOX2_HIT_MS = 700;
const BLK_BOX2_HIT_END = BLK_BOX2_WALK_END + BLK_BOX2_HIT_MS;

const BLK_SEED_MS = 900;
const BLK_SEED_END = BLK_BOX2_HIT_END + BLK_SEED_MS;

/* ── 6막: 먹고 레벨업 — 몸이 커지고 화면 가운데 LEVEL UP ── */
const BLK_LEVEL_MS = 1400;
const BLK_LEVEL_END = BLK_SEED_END + BLK_LEVEL_MS;

/* ── 7막: 몇 걸음 더 걸어 바닥 상자를 만나 그 위로 뛰어오른다 ── */
const BLK_WALK3_MS = 900;
const BLK_WALK3_END = BLK_LEVEL_END + BLK_WALK3_MS;
const BLK_WALK3_STOP = BLK_BOX2_STOP + BLK_WALK3_MS * BLK_SPEED;
/** 바닥 상자가 최종적으로 서는 화면 자리(왼쪽 위 좌표). 개미 스프라이트(커진 채)
 *  안쪽이라 뛰어오르면 그 위에 착지하는 것으로 읽힌다. */
const BLK_BOX3_X = 40;
const BLK_BOX3_WORLD_X = BLK_WALK3_STOP + BLK_BOX3_X;

const BLK_JUMP3_MS = 600;
const BLK_JUMP3_END = BLK_WALK3_END + BLK_JUMP3_MS;

/* ── 8막: 불기둥을 타고 화면 밖으로 ── */
const BLK_CLIMB_MS = 1700;
const BLK_CLIMB_END = BLK_JUMP3_END + BLK_CLIMB_MS;
const BLK_PILLAR_TOP = -26;

const BLOCK_LOOP = BLK_CLIMB_END;

/** 지금까지 흐른 거리. 상자를 박거나 괴물을 밟거나 뛰어오르는 동안은 멈춰 선다. */
function blockScroll(time: number): number {
  if (time < BLK_WALK_IN) return time * BLK_SPEED;
  if (time < BLK_HIT0_END) return BLK_STOP;
  if (time < BLK_STEP1_END) return BLK_STOP + (time - BLK_HIT0_END) * BLK_SPEED;
  if (time < BLK_HIT1_END) return BLK_BOX1_STOP1;
  if (time < BLK_STEP2_END) return BLK_BOX1_STOP1 + (time - BLK_HIT1_END) * BLK_SPEED;
  if (time < BLK_HIT2_END) return BLK_BOX1_STOP2;
  if (time < BLK_E1_WALK_END) return BLK_BOX1_STOP2 + (time - BLK_HIT2_END) * BLK_SPEED;
  if (time < BLK_E1_STOMP_END) return BLK_E1_STOP;
  if (time < BLK_E2_WALK_END) return BLK_E1_STOP + (time - BLK_E1_STOMP_END) * BLK_SPEED;
  if (time < BLK_E2_STOMP_END) return BLK_E2_STOP;
  if (time < BLK_BOX2_WALK_END) return BLK_E2_STOP + (time - BLK_E2_STOMP_END) * BLK_SPEED;
  if (time < BLK_LEVEL_END) return BLK_BOX2_STOP;
  if (time < BLK_WALK3_END) return BLK_BOX2_STOP + (time - BLK_LEVEL_END) * BLK_SPEED;

  return BLK_WALK3_STOP;
}

/**
 * 월드 좌표를 화면 좌표로. 배경(토관·벽돌·언덕)은 `BLK_WORLD`마다 되풀이되므로
 * **접어서** 돌려준다. 상자 셋·괴물 둘·상자2·상자3은 한 번만 등장하는 이야기 소품이라
 * 이 함수를 안 거치고 `월드 좌표 - scroll`을 그대로 쓴다 (되풀이될 일이 없는 걸
 * 접으면 스크롤이 한 바퀴를 넘는 순간 엉뚱한 자리로 순간이동한다).
 */
function blockAt(worldX: number, scroll: number, period = BLK_WORLD): number {
  const x = (((worldX - scroll) % period) + period) % period;

  return x > period - 60 ? x - period : x;
}

/** 괴물 한 마리의 찌부 상태 — 한 번 뛰면 그걸로 끝이라 세는 횟수가 없다. */
interface StompState {
  lift: number;
  squish: number;
  dying: boolean;
  dieT: number;
}

function stompOnce(localTime: number): StompState {
  const hopping = localTime < BLK_STOMP_HOP_MS;
  const lift = hopping ? Math.sin((Math.PI * localTime) / BLK_STOMP_HOP_MS) * BLK_STOMP_LIFT : 0;
  const dieT = hopping
    ? 0
    : clamp01((localTime - BLK_STOMP_HOP_MS) / (BLK_STOMP_MS - BLK_STOMP_HOP_MS));

  return { lift, squish: hopping ? 0 : 1, dying: !hopping, dieT };
}

/** 말풍선 몹의 크기 — 찌부러지면 낮고 넓어진다. 그리는 쪽과 라벨 자리를 잡는 쪽이
 *  같은 값을 써야 어긋나지 않는다. */
function flagMonsterSize(squish: number): { w: number; h: number } {
  const squished = squish >= 1;

  return { w: squished ? 38 : 32, h: squished ? 6 : 18 };
}

interface EnemyStompOverride {
  antLift: number;
  antPose: AntPose;
  bubble: SceneBubble;
}

interface EnemyDrawResult {
  labels: SceneLabel[];
  stomp: EnemyStompOverride | null;
}

/**
 * 괴물 한 마리를 걸어 들어오게 하고, 밟히면 찌부러뜨려 죽인다. 둘(전쟁·금리)이 같은
 * 요령이라 함수 하나로 묶는다 — 두 벌로 손으로 맞춰두면 한쪽만 고쳐질 자리가 된다.
 * `walkStart`~`stompEnd` 범위 밖이면 `null` — 호출부는 아무것도 덮어쓰지 않는다.
 */
function drawEnemyEncounter(
  p: Painter,
  frame: SceneFrame,
  scroll: number,
  worldX: number,
  walkStart: number,
  walkEnd: number,
  stompEnd: number,
  flagWord: string,
  stompLine: string,
): EnemyDrawResult | null {
  const time = frame.time;
  if (time < walkStart || time >= stompEnd) return null;

  const screenX = worldX - scroll;
  const stomping = time >= walkEnd;
  const stomp = stomping ? stompOnce(time - walkEnd) : null;
  const squish = stomp?.squish ?? 0;
  const alpha = clamp01(1 - (stomp?.dieT ?? 0));
  /*
   * 걸어오는 동안 살짝 씰룩거려야 "이동"으로 읽힌다 — 가만히 있는 그림을 스크롤만
   * 밀면 배경이 미는 건지 저 혼자 오는 건지 구분이 안 간다.
   */
  const bob = stomping ? 0 : Math.sin(time * 0.02) * 1;
  const groundY = BLK_GROUND + bob;

  drawFlagMonster(p, screenX, groundY, squish, alpha);

  if (stomp?.dying && stomp.dieT > 0.1) {
    const burst = clamp01((stomp.dieT - 0.1) / 0.7);
    for (let i = 0; i < 8; i += 1) {
      const angle = (TAU * i) / 8;
      const distance = 3 + burst * 12;
      p.faded(clamp01(1 - burst), () =>
        p.dot(
          screenX + Math.cos(angle) * distance,
          BLK_GROUND - 6 + Math.sin(angle) * distance,
          "#c9962a",
        ),
      );
    }
  }

  const { h } = flagMonsterSize(squish);
  const labels: SceneLabel[] =
    alpha > 0 && squish < 1
      ? [
          {
            text: flagWord,
            x: screenX,
            y: groundY - h + 3,
            alpha,
            unit: 6,
            bold: true,
            color: "#2b2f38",
          },
        ]
      : [];

  if (!stomp) return { labels, stomp: null };

  return {
    labels,
    stomp: {
      antLift: stomp.lift,
      antPose: stomp.lift > 0.5 ? "jump" : "stand",
      bubble: {
        text: stompLine,
        x: BLK_ANT_X + 8 * BLK_SCALE,
        y: BLK_ANT_TOP + 2 * BLK_SCALE - 2,
        alpha: clamp01(Math.min(time - walkEnd, stompEnd - time) / FADE_MS),
      },
    },
  };
}

const block: MemeScene = {
  id: "block",
  title: "코인 상자",
  blurb: "상자 셋을 걸어가며 박고 괴물 둘을 밟고, 지폐를 먹고 불기둥을 타고 사라진다.",
  loopMs: BLOCK_LOOP,
  stillMs: BLK_SEED_END + BLK_LEVEL_MS * 0.45,

  draw(p, frame) {
    const time = frame.time;
    const seed = frame.seed;
    const scroll = blockScroll(time);
    const walking =
      time < BLK_WALK_IN ||
      (time >= BLK_HIT0_END && time < BLK_STEP1_END) ||
      (time >= BLK_HIT1_END && time < BLK_STEP2_END) ||
      (time >= BLK_BOX1_END && time < BLK_E1_WALK_END) ||
      (time >= BLK_E1_STOMP_END && time < BLK_E2_WALK_END) ||
      (time >= BLK_E2_STOMP_END && time < BLK_BOX2_WALK_END) ||
      (time >= BLK_LEVEL_END && time < BLK_WALK3_END);

    /* ── 배경 — 하늘·구름·캔들 스카이라인·토관·바닥은 이야기가 몇 막을 지나든 늘 같다 ── */
    p.clear("#a89ce8");

    for (const [x, y, size] of [
      [14, 34, 4],
      [70, 22, 3],
      [96, 46, 4],
    ] as const) {
      drawCloud(p, blockAt(x, scroll * 0.5, 108), y, size);
    }

    for (const [x, size] of [
      [10, 22],
      [96, 14],
      [186, 18],
    ] as const) {
      drawCandleHill(p, blockAt(x, scroll), BLK_GROUND, size);
    }

    drawMarioPipe(p, blockAt(52, scroll), BLK_GROUND, 34);

    for (let x = -(scroll % BLK_BOX) - BLK_BOX; x < p.w + BLK_BOX; x += BLK_BOX) {
      for (let y = BLK_GROUND; y < p.h; y += BLK_BOX) drawMarioBrick(p, x, y);
    }

    /* ── 1막: 상자 셋 — 한 걸음씩 걸어가며 하나씩 박는다 ── */
    let hit = -1;
    let inHit = 0;
    for (let i = 0; i < BLK_HITS; i += 1) {
      const start = BLK_BOX1_HIT_START[i] ?? 0;
      if (time >= start && time < start + BLK_HIT_MS) {
        hit = i;
        inHit = time - start;
        break;
      }
    }
    const box1Lift = inHit > 0 && inHit < 600 ? Math.sin((Math.PI * inHit) / 600) * BLK_LIFT : 0;
    const box1Bump =
      inHit >= 300 && inHit < 420 ? Math.sin((Math.PI * (inHit - 300)) / 120) * 3 : 0;

    for (let i = 0; i < BLK_HITS; i += 1) {
      const bx = (BLK_BOX1_STOP[i] ?? 0) + BLK_BOX_OFFSET - scroll;
      drawQuestionBox(p, bx, BLK_BOX_TOP - (hit === i ? box1Bump : 0));
    }

    /*
     * 캔들은 **현재 hit과 무관하게, 자기 시각이 지났으면 계속 자라 있는다** — 그래야
     * 다음 상자로 걸어가는 동안에도 방금 박은 캔들이 화면에 그대로 남는다. 자란
     * 뒤에도 상자와 같은 화면 좌표 공식을 쓰므로, 걸어서 멀어지면 배경처럼 함께
     * 화면 밖으로 흘러간다.
     */
    for (let i = 0; i < BLK_HITS; i += 1) {
      const growStart = (BLK_BOX1_HIT_START[i] ?? 0) + 420;
      if (time < growStart) continue;

      const grow = easeOut(clamp01((time - growStart) / 500));
      const len = (BOX1_CANDLE_LEN[i] ?? 0) * grow;
      if (len <= 0) continue;

      const bx = (BLK_BOX1_STOP[i] ?? 0) + BLK_BOX_OFFSET - scroll;
      const ccx = bx + BLK_BOX / 2;
      /* 가로 폭은 다른 캔들(6칸)의 1.5배(9칸) — 상자에서 막 튀어나온 캔들이라
       * 눈에 띄게 굵어야 한다. */
      const half = 4.5;

      if (BOX1_CANDLE_UP[i]) {
        p.rect(ccx - half, BLK_BOX_TOP - len, half * 2, len, "#ff5c5c");
        p.rect(ccx - 1.5, BLK_BOX_TOP - len, 3, len, "#ff8f8f");
      } else {
        p.rect(ccx - half, BLK_BOX_TOP + BLK_BOX, half * 2, len, "#5c9dff");
        p.rect(ccx - 1.5, BLK_BOX_TOP + BLK_BOX, 3, len, "#8fc4ff");
      }
    }

    let bubble: SceneBubble = { text: "", x: 0, y: 0, alpha: 0 };
    let labels: SceneLabel[] = [];
    let antLift = box1Lift;
    let antPose: AntPose =
      box1Lift > 0.5 ? "jump" : walking ? (flip2(time, 200) ? "wave1" : "wave2") : "stand";
    let antScale = BLK_SCALE;

    if (hit >= 0) {
      const bx = (BLK_BOX1_STOP[hit] ?? 0) + BLK_BOX_OFFSET - scroll;
      /*
       * 말은 **캔들이 자라기 시작한 뒤에** 뜬다(캔들 시작 420ms + 180ms 여유) —
       * 차트가 먼저 보이고 그다음 개미가 반응해야 무엇에 대한 말인지 읽힌다.
       */
      const bubbleStart = 600;
      bubble = {
        text: BLOCK_TRIPLE_SCRIPT[hit] ?? "",
        x: bx + BLK_BOX / 2,
        y: BLK_BOX_TOP - 10,
        alpha: clamp01(
          Math.min((inHit - bubbleStart) / 200, (BLK_HIT_MS - 150 - inHit) / 200),
        ),
      };
    }

    /* ── 2·3막: 괴물 둘 — 전쟁 → 금리, 걸어와서 한 방에 밟혀 죽는다 ── */
    const e1 = drawEnemyEncounter(
      p,
      frame,
      scroll,
      BLK_E1_WORLD_X,
      BLK_BOX1_END,
      BLK_E1_WALK_END,
      BLK_E1_STOMP_END,
      BLOCK_ENEMY_FLAG[0],
      BLOCK_STOMP_TAUNTS[0],
    );
    if (e1) {
      labels = e1.labels;
      if (e1.stomp) {
        antLift = e1.stomp.antLift;
        antPose = e1.stomp.antPose;
        bubble = e1.stomp.bubble;
      }
    }

    const e2 = drawEnemyEncounter(
      p,
      frame,
      scroll,
      BLK_E2_WORLD_X,
      BLK_E1_STOMP_END,
      BLK_E2_WALK_END,
      BLK_E2_STOMP_END,
      BLOCK_ENEMY_FLAG[1],
      BLOCK_STOMP_TAUNTS[1],
    );
    if (e2) {
      labels = e2.labels;
      if (e2.stomp) {
        antLift = e2.stomp.antLift;
        antPose = e2.stomp.antPose;
        bubble = e2.stomp.bubble;
      }
    }

    /* ── 4·5막: 상자2 — 한 번 박으면 지폐가 나와 걸어온다. **지폐를 다 먹으면
     * (`BLK_SEED_END`) 상자도 함께 치운다** — 안 그러면 레벨업 내내 다 쓴 상자가
     * 화면 오른쪽 위에 그대로 남아 있는 것으로 보인다. ── */
    if (time >= BLK_E2_STOMP_END && time < BLK_SEED_END) {
      const box2X = BLK_BOX2_WORLD_X - scroll;
      const inBox2Hit = time - BLK_BOX2_WALK_END;
      let box2Bump = 0;

      if (inBox2Hit >= 0 && inBox2Hit < BLK_BOX2_HIT_MS) {
        const box2Lift = inBox2Hit < 500 ? Math.sin((Math.PI * inBox2Hit) / 500) * BLK_LIFT : 0;
        box2Bump =
          inBox2Hit >= 250 && inBox2Hit < 370
            ? Math.sin((Math.PI * (inBox2Hit - 250)) / 120) * 3
            : 0;
        antLift = box2Lift;
        antPose = box2Lift > 0.5 ? "jump" : "stand";
        bubble = {
          text: pickMemeLine("block", seed, BLK_HITS),
          x: BLK_ANT_X + 8 * BLK_SCALE,
          y: BLK_ANT_TOP + 2 * BLK_SCALE - 2,
          alpha: clamp01(Math.min(inBox2Hit - 100, BLK_BOX2_HIT_MS - inBox2Hit) / FADE_MS),
        };
      }

      const boxFade = time > BLK_SEED_END - 150 ? clamp01((BLK_SEED_END - time) / 150) : 1;
      p.faded(boxFade, () => drawQuestionBox(p, box2X, BLK_BOX2_TOP - box2Bump));
      if (time < BLK_SEED_END) {
        drawSparkle(p, box2X + 3, BLK_BOX2_TOP - 4, 2);
        drawSparkle(p, box2X + BLK_BOX - 2, BLK_BOX2_TOP + BLK_BOX + 2, 2);
      }

      /* ── 5막: 지폐 — 상자에서 튀어나와 개미에게 걸어온다 ── */
      if (time >= BLK_BOX2_HIT_END) {
        const age = time - BLK_BOX2_HIT_END;
        const boxCx = box2X + BLK_BOX / 2;
        const boxCy = BLK_BOX2_TOP - 11;
        const antCx = BLK_ANT_X + 8 * BLK_SCALE;
        const antCy = BLK_ANT_TOP + 6 * BLK_SCALE;

        let billX = boxCx;
        let billY = boxCy;
        let billVisible = true;

        if (age < 300) {
          billY = boxCy - easeOut(age / 300) * 18;
        } else if (age < 800) {
          const t = easeInOut((age - 300) / 500);
          billX = lerp(boxCx, antCx, t);
          const arc = Math.sin(Math.PI * t) * 10;
          billY = lerp(boxCy - 18, antCy, t) - arc;
        } else {
          billVisible = false;
        }

        if (billVisible) {
          drawSeedBill(p, billX, billY);
        } else {
          const t = clamp01((age - 800) / 100);
          p.faded(1 - t, () => drawSparkle(p, antCx, antCy, 3));
        }

        /*
         * "시드 등장!"은 개미가 아니라 **지폐가 하는 말**이라, 꼬리가 지폐 위치를
         * 따라간다. 노출 시간은 **기존의 두 배**(약 520ms)로 늘려서 뜨자마자
         * 사라지지 않게 한다.
         */
        const bubbleSpan = 520;
        bubble = {
          text: "시드 등장!",
          x: billX,
          y: billY - 11,
          alpha: clamp01(Math.min(age - 40, bubbleSpan - age) / 100),
        };
      }
    }

    /* ── 6막: 레벨업 — 몸이 커지고 화면 가운데 LEVEL UP ── */
    if (time >= BLK_SEED_END && time < BLK_LEVEL_END) {
      const local = time - BLK_SEED_END;
      const growT = easeOut(clamp01(local / 500));
      antScale = lerp(BLK_SCALE, BLK_LEVEL_SCALE, growT);
      antPose = flip2(time, 150) ? "wave1" : "wave2";

      if (local < 900) {
        for (const [dx, dy] of [
          [-10, -6],
          [12, -10],
          [4, -18],
        ] as const) {
          p.faded(clamp01(1 - local / 900), () =>
            drawSparkle(p, BLK_ANT_X + 8 * antScale + dx, BLK_ANT_TOP + dy, 2),
          );
        }
      }

      const textAlpha =
        local < 150 ? local / 150 : local > BLK_LEVEL_MS - 250 ? (BLK_LEVEL_MS - local) / 250 : 1;
      labels = [
        {
          text: "LEVEL UP!",
          x: p.w / 2,
          y: 34,
          alpha: clamp01(textAlpha),
          unit: 6,
          bold: true,
          color: "#ffd24a",
          outline: "#3a2a06",
        },
      ];

      bubble = {
        text: pickMemeLine("blockLevel", seed, 0),
        x: BLK_ANT_X + 8 * antScale,
        y: BLK_ANT_TOP - (antScale - BLK_SCALE) * 16 + 2 * antScale - 2,
        alpha: clamp01(Math.min(local - 200, BLK_LEVEL_MS - 300 - local) / FADE_MS),
      };
    }

    /* ── 7·8막: 몇 걸음 더 걸어 바닥 상자를 밟고 뛰면 불기둥이 솟는다 ── */
    let antFeetY = BLK_GROUND - antLift;

    if (time >= BLK_LEVEL_END) {
      antScale = BLK_LEVEL_SCALE;

      const box3X = BLK_BOX3_WORLD_X - scroll;
      drawQuestionBox(p, box3X, BLK_GROUND - BLK_BOX);
      const box3Cx = box3X + BLK_BOX / 2;

      if (time >= BLK_WALK3_END && time < BLK_JUMP3_END) {
        const inJump = time - BLK_WALK3_END;
        const liftJ = inJump < 500 ? Math.sin((Math.PI * inJump) / 500) * BLK_LIFT : 0;
        antLift = liftJ;
        antPose = liftJ > 0.5 ? "jump" : "stand";

        if (inJump >= 420 && inJump < 620) {
          const burst = clamp01((inJump - 420) / 200);
          for (let i = 0; i < 6; i += 1) {
            const angle = (TAU * i) / 6;
            const distance = 3 + burst * 8;
            p.faded(clamp01(1 - burst), () =>
              p.dot(
                box3Cx + Math.cos(angle) * distance,
                BLK_GROUND - 4 + Math.sin(angle) * distance,
                "#fff3b0",
              ),
            );
          }
        }
      }

      if (time >= BLK_JUMP3_END) {
        const local = time - BLK_JUMP3_END;
        const grow = easeOut(clamp01(local / 250));
        const pillarTop = lerp(BLK_GROUND, BLK_PILLAR_TOP, grow);
        const pillarAlpha = local > BLK_CLIMB_MS - 200 ? clamp01((BLK_CLIMB_MS - local) / 200) : 1;

        p.faded(pillarAlpha, () => drawFirePillar(p, box3Cx, BLK_GROUND, pillarTop, time));

        const ct = clamp01(local / BLK_CLIMB_MS);
        antFeetY = lerp(BLK_GROUND, -90, ct * ct);
        antPose = flip2(time, 110) ? "crawl1" : "crawl2";

        /*
         * "날라간다!!" — 날아오르기 시작할 때만 뜬다. 화면 밖으로 완전히 빨려
         * 나가는 뒷부분(가속이 붙는 구간)까지 붙어 있으면 사라지는 순간과
         * 겹쳐 어수선해지므로, 초반에 떴다가 먼저 진다. 개미를 따라 자리도
         * 같이 오른다(`antFeetY` 그대로 씀) — 정지된 자리에 남으면 개미는
         * 이미 위로 갔는데 말만 남아 있는 것으로 보인다.
         */
        bubble = {
          text: "날라간다!!",
          x: BLK_ANT_X + 8 * antScale,
          y: antFeetY - 16 * antScale + 2 * antScale - 2,
          alpha: clamp01(Math.min(local - 60, 900 - local) / 150),
        };

        const streakRandom = seededRandom(seed + 91);
        for (let i = 0; i < 6; i += 1) {
          const dx = (streakRandom() - 0.5) * 14;
          const dy = 6 + streakRandom() * 18;
          const y = antFeetY - 8 * antScale + dy;
          if (y > p.h) continue;
          p.faded(clamp01(1 - dy / 26) * pillarAlpha, () =>
            p.rect(BLK_ANT_X + 8 * antScale + dx, y, 1, 5, "#ffffff"),
          );
        }
      }
    }

    /* ── 개미 — 늘 화면의 같은 가로 자리, 세로와 크기만 막마다 달라진다 ── */
    const antTop = antFeetY - 16 * antScale;
    p.sprite(antPixels(BLK_STAGE, antPose), BLK_ANT_X, antTop, antScale);

    return { ...bubble, labels };
  },
};

/** 마리오식 벽돌 한 장 (16×16). 줄눈이 어긋나야 벽돌로 읽힌다. */
function drawMarioBrick(p: Painter, x: number, y: number) {
  p.rect(x, y, BLK_BOX, BLK_BOX, "#c86432");
  p.rect(x, y, BLK_BOX, 1, "#e59a63");
  p.rect(x, y + BLK_BOX - 1, BLK_BOX, 1, "#8a4418");
  /* 가로 줄눈 하나, 세로 줄눈은 위아래가 어긋난다 */
  p.rect(x, y + 7, BLK_BOX, 2, "#7a3a12");
  p.rect(x + 7, y + 1, 2, 6, "#7a3a12");
  p.rect(x, y + 9, 2, 7, "#7a3a12");
  p.rect(x + 14, y + 9, 2, 7, "#7a3a12");
}

/** 물음표 글자 (5×7) — 상자 한가운데 박힌다 */
const QUESTION_MARK: readonly string[] = [
  ".sss.",
  "s...s",
  "....s",
  "...s.",
  "..s..",
  ".....",
  "..s..",
];

function drawQuestionBox(p: Painter, x: number, y: number) {
  p.rect(x, y, BLK_BOX, BLK_BOX, "#6b3a08");
  p.rect(x + 1, y + 1, 14, 14, "#e8a33c");
  p.rect(x + 1, y + 1, 14, 2, "#f5c46a");
  p.rect(x + 1, y + 12, 14, 3, "#c9801f");
  /* 모서리 리벳 — 마리오 상자의 표식이다 */
  for (const [dx, dy] of [
    [2, 2],
    [12, 2],
    [2, 12],
    [12, 12],
  ] as const) {
    p.rect(x + dx, y + dy, 2, 2, "#6b3a08");
  }

  QUESTION_MARK.forEach((row, dy) => {
    [...row].forEach((char, dx) => {
      if (char === "s") p.rect(x + 5 + dx, y + 4 + dy, 1, 1, "#fff3d0");
    });
  });
}

/** 토관 — 입구가 몸통보다 넓어야 토관이다 */
function drawMarioPipe(p: Painter, x: number, groundY: number, height: number) {
  const top = groundY - height;
  p.rect(x + 2, top + 8, 20, height - 8, "#3ca03c");
  p.rect(x + 4, top + 8, 4, height - 8, "#7ad07a");
  p.rect(x + 18, top + 8, 3, height - 8, "#1f6b1f");
  p.rect(x, top, 24, 9, "#3ca03c");
  p.rect(x + 2, top + 1, 4, 7, "#7ad07a");
  p.rect(x + 20, top + 1, 3, 7, "#1f6b1f");
  p.rect(x, top, 24, 1, "#1f6b1f");
  p.rect(x, top + 8, 24, 1, "#1f6b1f");
}

/**
 * 언덕 대신 세운 미니 캔들 스카이라인 — 이 판 전체가 "차트 위의 마리오"라는 농담이라
 * 배경의 초록 언덕도 예외가 아니다. 양봉·음봉을 섞어 세워 저 뒤로 보이는 작은 차트로
 * 읽히게 한다 (높이는 고정 배열이라 다시 뽑아도 지형이 안 바뀐다 — 다른 배경 소품과
 * 같은 대우다).
 */
const CANDLE_HILL_HEIGHTS: readonly number[] = [6, 11, 5, 13, 7, 9];

function drawCandleHill(p: Painter, cx: number, groundY: number, size: number) {
  const bars = 6;
  const barW = Math.max(1, Math.floor((size * 2) / bars) - 1);
  const startX = cx - size;

  for (let i = 0; i < bars; i += 1) {
    const h = CANDLE_HILL_HEIGHTS[i % CANDLE_HILL_HEIGHTS.length] ?? 6;
    const x = startX + i * (barW + 1);
    const up = i % 2 === 0;

    p.rect(x, groundY - h, barW, h, up ? "#ff5c5c" : "#5c9dff");
    p.rect(x, groundY - h, barW, 1, up ? "#ff8f8f" : "#8fc4ff");
  }
}

/**
 * 전쟁·금리 괴물 — **꼬리 없는 말풍선 모양 몸에 눈 둘만 붙었다.** 깃발을 따로 안 들고
 * 깃발 글자를 몸통 안에 그대로 앉힌다 (`SceneLabel`을 몸 가운데에 겹쳐 얹는다) — 몹
 * 자체가 살아 움직이는 팻말인 셈이다. 입도 팔다리도 없다: 다가오는 말풍선 두 개라는
 * 그림 하나로 충분하다. 밟히면(`squish === 1`) 낮고 넓게 찌부러지고 눈이 사라진다 —
 * 중간 단계 없이 즉시 바뀌어야 "한 방"으로 읽힌다.
 */
function drawFlagMonster(p: Painter, cx: number, groundY: number, squish: number, alpha: number) {
  if (alpha <= 0) return;

  const { w, h } = flagMonsterSize(squish);
  const top = groundY - h;
  const x = Math.round(cx - w / 2);
  const squished = squish >= 1;

  p.faded(alpha, () => {
    p.rect(x, top, w, h, "#fdfaf3");
    p.rect(x, top, w, 2, "#ffffff");
    p.rect(x, top + h - 2, w, 2, "#d8cfb8");
    p.rect(x, top, 2, h, "#efe8d6");
    p.rect(x + w - 2, top, 2, h, "#c9bfa4");
    /* 모서리를 한 칸씩 깎아 각진 사각형을 말풍선처럼 둥글려 보이게 한다 */
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [w - 1, 0],
      [w - 2, 0],
      [w - 1, 1],
      [0, h - 1],
      [1, h - 1],
      [0, h - 2],
      [w - 1, h - 1],
      [w - 2, h - 1],
      [w - 1, h - 2],
    ] as const) {
      p.dot(x + dx, top + dy, "#a89ce8");
    }

    if (!squished) {
      for (const ex of [x + 5, x + w - 10]) {
        p.rect(ex, top - 5, 5, 5, "#2b2f38");
        p.rect(ex + 1, top - 4, 3, 3, "#ffffff");
        p.dot(ex + 2, top - 3, "#1a1006");
      }
    }
  });
}

/**
 * 시드머니 — 코인이 아니라 **지폐**다. 물타기 판의 작은 지폐(`drawBill`, 8×5)보다
 * 세 배 크다 — 이 판의 주인공이라 작으면 존재감이 없다.
 */
function drawSeedBill(p: Painter, cx: number, cy: number) {
  const w = 27;
  const h = 16;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);

  p.rect(x, y, w, h, "#6fc38a");
  p.rect(x, y, w, 2, "#a8e0b4");
  p.rect(x, y + h - 2, w, 2, "#2f7f52");
  p.rect(x, y, 2, h, "#a8e0b4");
  p.rect(x + w - 2, y, 2, h, "#2f7f52");
  p.disc(cx, cy, 5, "#3f9468");
  p.disc(cx, cy, 3, "#d8f5e2");
  p.rect(x + 4, y + 3, 3, 1, "#2f7f52");
  p.rect(x + w - 7, y + h - 4, 3, 1, "#2f7f52");
}

/**
 * 불기둥 — 주식판 은어(장대양봉이 수직으로 솟는 것)를 그대로 세운 기둥이다. **몸통은
 * 다른 봉과 똑같이 곧게** 그린다(굴곡 없는 사각 막대 + 가운데 하이라이트 줄) — 이
 * 앱의 모든 봉이 이 모양이라 흔들리는 몸통을 쓰면 이 기둥만 딴 재질처럼 보인다.
 * **가로 폭은 다른 봉의 두 배**다 — 상자를 뚫고 솟아오르는 결정적인 한 방이라 다른
 * 캔들보다 굵어야 한다. 불꽃은 몸통을 일그러뜨리지 않고 **옆에서 널름거리는 조각**으로만
 * 더한다. 개미가 옆에 붙어 오르는 동안 계속 위에 있어야 하므로 **화면 밖(음수 y)까지
 * 그린다** — 짧게 끊으면 오르는 도중에 꼭대기가 먼저 사라져 보인다.
 */
function drawFirePillar(p: Painter, cx: number, groundY: number, topY: number, time: number) {
  const half = 8;
  const top = Math.floor(topY);

  p.rect(cx - half, top, half * 2, groundY - top, "#ff5c5c");
  p.rect(cx - 2, top, 4, groundY - top, "#ff8f8f");

  const span = Math.max(1, groundY - topY);
  for (let i = 0; i < 14; i += 1) {
    const py = groundY - ((time * 0.09 + i * 23) % span);
    const side = i % 2 === 0 ? -1 : 1;
    const reach = 3 + Math.abs(Math.sin(time * 0.012 + i * 1.7)) * 3;
    p.rect(cx + side * half, py, side * reach, 2, i % 3 === 0 ? "#ffd24a" : "#ff8f3c");
  }
}

/* ════════════════════════════════════════════════════
   15. 남극 탐험 — 양봉인 줄 알았지
   ════════════════════════════════════════════════════ */

/**
 * 도트 펭귄이 남극을 달리던 그 화면이다. **개미는 등을 보이고, 움직이는 건 세계다** —
 * 앞으로 나아가는 건 눈밭이 다가오는 것으로 그리고, 개미가 하는 일은 좌우로 방향을
 * 트는 것뿐이다. 화면에서 개미의 자리는 x만 조종되고 y는 못박혀 있다.
 *
 * 눈밭에는 **차트가 원근으로 깔려 있다.** 값이 곧 깊이라, 봉 하나는 카메라에서 멀어지는
 * 쪽으로 누운 판때기다 — 몸통은 두툼하고 꼬리는 가늘게 더 멀리 뻗는다. 개미는 그중
 * 빨간 양봉을 골라 달려간다 (양식이라고 생각한다).
 *
 * **다 와서 뒤집힌다.** 몸통이 꼭대기부터 빠지며 윗꼬리만 남고, 그 자리에서 파란 음봉이
 * 개미 발밑까지 쭉 뻗는다. 뻗어온 음봉이 얼음을 깨고 아래로 내려앉으면 개미는 깨진
 * 틈에 빠져 버둥거리다 기어 올라오고, 또 다른 양봉을 찾아 달린다.
 *
 * 이걸 **세 번** 반복한 게 한 바퀴다 (`POL_CYCLE` × 3). 세 판이 기계적으로 똑같아서
 * 이음매가 저절로 맞는다 — 한 판이 끝나면 세계는 정확히 `POL_SPAN`만큼 흘러 있고
 * 개미는 얼음 위를 달리는 중이다. 다른 건 **어느 쪽 양봉으로 트느냐**(`POL_TARGETS`)와
 * 말풍선뿐이라, 같은 일을 세 번 당하는 게 그대로 보인다.
 */

const POLAR_LOOP = 14400;
/** 한 판 — 찾고 · 뒤집히고 · 빠지고 · 올라와 다시 달린다 */
const POL_CYCLE = 4800;
/** 몸통이 꼭대기부터 빠지기 시작한다 (꼬리만 남는다) */
const POL_FLIP = 2200;
/** 붉은 몸통이 다 빠지고, 그 자리에서 파란 몸통이 개미 쪽으로 뻗는다 */
const POL_TURN = 2500;
/** 뻗어온 음봉이 발밑에 닿아 얼음이 깨진다 — 세계도 여기서 멈춘다 */
const POL_CRACK = 2800;
/** 다 내려앉는다 */
const POL_SETTLE = 3300;
/** 기어오르기 시작 */
const POL_RISE = 4000;
/** 다 올라와 다시 달린다 */
const POL_OUT = 4400;

/**
 * 카메라. **깊이 하나로 크기와 좌우가 같이 정해진다** — 줄(y)마다 배율을 다시 재서
 * 눕힌 것을 그리므로, 봉이든 눈밭 결이든 원근이 어긋날 자리가 없다.
 *
 * 바닥(z=0)을 화면 아래(192) 밖에 둔 건 제일 가까운 것이 화면 끝까지 커지게 하려는 것이다 —
 * 화면 안에 두면 다가오던 봉이 화면 안에서 멈춰 서서 사라진다.
 */
const POL_HZ = 66;
const POL_FLOOR = 200;
const POL_K = 0.06;
const POL_MID = 54;
/** 눈밭 폭 (세계 단위). 이 밖은 얼음 둔덕이라 개미도 봉도 안 나간다. */
const POL_ROAD = 78;
/** 눈밭 가장자리에 쌓인 둔덕 띠의 폭 (세계 단위) */
const POL_RIDGE = 20;
/** 한 판에 흐르는 거리. 눈밭 결 간격(`POL_STEP`)으로 나눠떨어져야 이음매가 맞는다. */
const POL_SPAN = 64;
/** 달리는 동안에만 흐른다 — 구멍에 빠져 있는 동안은 세계가 선다 */
const POL_SPEED = POL_SPAN / (POL_CRACK + (POL_CYCLE - POL_OUT));
const POL_STEP = 4;

const POL_ANT_Z = 5;
const POL_ANT_SCALE = 2;
/** 흰 눈밭 앞이라 붉은 단계로 둔다 — 창백한 쪽은 눈에 통째로 묻힌다 */
const POL_STAGE = 44;
/** 개미가 빠지는 깊이 (화면 도트). 머리와 가슴만 물 위에 남는 만큼이다. */
const POL_SINK = 10;

/** 봉 몸통 폭 · 꼬리 폭 (세계 단위) */
const POL_BODY_W = 13;
const POL_WICK_W = 2;
/** 양봉 몸통 길이 = 시가에서 고가까지 */
const POL_BODY = 16;
/** 뒤집힌 음봉이 개미 쪽으로 뻗는 길이 — 개미(z=5)를 넘어야 발밑이 깨진다 */
const POL_DIVE = 14;
/** 판이 시작될 때 시가가 서 있는 깊이 — `POL_CRACK`에 개미 코앞(11)에 닿는다 */
const POL_SPAWN = 11 + POL_CRACK * POL_SPEED;
/** 이 너머는 안개다. 멀리서 새로 그려지기 시작하는 것들이 여기서 조용히 배어 나온다. */
const POL_HAZE = 200;

/**
 * 마지막 판에서 "지금이니!"가 뜨는 시점. **세 번째만 늦게 뜬다** — 앞의 두 번은 양봉을
 * 발견하자마자 떠들지만(찾았다 · 이번엔 진짜다), 세 번째 개미는 붉은 봉에 올라서기
 * 직전까지 말이 없다가 발을 딛는 순간에야 입을 연다. 그래야 뒤집히는 순간과 말이
 * 겹쳐 세 번째 배신이 제일 가깝게 온다 — 일찍 띄우면 앞의 두 판과 박자가 같아져,
 * 같은 일을 세 번 당하는 대본에서 마지막만 세지는 게 사라진다.
 */
const POL_LAST_CALL = 1900;

/**
 * 빠져 있는 동안 배경에 깔리는 **우는 얼굴**. 클로즈업 판이 쓰는 그 얼굴 맵을 그대로
 * 가져다 화면만큼 키우고 옅게 깐다 — 얼굴을 여기서 새로 그리면 같은 개미가 두 벌이 된다.
 *
 * 처음엔 이 자리에 **하늘 자막**(고독하다 …)을 띄웠는데, 글자는 상황을 설명할 뿐이라
 * 이미 발밑에서 벌어지는 일을 한 번 더 말하는 셈이었다. 얼굴은 설명하지 않고 **표정만
 * 남긴다** — 개미는 물에 빠져 허우적대는 중이라 표정이 안 보이는데, 그 표정을 배경이 대신 짓는다.
 *
 * **옅게 깔고, 개미보다 뒤에 그린다.** 진하게 깔면 눈밭 위에 포스터를 붙인 그림이 되고,
 * 개미 앞에 그리면 정작 지금 벌어지는 일이 얼굴 뒤로 숨는다. 봉·구멍·개미는 전부 이 위에 온다.
 */
const POL_WEEP_STAGE = 20;
/**
 * **하늘 안에 들어가는 크기라야 한다.** 두 배로 키웠더니 얼굴이 화면을 세로로 다 덮어,
 * 눈밭이며 봉이며 전부 얼굴 안에서 벌어지는 그림이 됐다 — 배경에 비치는 표정이 아니라
 * 화면에 씌운 천이다. 한 배로 두면 머리(맵 16~64줄)가 지평선 위 하늘에 딱 들어간다.
 */
const POL_WEEP_SCALE = 1;
const POL_WEEP_LEFT = Math.round((108 - ANT_FACE_W * POL_WEEP_SCALE) / 2);
const POL_WEEP_TOP = 1;
/**
 * 얼굴 맵에서 **머리까지만** 쓴다 (빈 지갑 판과 같은 자리에서 자른다). 몸까지 깔면 목
 * 아래 가슴이 눈밭 한가운데를 통째로 덮는다 — 여기서 보여줄 것은 표정뿐이다.
 */
const POL_WEEP_ROWS = 64;

/** 하늘에 비치는 얼굴 — 머리까지만 잘라 한 번만 만들어 둔다 (1초에 60번 거르는 자리다) */
const POL_WEEP_FACE = antFacePixels(POL_WEEP_STAGE).filter(
  (pixel) => pixel.y <= POL_WEEP_ROWS,
);

/**
 * 반투명 정도. **얼굴이 통째로 깔리므로 진하다** — 윤곽선만 남겨보기도 했는데, 배경은
 * 안 죽어도 도면처럼 보였다. 대신 **산보다 뒤에 그려** 아래쪽을 산이 가려주므로 진해도
 * 하늘이 막히지 않는다.
 */
const POL_WEEP_ALPHA = 0.7;

/**
 * 빠지는 순간 개미 옆에 뜨는 하락률. **판마다 깊어진다** — 세 번을 당하는 판이라
 * 같은 숫자를 세 번 띄우면 세 번째가 제일 아픈 게 안 보인다.
 *
 * **이 숫자는 대본이지 계산값이 아니다.** 짤 공장은 연봉도 평단도 시세도 안 읽으므로
 * (위 "짤 공장") 여기 %는 유저의 수익률이 아니라 못박아둔 글자다 — 손익에서 온 숫자를
 * 그리기 시작하면 그 순간 "영상으로 내보내기"가 금액을 내보내는 버튼이 된다.
 *
 * 파란 글씨에 **흰 외곽선**을 두르는 건 배경이 파란 물이기 때문이다 (물 위의 개미에
 * 테두리를 두르는 것과 같은 이유). 색을 못 고르는 자리라 글자 쪽에서 떼어낸다.
 */
const POL_DROPS: readonly string[] = ["-10%", "-20%", "-30%"];
const POL_DROP_UNIT = 9;
/** 얼음이 깨진 뒤 이만큼 지나 뜬다 — 물보라와 겹치면 둘 다 안 읽힌다 */
const POL_DROP_IN = 200;

/** 세 판이 노리는 양봉의 좌우 자리 — 번갈아 틀어야 개미가 지그재그로 달린다 */
const POL_TARGETS = [-26, 30, -18] as const;

/**
 * 눈밭 양옆에 깔린 차트. **개미 길(|x| ≤ 30)에서 멀찍이 비켜 세운다** — 처음엔 ±50께에
 * 뒀는데, 가까워질수록 옆으로 벌어지는 게 아니라 개미 발밑으로 들어와 개미가 장식 봉
 * 위에 올라선 것처럼 보였다. 멀리 둘수록 다가오며 화면 밖으로 일찍 빠진다.
 */
const POL_DECOR: readonly (readonly [number, number, boolean, number])[] = [
  [6, -64, true, 12],
  [22, 70, false, 10],
  [38, -76, false, 14],
  [50, 62, true, 9],
];

function polarScale(z: number): number {
  return 1 / (1 + Math.max(0, z) * POL_K);
}

function polarY(z: number): number {
  return POL_HZ + (POL_FLOOR - POL_HZ) * polarScale(z);
}

/** 화면 줄이 곧 깊이다 — 눕혀 그리는 것은 z가 아니라 이 비율로 폭을 잡는다 */
function polarRowScale(y: number): number {
  return (y - POL_HZ) / (POL_FLOOR - POL_HZ);
}

const POL_ICE_Y = Math.round(polarY(POL_ANT_Z));
const POL_ANT_TOP = POL_ICE_Y - 16 * POL_ANT_SCALE;

/** 지금까지 흐른 거리. **구멍에 빠져 있는 동안은 안 는다** — 개미가 못 달리니 세계도 선다. */
function polarRun(local: number): number {
  if (local <= POL_CRACK) return local * POL_SPEED;
  if (local <= POL_OUT) return POL_CRACK * POL_SPEED;

  return (POL_CRACK + (local - POL_OUT)) * POL_SPEED;
}

/** 멀리 있을수록 옅다. 새 봉이 지평선께에서 **툭 생기지 않게** 하는 것도 이 흐림이다. */
function polarHaze(z: number): number {
  return clamp01((POL_HAZE - z) / 70);
}

/**
 * 눕힌 판때기 하나. 줄마다 배율을 다시 재서 사다리꼴로 좁아진다 — 봉도 꼬리도 구멍도
 * 전부 이걸로 그린다.
 *
 * `drop`은 **개미 깊이에서의 도트 수**다. 줄마다 그 자리 배율로 환산해 내리므로,
 * 내려앉은 얼음이 가까운 쪽일수록 더 깊이 꺼진 것처럼 보인다 — 화면 도트로 똑같이
 * 내리면 원근을 무시한 판때기가 통째로 미끄러진 그림이 된다.
 */
function polarBand(
  p: Painter,
  worldX: number,
  halfW: number,
  zFar: number,
  zNear: number,
  color: string,
  drop = 0,
): void {
  const near = Math.max(zNear, 0.1);
  if (zFar <= near) return;

  const top = Math.round(polarY(zFar));
  const bottom = Math.round(polarY(near));
  const reference = polarScale(POL_ANT_Z);
  /** 그 줄이 내려앉는 깊이 — 가까운 줄일수록 더 깊이 꺼진다 */
  const shift = (row: number) => (drop * polarRowScale(row)) / reference;

  for (let y = top; y <= bottom; y += 1) {
    const s = polarRowScale(y);
    if (s <= 0) continue;

    /*
     * **줄 높이는 1이 아니라 "다음 줄까지"다.** 내려앉는 깊이가 줄마다 달라 판때기가
     * 세로로 늘어나는데, 높이를 1로 두면 늘어난 만큼 열 줄에 한 번씩 빈 줄이 생긴다 —
     * 그 틈으로 밑에 깔린 물과 꼬리가 비쳐 **가라앉은 얼음을 가로지르는 줄무늬**가 됐다
     * (물에 빠진 개미 아래로 지나가던 그 선이다). 안 내려앉는 판때기는 높이가 그대로 1이다.
     */
    const from = y + shift(y);
    const half = halfW * s;
    p.rect(POL_MID + worldX * s - half, from, half * 2, Math.max(1, y + 1 + shift(y + 1) - from), color);
  }
}

/**
 * 봉 하나. **꼬리는 몸통과 따로 내려간다** — 얼음이 깨져도 꼬리는 안 깨진 눈밭에 그대로
 * 남아 있어야 "꼬리를 남기며 뒤집혔다"가 화면에 남는다.
 */
function drawPolarCandle(
  p: Painter,
  worldX: number,
  zBodyNear: number,
  zBodyFar: number,
  zWickNear: number,
  zWickFar: number,
  up: boolean,
  drop = 0,
  turn = 0,
): void {
  const shell = up ? "#ff5c5c" : "#5c9dff";
  const core = up ? "#ffb3b3" : "#a8ccff";

  /*
   * 꼬리는 **몸통이 뻗는 만큼 물든다.** 몸통이 파래지는 순간 꼬리까지 한 프레임에 같이
   * 갈아끼우면 화면이 한 번 깜빡인 것처럼 보인다 — 뒤집히는 데 걸리는 시간을 꼬리도 같이 쓴다.
   *
   * **뒤집히는 중이 아니면 꼬리는 그냥 몸통 색이다.** 처음엔 `turn`을 늘 보간에 넣었는데,
   * 그러면 `turn`을 안 넘긴 자리(장식 봉·깨진 자리)가 전부 보간의 시작점인 **빨강**을
   * 집어서, 파란 음봉에 빨간 꼬리가 달렸다 — 물에 빠진 개미 밑으로 빨간 줄이 지나갔다.
   */
  polarBand(
    p,
    worldX,
    POL_WICK_W,
    zWickFar,
    zWickNear,
    turn > 0 ? mixColor("#ff5c5c", "#5c9dff", turn) : shell,
  );
  polarBand(p, worldX, POL_BODY_W, zBodyFar, zBodyNear, shell, drop);
  polarBand(p, worldX, POL_BODY_W * 0.45, zBodyFar - 1, zBodyNear + 1, core, drop);
}

/**
 * 깨진 자리. 원래 봉이 있던 자국에 검푸른 물을 깔고 **그 위에 음봉을 내려앉힌다** —
 * 몸통이 내려간 만큼 위쪽에 물이 드러나는 게 "빙하가 깨졌다"의 전부다.
 * 가장자리에 떠 있는 흰 조각이 그 판을 얼음으로 못박는다.
 */
function drawPolarCrack(
  p: Painter,
  worldX: number,
  zNear: number,
  zFar: number,
  sink: number,
  seed: number,
): void {
  polarBand(p, worldX, POL_BODY_W + 2, zFar, zNear, "#123073");
  polarBand(p, worldX, POL_BODY_W + 1, zFar - 0.5, zNear, "#1b48b0");

  drawPolarCandle(p, worldX, zNear, zFar, zNear, zFar, false, sink);

  /* 깨져 떠 있는 얼음 조각 — 가장자리에 걸쳐야 "테두리가 부서졌다"로 읽힌다 */
  const random = seededRandom(seed + 71);
  for (let i = 0; i < 3; i += 1) {
    const z = lerp(zNear, zFar, (i + 0.5) / 3);
    if (z <= 0.4) continue;

    const s = polarScale(z);
    const side = i % 2 === 0 ? -1 : 1;
    const x = POL_MID + worldX * s + side * (POL_BODY_W - 1) * s;
    const y = polarY(z) + (sink * s * random()) / polarScale(POL_ANT_Z);
    const w = Math.max(2, Math.round(5 * s));

    p.rect(x - w / 2, y, w, Math.max(1, Math.round(2 * s)), "#eef6ff");
    p.rect(x - w / 2, y + Math.max(1, Math.round(2 * s)), w, 1, "#a8c4dc");
  }
}

/** 눈밭에 뻗은 금 — 구멍 양옆으로 갈라진다. 깨진 순간에 확 뻗고 그대로 남는다. */
function drawPolarSplits(p: Painter, worldX: number, z: number, grow: number, seed: number): void {
  if (z <= 0.4) return;

  const random = seededRandom(seed + 97);
  const s = polarScale(z);
  const cx = POL_MID + worldX * s;
  const cy = polarY(z);

  for (let i = 0; i < 4; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const reach = (10 + random() * 14) * s * grow;
    const lean = (random() - 0.5) * 10 * s;
    const from = cx + side * POL_BODY_W * s;
    const mid = from + side * reach * 0.5;

    p.line(from, cy, mid, cy + lean * 0.5, "#9db0c3");
    p.line(mid, cy + lean * 0.5, from + side * reach, cy + lean, "#9db0c3");
  }
}

/** 눈 덮인 산줄기 — 꼭대기 두 줄만 파랗게 둬야 만년설로 읽힌다 */
function drawPolarRange(p: Painter, seed: number): void {
  const random = seededRandom(seed + 31);

  for (let i = 0; i < 9; i += 1) {
    const cx = -8 + i * 14 + Math.floor(random() * 7);
    const height = 11 + Math.floor(random() * 11);

    for (let k = 0; k < height; k += 1) {
      const y = POL_HZ - height + k;
      const half = Math.round((k + 1) * 0.8);

      p.rect(cx - half, y, half * 2 + 1, 1, k < 2 ? "#7ba7d8" : "#eef6ff");
      if (k >= 2) p.rect(cx + 1, y, half, 1, "#b8cede");
    }
  }
}

const polar: MemeScene = {
  id: "polar",
  title: "남극 탐험",
  blurb: "양봉인 줄 알고 달려가면 발밑이 깨진다. 세 번.",
  loopMs: POLAR_LOOP,
  /** 세 번 중 첫 번째로 빠진 자리 — 다 내려앉고 말풍선이 다 떠 있는 순간이다 */
  stillMs: 3400,

  draw(p, frame) {
    const cycle = Math.min(2, Math.floor(frame.time / POL_CYCLE));
    const local = frame.time - cycle * POL_CYCLE;
    const run = polarRun(local);
    const osc = oscillator(frame.time / POLAR_LOOP);

    /* ── 하늘 ── */
    p.vGradient(0, POL_HZ, "#2ab8ea", "#b6e9fb");
    for (const [x, y, size] of [
      [20, 22, 4],
      [66, 13, 3],
      [92, 30, 3],
    ] as const) {
      drawCloud(p, x + Math.round(osc(1, x / 100) * 2), y, size);
    }

    /*
     * ── 우는 얼굴. 빠져 있는 동안만 **하늘에** 비친다. 흐느끼듯 한 칸 들썩이는
     * 것도 클로즈업 판과 같다.
     *
     * **하늘 밖으로 나가면 안 된다** (앱의 날씨와 같은 규칙 — 땅에 비가 내리면 이상하다).
     * 눈밭까지 걸치면 배경에 비친 표정이 아니라 화면 위에 얹은 그림이 되고, 발밑에서
     * 벌어지는 일을 가린다. 맵이 하늘에 딱 맞지만 들썩임까지 감안해 한 번 더 잘라둔다.
     */
    const weep = clamp01(Math.min((local - POL_CRACK) / 320, (POL_OUT - local) / 400));
    if (weep > 0.01) {
      p.clipped(0, 0, p.w, POL_HZ, () =>
        p.faded(weep * POL_WEEP_ALPHA, () =>
          p.sprite(
            POL_WEEP_FACE,
            POL_WEEP_LEFT,
            POL_WEEP_TOP + (flip2(frame.time, 400) ? 0 : 1),
            POL_WEEP_SCALE,
          ),
        ),
      );
    }

    /* 산은 얼굴 **위에** 그린다 — 턱을 산이 가려야 저 멀리 떠 있는 얼굴로 보인다 */
    drawPolarRange(p, frame.seed);

    /* ── 눈밭. 먼 쪽은 푸르스름해야 깊이가 산다 ── */
    p.vGradient(POL_HZ, p.h, "#d6e7f5", "#ffffff");

    /*
     * 얼음 둔덕 — 눈밭 가장자리에 쌓인 띠다. **길이 좁아지는 걸 보여주는 게 이 회색의
     * 일이다**: 온통 흰 화면에서는 원근이 안 보여 달려도 제자리처럼 보인다.
     *
     * **띠 바깥까지 회색으로 덮지 말 것.** 처음엔 눈밭 밖을 통째로 칠했는데, 화면 절반이
     * 회색이 되어 남극 벌판이 아니라 산등성이 사이 골짜기로 보였다. 밖도 같은 눈밭이고,
     * 회색은 그 사이에 쌓인 둔덕일 뿐이다.
     */
    for (let y = POL_HZ; y < p.h; y += 1) {
      const s = polarRowScale(y);
      const half = POL_ROAD * s;
      const band = POL_RIDGE * s;
      const tone = y % 2 === 0 ? "#c6d4e2" : "#b3c4d6";

      p.rect(POL_MID - half - band, y, band, 1, tone);
      p.rect(POL_MID + half, y, band, 1, tone);
      p.rect(POL_MID - half - 1, y, 1, 1, "#93a7ba");
      p.rect(POL_MID + half, y, 1, 1, "#93a7ba");
    }

    /*
     * 눈밭 결과 둔덕 층 — **달리고 있다는 걸 말하는 건 이 줄들뿐이다.** 깊이 눈금
     * (`POL_STEP`)마다 하나씩 놓고 통째로 흘려보낸다. 간격이 한 판 거리의 약수라
     * 이음매에서 어긋나지 않는다.
     */
    const drift = run % POL_STEP;
    for (let k = 1; k * POL_STEP <= POL_SPAN + POL_STEP; k += 1) {
      const z = k * POL_STEP - drift;
      if (z <= 0.3) continue;

      const y = Math.round(polarY(z));
      const scale = polarScale(z);
      const half = POL_ROAD * scale;
      const band = POL_RIDGE * scale;
      const dash = Math.max(2, band * 0.6);

      for (let x = POL_MID - half; x < POL_MID + half; x += 7) {
        p.rect(x, y, 4, 1, "#e8f1fa");
      }
      p.rect(POL_MID - half - band * 0.85, y, dash, 1, "#9db0c3");
      p.rect(POL_MID + half + band * 0.25, y, dash, 1, "#9db0c3");

      /* 둔덕 바깥 벌판 — 여기도 흘러야 화면 양끝이 얼어붙은 것처럼 안 보인다 */
      for (let x = POL_MID - half - band - 8; x > -6; x -= 9) p.rect(x, y, 4, 1, "#e0ecf8");
      for (let x = POL_MID + half + band + 4; x < p.w; x += 9) p.rect(x, y, 4, 1, "#e0ecf8");
    }

    /* ── 양옆에 깔린 차트. 한 판 거리마다 되풀이되고, 먼 쪽은 안개에 배어 나온다 ── */
    for (const [z0, x, up, len] of POL_DECOR) {
      const base = (((z0 - run + 24) % POL_SPAN) + POL_SPAN) % POL_SPAN - 24;

      for (const repeat of [3, 2, 1, 0]) {
        const z = base + repeat * POL_SPAN;
        const alpha = polarHaze(z);
        if (alpha <= 0.02 || z + len <= 0.4) continue;

        p.faded(alpha, () => drawPolarCandle(p, x, z, z + len, z - 2, z + len + 6, up));
      }
    }

    /*
     * ── 개미가 노리는 봉. 지난 판(-1) · 이번 판(0) · 다음 판(+1, +2)을 함께 그린다 —
     * 다음 것이 미리 지평선께에 서 있어야 판이 바뀌는 자리에서 봉이 툭 생기지 않는다.
     */
    for (const offset of [2, 1, 0, -1]) {
      const worldX = POL_TARGETS[(((cycle + offset) % 3) + 3) % 3] ?? 0;
      const zOpen = POL_SPAWN - run + offset * POL_SPAN;
      const alpha = polarHaze(zOpen);
      if (alpha <= 0.02) continue;

      /* 지난 판은 이미 깨져 있고, 다음 판은 아직 멀쩡한 양봉이다 */
      const phase = offset === 0 ? local : offset < 0 ? POL_CYCLE : 0;
      const drain = clamp01((phase - POL_FLIP) / (POL_TURN - POL_FLIP));
      const dive = clamp01((phase - POL_TURN) / (POL_CRACK - POL_TURN));
      const fall = clamp01((phase - POL_CRACK) / (POL_SETTLE - POL_CRACK));
      const sink = fall * fall * POL_SINK;

      const zHigh = zOpen + POL_BODY;
      const zDeep = zOpen - POL_DIVE * dive;

      p.faded(alpha, () => {
        if (dive <= 0) {
          /* 아직 양봉 — 뒤집히는 동안 몸통이 꼭대기부터 빠지고 꼬리만 남는다 */
          drawPolarCandle(p, worldX, zOpen, zOpen + POL_BODY * (1 - drain), zOpen - 3, zHigh + 7, true);
          return;
        }

        if (fall <= 0) {
          /* 뒤집혔다 — 남은 꼬리를 그대로 두고 파란 몸통이 개미 쪽으로 뻗는다 */
          drawPolarCandle(p, worldX, zDeep, zOpen, zDeep - 2, zHigh + 7, false, 0, dive);
          return;
        }

        polarBand(p, worldX, POL_WICK_W, zHigh + 7, zOpen, "#5c9dff");
        drawPolarSplits(p, worldX, zOpen, easeOut(fall), frame.seed + cycle);
        drawPolarCrack(p, worldX, zDeep, zOpen, sink, frame.seed + cycle);
      });
    }

    /*
     * ── 개미. **자리는 화면에 못박혀 있고 좌우로만 튼다** — 다음 양봉이 있는 쪽으로
     * 붙었다가, 발밑이 깨지면 그 자리에서 가라앉는다.
     */
    const from = POL_TARGETS[((cycle + 2) % 3 + 3) % 3] ?? 0;
    const to = POL_TARGETS[cycle % 3] ?? 0;
    const antWorldX = lerp(from, to, easeInOut(clamp01(local / POL_FLIP)));
    const antX = POL_MID + antWorldX * polarScale(POL_ANT_Z);

    const fall = clamp01((local - POL_CRACK) / (POL_SETTLE - POL_CRACK));
    const climb = clamp01((local - POL_RISE) / (POL_OUT - POL_RISE));
    const sunk = (fall * fall - easeOut(climb)) * POL_SINK;
    const swimming = local >= POL_CRACK && local < POL_OUT;
    /* 걸음은 좌우 다리를 번갈아 펴는 것으로만 보인다 — 한 걸음에 한 도트씩 들썩인다 */
    const step = flip2(frame.time, 160);
    const pose: AntPose = swimming
      ? flip2(frame.time, 200)
        ? "backFlail1"
        : "backFlail2"
      : step
        ? "back1"
        : "back2";
    const antTop = POL_ANT_TOP + Math.max(0, sunk) + (swimming || step ? 0 : 1);

    if (!swimming) {
      p.faded(0.45, () => {
        p.rect(antX - 8, POL_ICE_Y - 3, 16, 2, "#7f97ad");
        p.rect(antX - 5, POL_ICE_Y - 1, 10, 1, "#7f97ad");
      });
    } else {
      /*
       * 물보라 — 빠져 있는 동안 개미 양옆에서 찰랑인다. **파란 물에 파란 물결을 그리면
       * 안 보인다**: 흰 거품이라야 몸이 물을 헤집고 있는 것으로 읽힌다.
       */
      const swell = Math.round(osc(48) * 2);
      p.rect(antX - 19 + swell, POL_ICE_Y - 4, 7, 1, "#eef6ff");
      p.rect(antX + 12 - swell, POL_ICE_Y - 7, 7, 1, "#eef6ff");
      p.rect(antX - 17 - swell, POL_ICE_Y - 10, 5, 1, "#c8e0ff");
    }

    /*
     * 물 위로 나온 만큼만 그린다. **자세를 반쯤만 보여주는 게 "빠졌다"의 전부다** —
     * 통째로 그리면 얼음 위에서 팔만 흔드는 그림이 된다.
     */
    p.clipped(0, 0, p.w, POL_ICE_Y, () => {
      const pixels = antPixels(POL_STAGE, pose);
      const left = antX - 8 * POL_ANT_SCALE;

      /*
       * 물에 빠진 동안에는 **테두리를 두른다.** 파란 물 위로 나온 갈색 몸이 물빛에 묻혀
       * 머리인지 떠다니는 얼음 조각인지 구분이 안 갔다. 눈밭 위에서는 배경이 희어
       * 필요 없다 — 두르면 오히려 개미가 검게 뭉친다.
       */
      if (swimming) outlined(p, pixels, left, antTop, POL_ANT_SCALE, "#0e2a63");
      else p.sprite(pixels, left, antTop, POL_ANT_SCALE);
    });

    /* 빠지는 순간 튀는 물 */
    if (local >= POL_CRACK && local < POL_CRACK + 420) {
      const age = local - POL_CRACK;
      for (let i = 0; i < 9; i += 1) {
        const angle = Math.PI + (i / 8) * Math.PI;
        const x = antX + Math.cos(angle) * 0.05 * age;
        const y = POL_ICE_Y - 4 + Math.sin(angle) * 0.05 * age + 0.00035 * age * age;
        p.rect(x, y, 2, 2, i % 2 === 0 ? "#ffffff" : "#a8ccff");
      }
    }

    /*
     * ── 말풍선. 한 판에 두 마디다 (찾음 → 속음). 세 판을 이어 대본 여섯 줄이 되고,
     * 마지막 반응은 글자가 아니라 모자이크다.
     */
    const spoken = local < POL_CRACK;
    const cut = cycle * 2 + (spoken ? 0 : 1);
    const opens = spoken ? (cycle === 2 ? POL_LAST_CALL : 300) : POL_CRACK + 150;
    const closes = spoken ? (cycle === 2 ? POL_CRACK : 2400) : POL_OUT - 100;

    return {
      text: POLAR_SCRIPT[cut] ?? "",
      x: antX,
      y: antTop + 3 * POL_ANT_SCALE - 2,
      alpha: clamp01(Math.min(local - opens, closes - local) / FADE_MS),
      labels: [
        {
          text: POL_DROPS[cycle] ?? "",
          /*
           * **개미의 화면 안쪽 옆에 세운다.** 개미는 판마다 좌우로 트므로 바깥쪽에 두면
           * 왼쪽 판에서는 화면 밖으로 잘린다 — 가운데를 향해 놓으면 어느 판에서도 들어온다.
           */
          x: antX + (antWorldX < 0 ? 22 : -22),
          /*
           * **말풍선 꼬리 아래로 내려 띄운다.** 머리 옆에 두면 꼬리 끝과 겹쳐 글자가
           * 말풍선 그림자에 묻힌다 — 말풍선은 머리 위, 하락률은 그 아래 개미 옆이다.
           * 개미와 같이 가라앉으므로(`antTop`) 따로 떠오르게 하지 않는다.
           */
          y: antTop + 9,
          alpha: clamp01(
            Math.min((local - POL_CRACK - POL_DROP_IN) / 240, (POL_RISE - local) / 300),
          ),
          unit: POL_DROP_UNIT,
          bold: true,
          color: "#2f6ed8",
          outline: "#ffffff",
        },
      ],
    };
  },
};

/* ════════════════════════════════════════════════════
   17. 계단과 엘리베이터 — 오를 땐 한 칸씩, 내려갈 땐 네 층
   ════════════════════════════════════════════════════ */

/**
 * "주가는 계단으로 오르고 엘리베이터로 내려온다." **격언이 그대로 그림이다** — 지어낼
 * 농담이 없어서, 이 판이 할 일은 오르는 속도와 내려가는 속도를 눈으로 재게 하는 것뿐이다.
 * 개미는 네 칸을 한 칸씩(4초) 뛰어올라 한 층을 얻고, 엘리베이터는 그 네 배를 1.8초에 내려간다.
 *
 * 무대는 **건물 단면**이다. 왼쪽은 계단, 오른쪽은 승강로. 단면이라 문이 닫혀도 칸 속이
 * 보이는데, 그래도 **문은 유리로 둔다** — 불투명하게 닫으면 제일 중요한 1.8초 동안
 * 개미가 화면에서 사라진다.
 *
 * **계단은 한 층 걸러 하나씩만 놓는다.** 층마다 놓았더니 계단 덩어리가 제 층계참을
 * 통째로 덮어, 다 올라간 개미가 다음 계단 속에 파묻혔다 — 층계참(계단이 없는 층)이
 * 있어야 개미가 서고 문이 열릴 자리가 생긴다. 그래서 승강기 문도 층계참에만 있다.
 *
 * **한 바퀴는 정확히 네 층 아래에서 끝난다.** 한 층 올라(계단) 네 층 내려가고(승강기)
 * 한 층 더 내려오면(마지막 계단) 계단 밑에 서는데, 그동안 세계도 정확히 네 층
 * (=`STR_NET`, 되풀이 주기의 두 배)만큼 흘러 있어 이음매가 저절로 맞는다. 층 이름을
 * 안 적는 것도 이 때문이다 — 같은 층이 무한히 되풀이되는 건물이라 번호를 붙이면 매
 * 바퀴 거짓말을 한다. 지하로 내려갔다는 건 말풍선이 맡는다.
 */

const STAIR_LOOP = 9600;
/** 한 층 높이 (세계 단위 = 화면 도트). 계단 네 칸이 정확히 한 층이다. */
const STR_FLOOR = 56;
const STR_STEPS = 4;
const STR_STEP_W = 17;
const STR_STEP_H = STR_FLOOR / STR_STEPS;
/** 계단이 시작되는 x. 여기서 승강로 벽까지가 정확히 네 칸이다. */
const STR_LEFT = 8;
/** 방과 승강로의 경계 */
const STR_WALL = 78;
const STR_SHAFT_W = 30;
const STR_SCALE = 2;
/** 밝은 베이지 벽 앞이라 붉은 단계로 둔다 — 창백한 쪽은 벽에 묻힌다 */
const STR_STAGE = 40;
/** 세계 y=0(출발 층 바닥)이 놓이는 화면 자리. 위가 음수다. */
const STR_EYE = 150;

/**
 * 칸 크기. **개미 몸통(가로 20)보다 넓어야 한다** — 좁게 잡으면 개미 다리가 칸 벽
 * 밖으로 삐져나와, 타고 내려가는 게 아니라 칸에 매달린 그림이 된다.
 */
const STR_CAR_W = 26;
const STR_CAR_H = 44;
const STR_CAR_X = STR_WALL + 3;
/**
 * 개미가 칸 안에 서는 x. **한가운데가 아니다** — 문짝 두 짝이 가운데서 만나므로,
 * 정가운데 세우면 닫힌 문의 이음매 선이 개미를 세로로 가른다.
 */
const STR_CAR_MID = STR_CAR_X + STR_CAR_W / 2 - 4;
/** 문 앞에 서는 자리 */
const STR_DOOR_X = 68;

/* ── 막 (ms) ── */
const STR_HOP_MS = 1000;
/** 네 칸을 다 오른다 — 올라간 한 층은 이 4초가 전부다 */
const STR_CLIMB = STR_STEPS * STR_HOP_MS;
/** 층계참을 걸어 문 앞에 선다 */
const STR_AT_DOOR = 4600;
const STR_OPENED = 4950;
/** 칸 안으로 다 들어간다 */
const STR_ABOARD = 5350;
/** 문이 다 닫히고 내려가기 시작한다 */
const STR_SHUT = 5600;
/** 다 내려온다 */
const STR_LANDED = 7400;
const STR_OPENED2 = 7700;
/** 개미가 칸에서 다 나온다 (여기가 아래층 계단 꼭대기다) */
const STR_ASHORE = 8100;
/** 마지막 한 층은 계단으로 내려간다 — 한 칸에 0.375초, 오를 때의 세 배 가까이 빠르다 */
const STR_DOWN_MS = (STAIR_LOOP - STR_ASHORE) / STR_STEPS;

/** 계단이 놓이는 층 간격 — 한 층 걸러 하나 (`STR_FLOOR`의 두 배) */
const STR_PERIOD = STR_FLOOR * 2;
/** 엘리베이터가 내려가는 거리 — 올라간 한 층의 네 배다 */
const STR_DROP = 4 * STR_FLOOR;
/** 한 바퀴에 세계가 흐르는 거리. 계단 주기의 배수라야 이음매가 맞는다. */
const STR_NET = STR_DROP;

/** 출발 층계참(= 계단 꼭대기)의 세계 y */
const STR_TOP = -STR_FLOOR;
/** 내려서는 층계참 */
const STR_EXIT = STR_TOP + STR_DROP;

/** 하강 진행도 (0~1). 칸도 카메라도 이 하나로 움직여 서로 어긋나지 않는다. */
function stairFall(time: number): number {
  if (time <= STR_SHUT) return 0;
  if (time >= STR_LANDED) return 1;

  return easeInOut((time - STR_SHUT) / (STR_LANDED - STR_SHUT));
}

/** 칸의 바닥 높이 (세계 y) */
function stairCarY(time: number): number {
  return lerp(STR_TOP, STR_EXIT, stairFall(time));
}

/**
 * 카메라. **하강 동안에만 움직인다.** 칸과 똑같은 거리를 내려가므로 내려가는 내내 칸은
 * 화면에 붙박여 있고 건물만 위로 쏟아진다 — 승강기 안에서 밖을 보는 그 그림이다.
 * 오르내리는 계단은 반대로 카메라를 세워두고 개미가 화면 위아래로 움직인다.
 */
function stairCameraY(time: number): number {
  return lerp(0, STR_NET, stairFall(time));
}

/** 문이 열린 정도 (0 닫힘 ~ 1 열림) */
function stairDoor(time: number): number {
  if (time < STR_AT_DOOR) return 0;
  if (time < STR_OPENED) return (time - STR_AT_DOOR) / (STR_OPENED - STR_AT_DOOR);
  if (time < STR_ABOARD) return 1;
  if (time < STR_SHUT) return 1 - (time - STR_ABOARD) / (STR_SHUT - STR_ABOARD);
  if (time < STR_LANDED) return 0;
  if (time < STR_OPENED2) return (time - STR_LANDED) / (STR_OPENED2 - STR_LANDED);
  if (time < STR_ASHORE) return 1;
  if (time < STR_ASHORE + 300) return 1 - (time - STR_ASHORE) / 300;

  return 0;
}

/** 계단 한 칸의 발판 높이 — 그 계단이 딛고 선 바닥(`floorY`)에서 잰다 */
function stairTreadY(floorY: number, index: number): number {
  return floorY - (index + 1) * STR_STEP_H;
}

function stairTreadX(index: number): number {
  return STR_LEFT + index * STR_STEP_W + STR_STEP_W / 2;
}

/** 이 바닥에 계단이 놓이는가 — 한 층 걸러 하나다 (나머지 층이 층계참이 된다) */
function stairHasFlight(floorY: number): boolean {
  return (((floorY % STR_PERIOD) + STR_PERIOD) % STR_PERIOD) === 0;
}

interface StairAnt {
  x: number;
  /** 발이 닿는 세계 y */
  y: number;
  pose: AntPose;
  flip: boolean;
}

/**
 * 개미가 어디서 무얼 하는지. **한 함수에 몰아둔다** — 자리와 자세가 따로 정해지면
 * 걷는 그림으로 계단을 오르거나 서 있는 그림으로 미끄러지는 컷이 반드시 생긴다.
 */
function stairAnt(time: number): StairAnt {
  const walk: AntPose = flip2(time, 200) ? "wave1" : "wave2";

  /* 네 칸을 한 칸씩 뛰어오른다 */
  if (time < STR_CLIMB) {
    const step = Math.floor(time / STR_HOP_MS);
    const u = (time - step * STR_HOP_MS) / STR_HOP_MS;
    const fromX = step === 0 ? STR_LEFT - 2 : stairTreadX(step - 1);
    const fromY = step === 0 ? 0 : stairTreadY(0, step - 1);
    /* 앞쪽 6할에 뛰어 올라서고 남은 4할은 숨을 고른다 — 쉬는 박자가 있어야 힘들어 보인다 */
    const hop = clamp01(u / 0.6);

    return {
      x: lerp(fromX, stairTreadX(step), easeInOut(hop)),
      y: lerp(fromY, stairTreadY(0, step), easeInOut(hop)) - Math.sin(Math.PI * hop) * 5,
      pose: hop > 0.05 && hop < 0.95 ? "jump" : "stand",
      flip: false,
    };
  }

  /* 층계참을 걸어 문 앞으로 */
  if (time < STR_AT_DOOR) {
    return {
      x: lerp(stairTreadX(STR_STEPS - 1), STR_DOOR_X, (time - STR_CLIMB) / (STR_AT_DOOR - STR_CLIMB)),
      y: STR_TOP,
      pose: walk,
      flip: false,
    };
  }

  /* 문이 열리기를 기다린다 */
  if (time < STR_OPENED) {
    return { x: STR_DOOR_X, y: STR_TOP, pose: "stand", flip: false };
  }

  /* 칸 안으로 */
  if (time < STR_ABOARD) {
    return {
      x: lerp(STR_DOOR_X, STR_CAR_MID, (time - STR_OPENED) / (STR_ABOARD - STR_OPENED)),
      y: STR_TOP,
      pose: walk,
      flip: false,
    };
  }

  /* 타고 내려간다 — 칸 바닥에 서 있으므로 발 높이가 곧 칸 높이다 */
  if (time < STR_OPENED2) {
    return { x: STR_CAR_MID, y: stairCarY(time), pose: "stand", flip: false };
  }

  /* 문 밖으로. 여기가 아래층 계단의 꼭대기 칸이다 */
  if (time < STR_ASHORE) {
    return {
      x: lerp(STR_CAR_MID, stairTreadX(STR_STEPS - 1), (time - STR_OPENED2) / (STR_ASHORE - STR_OPENED2)),
      y: STR_EXIT,
      pose: walk,
      flip: true,
    };
  }

  /*
   * 마지막 한 층은 걸어 내려간다 — 승강기가 내려준 자리가 계단 꼭대기라서 여기 말고는
   * 내려갈 길이 없다. **오를 때보다 성큼성큼 간다**: 같은 네 칸을 1.5초에 짚는다.
   */
  const base = STR_EXIT + STR_FLOOR;

  /*
   * **마지막 한 박자는 계단 밑에서 앞을 보고 선다.** 걸어 내려온 자세 그대로 한 바퀴가
   * 끝나면, 왼쪽을 보던 개미가 다음 프레임에 오른쪽을 보며 뛰어올라 이음매에서 홱 돈다.
   */
  if (time > STAIR_LOOP - 250) {
    return { x: STR_LEFT - 2, y: base, pose: "stand", flip: false };
  }

  const step = Math.min(STR_STEPS - 1, Math.floor((time - STR_ASHORE) / STR_DOWN_MS));
  const u = clamp01((time - STR_ASHORE - step * STR_DOWN_MS) / STR_DOWN_MS);
  const fromX = stairTreadX(STR_STEPS - 1 - step);
  const fromY = stairTreadY(base, STR_STEPS - 1 - step);
  const toX = step === STR_STEPS - 1 ? STR_LEFT - 2 : stairTreadX(STR_STEPS - 2 - step);
  const toY = step === STR_STEPS - 1 ? base : stairTreadY(base, STR_STEPS - 2 - step);

  return {
    x: lerp(fromX, toX, easeInOut(u)),
    y: lerp(fromY, toY, easeInOut(u)),
    pose: walk,
    flip: true,
  };
}

const stair: MemeScene = {
  id: "stair",
  title: "계단과 엘리베이터",
  blurb: "오를 땐 한 칸씩, 내려갈 땐 네 층. 그 격언 그대로.",
  loopMs: STAIR_LOOP,
  /** 제일 이 판다운 순간 — 유리 칸은 붙박여 있고 건물이 쏟아지는 한가운데 */
  stillMs: 6500,

  draw(p, frame) {
    const time = frame.time;
    const camera = stairCameraY(time);
    const carY = stairCarY(time);
    const door = stairDoor(time);
    const ant = stairAnt(time);
    /** 세계 y → 화면 y */
    const sy = (worldY: number) => worldY - camera + STR_EYE;

    /* 벽지는 위아래로 옅게 그늘진다 */
    p.vGradient(0, p.h, "#e2dbcc", "#cfc6b4");

    /*
     * 층마다 되풀이되는 것들. **화면에 걸리는 층만 그린다** — 세계가 무한히 이어지므로
     * 범위를 안 자르면 한 바퀴에 수천 칸을 그린다.
     */
    const first = Math.floor((camera - STR_EYE) / STR_FLOOR) - 1;
    const last = Math.ceil((camera - STR_EYE + p.h) / STR_FLOOR) + 1;

    for (let k = first; k <= last; k += 1) {
      const floorY = k * STR_FLOOR;
      const base = sy(floorY);

      /* 창 — 바깥이 보여야 몇 층을 지나쳤는지 눈에 남는다 */
      p.rect(6, base - 46, 24, 16, "#7a6f5e");
      p.rect(7, base - 45, 22, 14, "#8fc4f0");
      p.rect(7, base - 39, 22, 1, "#c8e0ff");
      p.rect(17, base - 45, 1, 14, "#7a6f5e");

      if (stairHasFlight(floorY)) {
        /*
         * 계단 — 단면이라 **속이 찬 덩어리**로 그린다. 발판만 선으로 그으면 공중에 뜬
         * 널빤지가 되고, 단면 그림에서는 벽에 붙은 덩어리로 보여야 한다.
         */
        for (let i = 0; i < STR_STEPS; i += 1) {
          const treadTop = sy(stairTreadY(floorY, i));
          const x = STR_LEFT + i * STR_STEP_W;

          p.rect(x, treadTop, STR_STEP_W, base - treadTop, "#c0392b");
          p.rect(x, treadTop, STR_STEP_W, 3, "#ff5c5c");
          p.rect(x, treadTop, STR_STEP_W, 1, "#ffb3b3");
          /* 디딤판 코 — 한 도트 그늘이 있어야 칸과 칸이 갈린다 */
          p.rect(x, treadTop + 3, 1, base - treadTop - 3, "#8f2a1f");
        }

        /*
         * 난간 — **붉은 덩어리를 계단으로 읽히게 하는 건 이 선이다.** 발판만 있을 때는
         * 층마다 빨간 블록이 쌓인 그림이었는데, 비스듬한 선 하나가 지나가자 오르는 길이 됐다.
         */
        const railTop = (index: number) => sy(stairTreadY(floorY, index)) - 15;
        for (let i = 0; i < STR_STEPS; i += 1) {
          p.rect(STR_LEFT + i * STR_STEP_W + 2, railTop(i), 1, 15, "#a89e8e");
        }
        for (const dy of [0, 1]) {
          p.line(
            STR_LEFT + 2,
            railTop(0) + dy,
            STR_LEFT + (STR_STEPS - 1) * STR_STEP_W + 2,
            railTop(STR_STEPS - 1) + dy,
            "#c3bcae",
          );
        }
      }

      /* 바닥 슬래브 */
      p.rect(0, base, STR_WALL, 5, "#8d8375");
      p.rect(0, base, STR_WALL, 1, "#a89e8e");
    }

    /*
     * 승강로 — 위아래로 끝없이 이어지는 통로다. 층마다 끊지 않는다:
     * 끊으면 층마다 다른 통이 쌓인 것처럼 보인다.
     */
    p.rect(STR_WALL, 0, STR_SHAFT_W, p.h, "#4a4438");
    p.rect(STR_WALL, 0, 1, p.h, "#2f2b22");
    /* 케이블 — 칸 위로만 올라간다 */
    for (const dx of [10, 17]) {
      p.rect(STR_WALL + dx, 0, 1, Math.max(0, sy(carY) - STR_CAR_H), "#8d8375");
    }

    /* 문틀 자국 — **층계참에만** 있다 (계단이 있는 층에는 설 자리가 없다) */
    for (let k = first; k <= last; k += 1) {
      const floorY = k * STR_FLOOR;
      if (stairHasFlight(floorY)) continue;

      const base = sy(floorY);
      p.rect(STR_WALL + 1, base - STR_CAR_H, 2, STR_CAR_H, "#6b6354");
      p.rect(STR_WALL + 1, base - 1, STR_SHAFT_W - 2, 1, "#6b6354");
    }

    /*
     * 떨어지는 티 — 벽을 스치는 빛줄기. **하강 중에만** 친다. 카메라가 칸을 따라가므로
     * 벽이 흐르는 것 말고는 속도를 말해주는 게 없다.
     */
    const fall = stairFall(time);
    if (fall > 0 && fall < 1) {
      /*
       * **여기만 씨앗을 시간으로 흔든다.** 다른 판은 매 프레임 자리가 바뀌면 배경이
       * 지글거려서 씨앗을 고정하는데, 속도선은 반대로 떨려야 흐르는 것으로 보인다.
       * 대신 60Hz로 떨면 잡음이라 **90ms에 한 번씩만** 다시 뽑는다.
       */
      const flicker = seededRandom(frame.seed + 41 + Math.floor(time / 90));
      for (let i = 0; i < 16; i += 1) {
        const x = 2 + Math.floor(flicker() * (p.w - 4));
        const y = Math.floor(flicker() * p.h);
        const len = 10 + Math.floor(flicker() * 14);
        p.faded(0.4, () => p.rect(x, y, 1, len, "#ffffff"));
      }
    }

    /* 칸 — 바닥이 `carY`다 */
    const carTop = sy(carY) - STR_CAR_H;
    p.rect(STR_CAR_X, carTop, STR_CAR_W, STR_CAR_H, "#3f6fbf");
    p.rect(STR_CAR_X + 1, carTop + 1, STR_CAR_W - 2, STR_CAR_H - 2, "#dfe8ff");
    /* 바닥과 천장을 진하게 — 유리 상자가 아니라 칸으로 읽힌다 */
    p.rect(STR_CAR_X + 1, sy(carY) - 3, STR_CAR_W - 2, 2, "#8fb0e0");
    p.rect(STR_CAR_X + 1, carTop + 1, STR_CAR_W - 2, 2, "#8fb0e0");

    /*
     * 유리문 — 두 짝이 양옆으로 물러난다. **불투명하게 닫지 말 것**: 문이 닫히는 순간
     * 개미가 사라져, 제일 중요한 1.8초가 빈 상자가 내려가는 그림이 된다.
     *
     * **개미는 유리 위에 그린다.** 유리를 개미 위에 덮었더니 갈색 몸이 허옇게 떠서
     * 자세가 안 남았다 — 문짝 가장자리 선만 개미 위로 지나가게 두면 또렷하면서도
     * 문 안에 선 것으로 읽힌다.
     */
    const half = (STR_CAR_W - 2) / 2;
    const slide = door * half;
    p.faded(0.3, () => {
      p.rect(STR_CAR_X + 1, carTop + 3, half - slide, STR_CAR_H - 6, "#a8ccff");
      p.rect(STR_CAR_X + 1 + half + slide, carTop + 3, half - slide, STR_CAR_H - 6, "#a8ccff");
    });

    p.sprite(
      antPixels(STR_STAGE, ant.pose),
      ant.x - 8 * STR_SCALE,
      sy(ant.y) - 16 * STR_SCALE,
      STR_SCALE,
      ant.flip,
    );

    p.rect(STR_CAR_X + half - slide, carTop + 3, 1, STR_CAR_H - 6, "#3f6fbf");
    p.rect(STR_CAR_X + 1 + half + slide, carTop + 3, 1, STR_CAR_H - 6, "#3f6fbf");

    return speakCuts(STAIR_SCRIPT, frame, STR_CUTS, ant.x, sy(ant.y) - 16 * STR_SCALE - 2);
  },
};

/** 컷 경계 — 오르는 동안 둘, 타는 동안 하나, 떨어지는 동안 하나, 내려서 하나 */
const STR_CUTS = [300, 2300, 4300, 5700, 7500, 9400] as const;

/* ════════════════════════════════════════════════════
   17. 일개미 행진 — 차트 위를 오가는 개미 셋
   ════════════════════════════════════════════════════ */

/**
 * 대본 한 바퀴에 걸리는 시간 — 말풍선 박자는 이 값 그대로 유지한다.
 * `speakVoice`가 `BEAT_MS`(2400)로 박자를 끊으므로 **그 배수여야** 루프 끝에서
 * 말풍선이 중간에 잘리지 않는다. 속도(스크롤·걷기 진행률)는 `GRIND_SCROLL_LAPS ÷
 * GRIND_LOOP` 비율이 정하므로, 이 값만 줄이면 같은 랩 수를 더 짧은 시간에 돌아
 * 속도가 빨라진다 — 원래 속도를 지키려면 랩을 줄이는 수밖에 없는데, 랩은 정수여야
 * 루프 끝에서 지형이 시작과 맞물린다(아래 `GRIND_SCROLL_LAPS` 참고). 세계 폭
 * 108칸에서 원래 속도(60초당 1랩)로 정수 랩이 되는 제일 짧은 길이가 60초라, 20초
 * 대신 이 값으로 되돌린다.
 */
const GRIND_LOOP = 60000;
const GRIND_STAGE = 45;
/** 걷는 개미 수 — 한둘로는 "행진"이 안 살고, 너무 많으면 화면이 붐빈다. */
const GRIND_ANTS = 7;
/**
 * 세계가 한 바퀴(`GRIND_LOOP`) 동안 몇 번 흐르는가. **정수여야** 루프 끝의 스크롤
 * 위치가 시작과 같아(2바퀴째도 0으로 떨어진다) 이음매가 안 보인다. 2로 올리면
 * 옆으로 흐르는 속도가 그대로 2배가 된다 — 개미도 같은 배로 걷게 해 배경과
 * 어긋나지 않는다("스무스"하려면 배경과 개미가 같은 속도로 빨라져야 한다).
 */
const GRIND_SCROLL_LAPS = 1;

/** 캔들 12개가 폭을 딱 채운다(6+3=9칸씩, 12×9=108) — 다른 판의 캔들 폭(6칸)과 맞춘다. */
const GRIND_CANDLE_W = 6;
const GRIND_PITCH = 9;
const GRIND_COUNT = 12;
/** 세계 한 바퀴의 폭 — 화면 폭과 똑같아서 한 판이 통째로 다음 판과 이어붙는다. */
const GRIND_WORLD_W = GRIND_COUNT * GRIND_PITCH;

/**
 * 차트가 세로로 차지하는 자리 — **화면 높이(192)의 70%.** 위는 "코스피" 이름표가
 * 뜰 자리를 남기고, 아래는 여백으로 둔다. 값(시가·종가) 걸음은 씨앗마다 진폭이
 * 다르므로(어떤 seed는 크게 뛰고 어떤 seed는 잘게 뛴다) **그리기 직전에 실제 최저·
 * 최고로 되짚어 이 밴드에 맞춰 늘이거나 줄인다** — 미리 정해둔 배율로 그리면
 * 어떤 seed는 밴드를 다 못 채우고 어떤 seed는 넘친다.
 */
const GRIND_CHART_TOP = 40;
const GRIND_CHART_SPAN = Math.round(192 * 0.7);
const GRIND_CHART_BOTTOM = GRIND_CHART_TOP + GRIND_CHART_SPAN;

interface GrindBody {
  top: number;
  bottom: number;
  up: boolean;
  wickUp: number;
  wickDown: number;
}

interface GrindSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  len: number;
}

interface GrindTerrain {
  bodies: readonly GrindBody[];
  segments: readonly GrindSegment[];
  pathLen: number;
}

/**
 * 씨앗 하나가 차트 하나를 뽑는다 — **양봉·음봉·몸통 길이·꼬리 유무가 전부 무작위다**
 * (실제 차트는 규칙적으로 안 뒤집힌다). 종가가 다음 캔들의 시가가 되므로(`level`을
 * 이어씀) **캔들끼리 바닥을 공유하지 않는다** — 막대그래프처럼 전부 같은 줄(0)에서
 * 시작하던 모양이 이래서 사라진다. 매 프레임 다시 뽑으면 차트가 지글거리므로
 * `frame.seed`로 한 번만 뽑고, 같은 seed면 늘 같은 차트가 나온다.
 *
 * **걸음은 제자리로 돌아온다.** 마지막 캔들의 종가가 첫 캔들의 시가와 같아야
 * (`levels[COUNT] === levels[0]`) 화면이 스크롤되며 이 판이 다음 판과 이어붙을 때
 * 값이 뚝 끊기지 않는다 — 그래서 마지막 한 걸음은 무작위로 뽑지 않고 지금까지
 * 걸어온 만큼을 정확히 되갚는다.
 */
function grindTerrainAt(seed: number): GrindTerrain {
  const random = seededRandom(seed);

  // 1. 시가·종가를 이어붙인 걸음 — 마지막 캔들만 출발점(0)으로 정확히 되짚어 닫는다.
  const levels: number[] = [0];
  for (let i = 0; i < GRIND_COUNT - 1; i += 1) {
    // 0.5가 아니라 0.4를 빼 위로 살짝 치우친다 — 그래야 전체적으로 우상향한다.
    levels.push((levels[i] ?? 0) + (random() - 0.4) * 44);
  }
  levels.push(0);

  // 2. 실제로 나온 최저·최고를 재서 70% 밴드에 맞춰 되짚는다.
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const span = Math.max(1, high - low);
  const toY = (level: number) => GRIND_CHART_BOTTOM - ((level - low) / span) * GRIND_CHART_SPAN;

  const bodies: GrindBody[] = [];
  for (let i = 0; i < GRIND_COUNT; i += 1) {
    const open = levels[i] ?? 0;
    const close = levels[i + 1] ?? open;
    const wickUp = random() < 0.55 ? 2 + Math.floor(random() * 8) : 0;
    const wickDown = random() < 0.55 ? 2 + Math.floor(random() * 8) : 0;
    const openY = toY(open);
    const closeY = toY(close);

    bodies.push({
      top: Math.min(openY, closeY),
      bottom: Math.max(openY, closeY),
      up: close > open,
      wickUp,
      wickDown,
    });
  }

  /*
   * 개미가 밟는 길 — 제 캔들의 옆면을 오르고, 꼭대기를 걷고, 반대편 옆면을 내려온
   * 다음 **다음 캔들의 바닥까지 건너간다.** 몸통 바닥이 캔들마다 다른 높이에 떠
   * 있으므로(위 `bodies`) 건너가는 칸은 가로로 옮긴 뒤 세로로 맞추는 **직각 경로**다
   * — 대각선으로 미끄러지면 "걷다가 붕 뜬다"로 보이고, 오르내림은 **늘 수직이어야**
   * 오르는 것으로 읽힌다(아래 `rotateAntPixels90`이 이 수직 칸에서만 몸을 세운다).
   */
  const segments: GrindSegment[] = [];
  let prevRightX = 0;
  let prevBottomY = GRIND_CHART_BOTTOM;

  bodies.forEach((body, i) => {
    const leftX = i * GRIND_PITCH;
    const rightX = leftX + GRIND_CANDLE_W;

    if (i > 0) {
      segments.push({ x0: prevRightX, y0: prevBottomY, x1: leftX, y1: prevBottomY, len: leftX - prevRightX });
      segments.push({
        x0: leftX,
        y0: prevBottomY,
        x1: leftX,
        y1: body.bottom,
        len: Math.abs(body.bottom - prevBottomY),
      });
    }
    segments.push({ x0: leftX, y0: body.bottom, x1: leftX, y1: body.top, len: body.bottom - body.top });
    segments.push({ x0: leftX, y0: body.top, x1: rightX, y1: body.top, len: rightX - leftX });
    segments.push({ x0: rightX, y0: body.top, x1: rightX, y1: body.bottom, len: body.bottom - body.top });

    prevRightX = rightX;
    prevBottomY = body.bottom;
  });

  /*
   * 마지막 캔들에서 세계의 오른쪽 끝(`GRIND_WORLD_W`)까지 마저 걷는다 — 값이 이미
   * 출발점으로 닫혀 있으므로(위 `levels`) 이 칸은 늘 수평이고, 다음 바퀴의 첫 칸과
   * 높이가 정확히 맞아 스크롤이 이어붙는다.
   */
  const firstBottom = bodies[0]?.bottom ?? prevBottomY;
  segments.push({
    x0: prevRightX,
    y0: prevBottomY,
    x1: GRIND_WORLD_W,
    y1: firstBottom,
    len: GRIND_WORLD_W - prevRightX,
  });

  return { bodies, segments, pathLen: segments.reduce((sum, seg) => sum + seg.len, 0) };
}

/**
 * 길 위의 거리(`s`)를 좌표로 바꾼다. 오르막·내리막·평지가 전부 이 하나로 풀린다.
 * 지나는 칸의 방향(`dx`, `dy`)도 같이 돌려준다 — 옆면을 오르내리는 동안 몸을 세워
 * 그리려면(아래 `rotateAntPixels90`) 지금 어느 쪽으로 가는 칸인지 알아야 한다.
 */
function grindPathAt(
  terrain: GrindTerrain,
  s: number,
): { x: number; y: number; dx: number; dy: number } {
  let remaining = Math.max(0, Math.min(terrain.pathLen, s));

  for (const seg of terrain.segments) {
    if (remaining <= seg.len) {
      const t = seg.len === 0 ? 0 : remaining / seg.len;
      return { x: lerp(seg.x0, seg.x1, t), y: lerp(seg.y0, seg.y1, t), dx: seg.x1 - seg.x0, dy: seg.y1 - seg.y0 };
    }
    remaining -= seg.len;
  }

  const last = terrain.segments[terrain.segments.length - 1];
  return last
    ? { x: last.x1, y: last.y1, dx: last.x1 - last.x0, dy: last.y1 - last.y0 }
    : { x: 0, y: GRIND_CHART_BOTTOM, dx: 0, dy: 0 };
}

/**
 * 세계 좌표를 화면 좌표로 접는다. **세계 폭(`GRIND_WORLD_W`)이 화면 폭과 같아서**
 * 캔들이든 개미든 늘 [0, 세계 폭) 한 칸으로 접힌다 — 그 값이 그대로 화면 어딘가에
 * 있다는 뜻이다. 다만 폭이 있는 것(캔들 몸통·개미 스프라이트)은 이 칸의 오른쪽
 * 끝에 걸치면 왼쪽으로 잘린 조각이 남으므로, 부르는 쪽이 `- GRIND_WORLD_W`로도
 * 한 번 더 그려 그 조각을 받는다.
 */
function grindWorldToScreen(worldX: number, scroll: number): number {
  const wrapped = (worldX - scroll) % GRIND_WORLD_W;
  return wrapped < 0 ? wrapped + GRIND_WORLD_W : wrapped;
}

/**
 * 개미 문자맵을 90도 돌린다 — **옆면을 오르내릴 땐 몸을 세워야** 걷는 게 아니라
 * 오르는 걸로 읽힌다. 16×16 격자를 정확히 전치하는 것뿐이라(회전각이 90도뿐이라)
 * 다른 회전과 달리 도트가 안 흐려진다. ccw(반시계) — 오른쪽을 보던 주둥이가 위를
 * 향한다. 아니면 시계 방향 — 아래를 향한다.
 */
function rotateAntPixels90(pixels: readonly AntPixel[], ccw: boolean): AntPixel[] {
  return pixels.map((pixel) =>
    ccw
      ? { x: pixel.y, y: 15 - pixel.x, fill: pixel.fill }
      : { x: 15 - pixel.y, y: pixel.x, fill: pixel.fill },
  );
}

const grind: MemeScene = {
  id: "grind",
  title: "일개미 행진",
  blurb: "차트 봉을 오르내리며 오늘도 부지런히 돈을 번다.",
  loopMs: GRIND_LOOP,
  /** 제일 이 판다운 순간 — 말풍선이 또렷하게 뜬 채로 멈춘다 (박자 한가운데) */
  stillMs: 51600,

  draw(p, frame) {
    const time = frame.time;
    const terrain = grindTerrainAt(frame.seed);
    /* 세계가 왼쪽으로 흐른다 — 한 바퀴가 끝나면 정확히 세계 폭의 정수 배만큼
       흘러 있어 다음 바퀴 첫 프레임과 화면이 똑같다(닫힌 지형이라 값도 이어붙는다). */
    const scroll = ((time / GRIND_LOOP) * GRIND_SCROLL_LAPS * GRIND_WORLD_W) % GRIND_WORLD_W;

    /* 차트 화면 — 옅은 격자 위에 캔들만 있으면 된다, 꾸밀 게 없다 */
    p.clear("#eef3fb");
    for (let row = 40; row < 190; row += 26) p.rect(0, row, p.w, 1, "#dbe6f5");

    terrain.bodies.forEach((body, i) => {
      const worldX = i * GRIND_PITCH;
      const screenX = grindWorldToScreen(worldX, scroll);
      const height = body.bottom - body.top;
      const color = body.up ? "#ff5c5c" : "#5c9dff";

      // 화면 오른쪽 끝에 걸친 캔들은 왼쪽 조각도 그려야 한다 — 두 자리 다 그린다.
      for (const x of [screenX, screenX - GRIND_WORLD_W]) {
        if (x + GRIND_CANDLE_W < 0 || x > p.w) continue;
        if (body.wickUp > 0) p.rect(x + GRIND_CANDLE_W / 2, body.top - body.wickUp, 1, body.wickUp, color);
        if (body.wickDown > 0) p.rect(x + GRIND_CANDLE_W / 2, body.bottom, 1, body.wickDown, color);
        p.rect(x, body.top, GRIND_CANDLE_W, height, color);
        p.rect(x, body.top, GRIND_CANDLE_W, 1, body.up ? "#ff8f8f" : "#8fc4ff");
      }
    });

    /*
     * 개미 여럿 — 다 같은(닫힌) 길을 걷되 **길 위 시작 지점(phase)만 다르다.**
     * 늘 앞으로만 걷고(왕복하지 않는다), 한 바퀴 도는 길이가 지형과 같은
     * 폭(`GRIND_WORLD_W`)이라 세계가 흐르는 속도와 맞물려 "차트 위를 걸으며
     * 화면 밖으로 흘러나가고, 새 개미가 반대편에서 계속 나온다"로 보인다.
     */
    const antInfos: { index: number; x: number; y: number }[] = [];
    for (let i = 0; i < GRIND_ANTS; i += 1) {
      const phase = i / GRIND_ANTS;
      const progress = ((time / GRIND_LOOP) * GRIND_SCROLL_LAPS + phase) % 1;
      const { x: worldX, y, dx, dy } = grindPathAt(terrain, progress * terrain.pathLen);
      const top = y - 16;

      const pose: AntPose = flip2(time + i * 60, 150) ? "crawl1" : "crawl2";
      const basePixels = antPixels(GRIND_STAGE, pose);

      let pixels: readonly AntPixel[] = basePixels;
      let flip = false;
      if (dx === 0 && dy !== 0) {
        // 옆면 — 늘 앞으로만 걷기 때문에 dy 부호가 곧 오르는지 내리는지다.
        pixels = rotateAntPixels90(basePixels, dy < 0);
      } else {
        flip = dx < 0;
      }

      const screenX = grindWorldToScreen(worldX, scroll);
      for (const x of [screenX, screenX - GRIND_WORLD_W]) {
        if (x + 8 < 0 || x - 8 > p.w) continue;
        p.sprite(pixels, x - 8, top, 1, flip);
      }
      antInfos.push({ index: i, x: screenX, y: top });
    }

    /*
     * 개미 투자자 채팅 — **화면 가운데에 가장 가까운 둘만** 골라 말풍선을 띄운다.
     * 가운데 개미가 늘 주인공(첫 번째 = 메인 말풍선)이고, 나머지 하나는 `extra`로
     * 거든다. 셋 이상 띄우면 화면이 말풍선으로 붐빈다.
     */
    const speakers = antInfos
      .slice()
      .sort((a, b) => Math.abs(a.x - p.w / 2) - Math.abs(b.x - p.w / 2))
      .slice(0, 2)
      // 개미 키가 비슷하면 말풍선끼리 겹친다 — 순위(rank)만큼 한 칸씩 더 띄운다.
      // 두 줄로 접히는 긴 문구도 있어 한 칸을 넉넉히(30) 잡는다.
      .map((info, rank) => speakVoice("grind", frame, info.index, info.x, info.y - rank * 30));
    const [primary, ...rest] = speakers;

    return {
      ...(primary ?? { text: "", x: 0, y: 0, alpha: 0 }),
      extra: rest,
      labels: [{ text: "코스피", x: 16, y: 10, alpha: 1, unit: 6, color: "#5b6b85" }],
    };
  },
};

/* ════════════════════════════════════════════════════
   18. 미장 개미 — 잠 못 들고 휴대폰만 보는 새벽 세 시
   ════════════════════════════════════════════════════ */

const PHONE_LOOP = 7200;
const PHONE_STAGE = 20;

/**
 * 클로즈업 얼굴(52×80)을 몸보다 훨씬 크게 쓴다 — **"개미 얼굴이 크게 보여야 한다"**는
 * 요청 그대로다. 무념무상·존버 중과 같은 얼굴판이라 몸은 없다: 이불 밖으로 얼굴만
 * 나온 그림이라 몸이 없어도 어색하지 않다.
 */
const PHONE_FACE_SCALE = 1.7;
const PHONE_FACE_LEFT = Math.round((108 - ANT_FACE_W * PHONE_FACE_SCALE) / 2);
const PHONE_FACE_TOP = 58;
/** 얼굴 격자 기준 눈 높이 — 그 옆에 휴대폰을 들어야 "들여다본다"가 된다. */
const PHONE_EYE_Y = PHONE_FACE_TOP + 30 * PHONE_FACE_SCALE;
const PHONE_X = PHONE_FACE_LEFT + ANT_FACE_W * PHONE_FACE_SCALE - 6;
const PHONE_Y = PHONE_EYE_Y - 4;
/** 눈 깜빡임 — 7200과 나누어떨어져야(3번) 루프 끝에서 눈 상태가 안 튄다. */
const PHONE_BLINK_MS = 2400;

const phone: MemeScene = {
  id: "phone",
  title: "미장 개미",
  blurb: "새벽 세 시, 잠은 안 오고 미장만 들여다본다.",
  loopMs: PHONE_LOOP,
  /** 제일 이 판다운 순간 — 눈 뜨고 있고, 불빛이 막 부풀어 오른 채다 */
  stillMs: 900,

  draw(p, frame) {
    const time = frame.time;
    const osc = oscillator(time / PHONE_LOOP);

    /* 방 — 불 끈 새벽. 빛은 오직 창밖 달과 휴대폰 하나뿐이다. */
    p.clear("#0b0f1a");

    /* 창문 — 밤하늘과 달. 별은 씨앗으로 고정한다(매 프레임 다시 뽑으면 하늘이 지글거린다). */
    p.rect(70, 10, 32, 32, "#141c30");
    const star = seededRandom(frame.seed + 5);
    for (let i = 0; i < 10; i += 1) {
      const x = 72 + Math.floor(star() * 28);
      const y = 12 + Math.floor(star() * 28);
      p.dot(x, y, "#3a4568");
    }
    p.disc(90, 21, 6, "#e7e9f2");
    p.disc(88, 19, 2, "#c7cbe0");
    p.disc(93, 24, 2, "#c7cbe0");
    p.rect(85, 10, 1, 32, "#0b0f1a");
    p.rect(70, 25, 32, 1, "#0b0f1a");

    /* 벽시계 — 늘 세 시에 멈춰 있다. 짧은바늘은 3(오른쪽), 긴바늘은 12(위)를 가리킨다. */
    p.disc(20, 24, 12, "#232c48");
    p.disc(20, 24, 10, "#141a30");
    const ticks: readonly [number, number][] = [
      [0, -9],
      [0, 9],
      [-9, 0],
      [9, 0],
    ];
    for (const [dx, dy] of ticks) {
      p.dot(20 + dx, 24 + dy, "#5a6690");
    }
    p.rect(20, 16, 1, 8, "#d8dcec"); // 긴바늘 — 12시 방향
    p.rect(20, 24, 7, 1, "#d8dcec"); // 짧은바늘 — 3시 방향
    p.disc(20, 24, 1, "#eef1fb");

    /* 베개 — 얼굴 뒤에 깔린 둥근 그림자. 얼굴보다 먼저 그려야 뒤로 간다. */
    p.disc(54, PHONE_FACE_TOP + 92, 62, "#2c355e");

    /*
     * 얼굴 — **위를 흘긋 보는 눈**(gaze="up")으로 들어 올린 휴대폰을 본다. 표정을
     * 새로 그리지 않고 눈만 감았다 뜬다("closed"↔"up") — 무념무상 판과 같은 규칙,
     * 얼굴형이 프레임마다 안 튀어야 한다.
     */
    const blinking = time % PHONE_BLINK_MS < 150;
    /*
     * 머리까지만 자른다(빈 지갑 판과 같은 자리, `WALLET_HEAD_ROWS` 참고) — 얼굴
     * 문자맵 65행부터 몸(t/T) 색이 시작되는데, 몸까지 그리면 이불 밖으로 얼굴만
     * 내놓은 그림이 아니라 몸통 색이 턱 밑에 띠로 드러난다.
     */
    const face = antFaceCalmPixels(PHONE_STAGE, blinking ? "closed" : "up", {}).filter(
      (pixel) => pixel.y <= 64,
    );
    p.sprite(face, PHONE_FACE_LEFT, PHONE_FACE_TOP, PHONE_FACE_SCALE);

    /* 이불 — 잘려나간 얼굴 아래쪽을 덮어 "누워서 이불 밖으로 얼굴만 낸" 그림으로 만든다. */
    const quiltTop = PHONE_FACE_TOP + 62 * PHONE_FACE_SCALE;
    p.rect(0, quiltTop, p.w, 192 - quiltTop, "#232a48");
    p.rect(0, quiltTop, p.w, 2, "#2f3868");

    /*
     * 불빛 — 휴대폰 하나가 광원이다. **얼굴을 그린 뒤에 덮어 칠해야** 얼굴에 빛이
     * 앉는다 — 먼저 칠하면 불투명한 얼굴이 그 위를 그대로 덮어버려 빛이 얼굴 뒤로
     * 숨는다. **번지는 크기가 숨쉬듯 늘었다 줄었다** 한다(`osc`는 루프 안에서 정수
     * 번 돌아 이음매가 안 보인다).
     */
    const glow = 30 + osc(2) * 4;
    p.faded(0.16, () => p.disc(PHONE_X, PHONE_Y, glow, "#bcd4ff"));
    p.faded(0.26, () => p.disc(PHONE_X, PHONE_Y, glow * 0.6, "#d7e6ff"));
    p.faded(0.42, () => p.disc(PHONE_X, PHONE_Y, glow * 0.32, "#f2f8ff"));

    /* 휴대폰 — 얼굴 옆으로 든 것이라 얼굴보다 위, 화면만 밝고 테두리는 어둡다. */
    p.rect(PHONE_X - 5, PHONE_Y - 8, 10, 15, "#0e1220");
    p.rect(PHONE_X - 4, PHONE_Y - 7, 8, 13, "#eaf6ff");

    return {
      ...speak("phone", frame, PHONE_X - 8, PHONE_Y - 8 - 2),
      labels: [{ text: "미장 개미", x: 54, y: 4, alpha: 1, unit: 6, bold: true, color: "#eef2fb" }],
    };
  },
};

/* ════════════════════════════════════════════════════
   19. 폭풍 존버 — 붙잡고 버틴다
   ════════════════════════════════════════════════════ */

/**
 * 대본 다섯 컷짜리 폭풍. **양봉으로 시작해 음봉으로 무너졌다가 다시 양봉으로 뒤집힌다.**
 * 봉은 이 앱의 색·방향 규칙을 그대로 따른다 — **손실(음봉)은 땅속으로(파랑), 수익(양봉)은
 * 하늘로(빨강)** 뻗는다 (장대봉 무대와 같은 자리). 그래서 **음봉은 땅 위에 몸통을 두지
 * 않는다** — 무너지는 순간 땅 위 높이가 그대로 꼬리로 남고, 몸통은 땅속으로만 파고든다.
 * 절정의 번개에서 다시 양봉으로 뒤집히며 그 꼬리를 밀어내고 땅을 뚫어 하늘로 자란다.
 *
 * **개미는 무너지기 시작할 때 그 꼬리(예전 고점의 흔적)를 두 팔로 붙잡고 엎드린다**
 * (`grip`, [ant-sprite.tsx](../ant-sprite.tsx)). 몸통이 땅속으로 끌려가는 동안 꼬리는
 * 그대로 남아 있어 붙잡을 게 있고, 봉이 뒤집혀 솟는 순간 함께 튀어 올라(`jump`)
 * 일어선다(`stand`/`wave`) — "버틴다"가 자세가 아니라 **안 놓는 것**으로 읽히게 한다.
 *
 * 화면 위에는 수익률이 대본처럼 못박힌 숫자로 카운트된다(+8% → -40% → +60%, 남극 탐험의
 * 하락률 자막과 같은 자리다 — **계산값이 아니라 대본이다**, 이 판은 시세를 안 읽는다).
 *
 * **되돌아오지 않는 판이다** (물타기·코인 상자와 같은 자리) — 봉이 자라고 하늘이 개는
 * 건 장식이 아니라 이야기라, 한 바퀴 끝은 폭풍이 아니라 갠 하늘이고 다음 바퀴는 다시
 * 처음(양봉)부터다. 이음매는 컷이다.
 */
/**
 * 다 뒤집힌 뒤로도 **한참을 그대로 머물다** 끝난다 (`STORM_FLIP_AT` + 자라는 시간 +
 * 네 번째 대사(`STORM_CUT4_MS`) 이후로도 4초 더) — 승리 상태에서 바로 처음(양봉
 * 인트로)으로 컷되면, 하늘이 둘 다 맑아서 이어지는 것처럼 보이다 봉 높이·퍼센트·자세가
 * 한 프레임 만에 확 바뀌어 어색하다. 다 자란 봉·+60%·손 흔드는 개미가 화면에 충분히
 * 머문 뒤에야 다음 바퀴(양봉)로 넘어간다.
 */
const STORM_LOOP = 12600;
const STORM_GROUND = 128;
/** 첫 양봉이 무너지기 시작하는 시각 */
const STORM_INTRO_END = 700;
/** 무너져 몸통이 땅속으로 다 들어가기까지 걸리는 시간 */
const STORM_PLUNGE_MS = 700;
const STORM_PLUNGE_END = STORM_INTRO_END + STORM_PLUNGE_MS;
/** 봉이 뒤집히는 순간. 번개도 여기서 친다. */
const STORM_FLIP_AT = 7000;
/** 뒤집힌 뒤 새 키까지 자라는 시간 */
const STORM_GROW_MS = 900;
const STORM_X = 62;
const STORM_W = 12;
const STORM_SCALE = 3;
const STORM_ANT_LEFT = 18;
const STORM_ANT_TOP = STORM_GROUND - 16 * STORM_SCALE;
/** 어두운 폭풍 하늘 앞이라 붉은 단계로 잡아야 실루엣이 안 묻힌다 */
const STORM_STAGE = 42;
/** 처음 양봉의 키 — 무너진 뒤 남는 꼬리 길이이자 `grip` 자세의 팔이 닿는 높이다 */
const STORM_INTRO_H = 34;
/** 무너지는 순간 땅속에 처음 박히는 깊이 — 몸통 길이(STORM_BODY_H)와 맞춰, 처음엔 꼬리 없이 몸통만 표면에 닿아 있다 */
const STORM_PLUNGE_DEPTH = 20;
/** 땅속 몸통의 고정 길이. 더 깊어지는 만큼은 몸통이 아니라 표면까지 이어지는 꼬리가 늘어난다 */
const STORM_BODY_H = 20;
/** 뒤집힌 뒤 다 자란 키 */
const STORM_HIGH_H = 120;
/** 폭풍이 절정일 때 땅속으로 박히는 깊이 */
const STORM_DEPTH_MAX = 54;
/** 대본 수익률 — 계산값이 아니라 못박힌 숫자다 (남극 탐험의 하락률과 같다) */
const STORM_PCT_START = 8;
const STORM_PCT_MIN = -40;
const STORM_PCT_MAX = 60;
/** 뒤집힌 뒤 수익률이 다 세어지기까지 걸리는 시간 */
const STORM_COUNT_MS = 1800;
/**
 * 네 번째 컷("내가 말했지!! ❤️")이 떠 있는 시간. 봉이 다 자라는 시간(`STORM_GROW_MS`,
 * 900ms)보다 **일부러 더 길게** 잡는다 — 다 자란 뒤에도 그 말은 한동안 더 남아 있어야
 * 여운이 산다. 짧게 두면 봉이 자라자마자 말풍선이 사라져 반응할 새가 없다.
 */
const STORM_CUT4_MS = 1600;
/**
 * 대본 다섯 컷의 경계. **균등 분할이 아니다** — 첫 컷은 음봉으로 바뀐 뒤부터 열리고
 * (`STORM_INTRO_END`, 처음 양봉 위에 안 겹치도록), 네 번째 컷은 봉이 뒤집혀 자라는
 * 순간부터 `STORM_CUT4_MS`만큼 못박혀 있다 — 튀어 오르는 그 순간을 보고 하는 말이라서다.
 * 가운데 세 컷(조짐·다짐·손해아님)만 그 사이를 고르게 나눠 쓴다.
 */
const STORM_SCRIPT_BOUNDS = [
  STORM_INTRO_END,
  STORM_INTRO_END + (STORM_FLIP_AT - STORM_INTRO_END) / 3,
  STORM_INTRO_END + ((STORM_FLIP_AT - STORM_INTRO_END) * 2) / 3,
  STORM_FLIP_AT,
  STORM_FLIP_AT + STORM_CUT4_MS,
  STORM_LOOP,
] as const;

/**
 * `#hex` 두 색을 섞어 **다시 `#hex`로** 낸다. `mixColor`는 `rgb(...)`를 내는데, 그걸
 * `vGradient`에 넘기면 내부에서 `mixColor`를 또 불러 `parseHex`가 `rgb(...)`를 `#hex`로
 * 착각해 엉뚱한 색(NaN → 이전 프레임 색이 그대로 남는다)이 나온다 — 실제로 그렇게 하늘이
 * 통째로 직전 장면의 흙빛으로 얼어붙은 적이 있다. 두 번 섞을 자리(하늘의 위·아래 ×
 * 폭풍·갠 하늘)에서는 `#hex`로 되돌려주는 이 함수를 쓴다.
 */
function hexMix(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace("#", "");
    return [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16));
  };
  const a = parse(from);
  const b = parse(to);
  const k = clamp01(t);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

  return `#${[0, 1, 2].map((i) => toHex((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * k)).join("")}`;
}

/**
 * 폭풍이 몰아치는 정도. 0(고요)~1(절정) — **무너지기 전엔 고요하다**(양봉일 때 비바람이
 * 칠 이유가 없다), 무너지는 순간부터 차오르고, 뒤집힌 뒤엔 빠르게 잦아든다.
 */
function stormWind(time: number): number {
  if (time < STORM_INTRO_END) return 0;
  if (time < STORM_FLIP_AT) return easeInOut(clamp01((time - STORM_INTRO_END) / 4500));
  return lerp(1, 0.12, easeOut(clamp01((time - STORM_FLIP_AT) / 1400)));
}

/**
 * 대본 수익률. 계산값이 아니다 — **양봉(+8%)으로 시작해** 무너지며 -5%를 지나 폭풍
 * 동안 -40%까지 나빠지다, 뒤집힌 뒤 +60%까지 센다.
 */
function stormPercent(time: number): number {
  if (time < STORM_INTRO_END) return STORM_PCT_START;
  if (time < STORM_PLUNGE_END) {
    return lerp(STORM_PCT_START, -5, easeInOut(clamp01((time - STORM_INTRO_END) / STORM_PLUNGE_MS)));
  }
  if (time < STORM_FLIP_AT) {
    const t = clamp01((time - STORM_PLUNGE_END) / (STORM_FLIP_AT - STORM_PLUNGE_END));
    return lerp(-5, STORM_PCT_MIN, easeInOut(t));
  }
  return lerp(STORM_PCT_MIN, STORM_PCT_MAX, easeOut(clamp01((time - STORM_FLIP_AT) / STORM_COUNT_MS)));
}

/**
 * 봉이 땅 위로 뻗은 높이. 처음 양봉의 키에서 시작해 무너지며 0으로 줄고(음봉은 땅 위에
 * 몸통이 없다), 뒤집힌 뒤에야 다시 새 키까지 자란다.
 */
function stormBarAbove(time: number): number {
  if (time < STORM_INTRO_END) return STORM_INTRO_H;
  if (time < STORM_PLUNGE_END) {
    return lerp(STORM_INTRO_H, 0, easeInOut(clamp01((time - STORM_INTRO_END) / STORM_PLUNGE_MS)));
  }
  if (time < STORM_FLIP_AT) return 0;
  return lerp(0, STORM_HIGH_H, easeOut(clamp01((time - STORM_FLIP_AT) / STORM_GROW_MS)));
}

/** 봉이 땅속으로 박힌 깊이 — 무너지며 파고들기 시작해 폭풍이 셀수록 깊어지다, 뒤집히면 빠르게 빠져나온다. */
function stormBarBelow(time: number): number {
  if (time < STORM_INTRO_END) return 0;
  if (time < STORM_PLUNGE_END) {
    return lerp(0, STORM_PLUNGE_DEPTH, easeInOut(clamp01((time - STORM_INTRO_END) / STORM_PLUNGE_MS)));
  }
  if (time < STORM_FLIP_AT) {
    const t = clamp01((time - STORM_PLUNGE_END) / (STORM_FLIP_AT - STORM_PLUNGE_END));
    return lerp(STORM_PLUNGE_DEPTH, STORM_DEPTH_MAX, easeInOut(t));
  }
  return lerp(STORM_DEPTH_MAX, 0, easeOut(clamp01((time - STORM_FLIP_AT) / 400)));
}

/**
 * 하늘이 갠 정도. 0(먹구름)~1(맑음). **처음 양봉일 땐 맑아야 한다** — `up`
 * (뒤집혔는가) 하나로만 정했더니 무너지기 전 고요한 양봉 구간까지 먹구름과 함께
 * 캄캄해지는 문제가 있었다. `stormWind`가 이미 "무너지기 전엔 0, 무너지며 차오른다"를
 * 알고 있으므로 그 반대를 쓴다 — 바람이 없으면 하늘도 맑다. 뒤집힌 뒤엔 기존대로
 * 번개 뒤 여유를 두고 다시 갠다.
 */
function stormClear(time: number): number {
  if (time < STORM_FLIP_AT) return 1 - stormWind(time);
  return easeOut(clamp01((time - STORM_FLIP_AT - 200) / 1400));
}

/**
 * 무너진 뒤 땅 위에 남는 꼬리의 알파. 처음 양봉이 무너지기 시작하면서 빠르게 나타나
 * 폭풍 내내 남아 있다가(개미가 이걸 붙잡는다), 뒤집혀 새 몸통이 그 자리를 밀고
 * 올라오면 사라진다.
 */
function stormWickAlpha(time: number): number {
  if (time < STORM_INTRO_END) return 0;
  if (time < STORM_FLIP_AT) return clamp01((time - STORM_INTRO_END) / 250);
  return clamp01(1 - (time - STORM_FLIP_AT) / 250);
}

const storm: MemeScene = {
  id: "storm",
  title: "폭풍 존버",
  blurb: "몰아치는 폭풍 속, 봉 하나 곁에서 버틴다.",
  loopMs: STORM_LOOP,
  stillMs: 8800,

  draw(p, frame) {
    const time = frame.time;
    const osc = oscillator(time / STORM_LOOP);
    const wind = stormWind(time);
    /** 뒤집혀 회복됐는가 — 하늘·축포·개미 자세가 이 시점 하나를 기준으로 갈린다 */
    const up = time >= STORM_FLIP_AT;
    /** 지금 봉의 색 — 처음 양봉과 회복한 뒤는 빨강, 무너져 있는 동안(폭풍)은 파랑 */
    const bodyUp = time < STORM_INTRO_END || up;
    const mood = bodyUp ? "#ff5c5c" : "#5c9dff";
    /** 갠 정도 — 처음 양봉일 땐 맑고, 무너지며 흐려지다, 뒤집히고서야 다시 밝아진다 */
    const clear = stormClear(time);
    const percent = stormPercent(time);

    /* 하늘 — 먹구름 낀 폭풍에서 갠 하늘로. 뒤집히기 전엔 그대로 어둡다. */
    p.vGradient(0, STORM_GROUND, hexMix("#0b0d16", "#4aa8ea", clear), hexMix("#232a44", "#bfe3ff", clear));

    /* 먹구름 — 개일수록 옅어지다 사라진다 */
    if (clear < 0.96) {
      const cloudRandom = seededRandom(frame.seed + 61);
      p.faded(1 - clear, () => {
        for (let i = 0; i < 4; i += 1) {
          const x = 10 + cloudRandom() * 88 + osc(1, i * 0.27) * 4;
          drawFlatCloud(p, x, 14 + i * 12, 10 + (i % 2) * 3);
        }
      });
    }

    /* 바람에 쓸리는 결 — 화면을 가로로 스치는 옅은 선들. 절정에서 제일 촘촘하다. */
    const streakRandom = seededRandom(frame.seed + 67);
    const streaks = Math.round(4 + 14 * wind);
    for (let i = 0; i < streaks; i += 1) {
      const y = Math.floor(streakRandom() * STORM_GROUND);
      const length = 6 + Math.floor(streakRandom() * 10);
      const laps = 2 + Math.floor(streakRandom() * 3);
      const span = p.w + length;
      const x = ((streakRandom() * span + (time / STORM_LOOP) * laps * span) % span) - length;
      p.faded(0.16 + 0.14 * wind, () => p.rect(x, y, length, 1, "#c7d6ef"));
    }

    /* 비 — 바람 방향으로 비스듬히, 몰아칠 때만 내린다 */
    if (wind > 0.15) {
      const rainRandom = seededRandom(frame.seed + 71);
      for (let i = 0; i < 24; i += 1) {
        const x = rainRandom() * p.w;
        const y = ((time / 90 + rainRandom() * 400) % (STORM_GROUND + 20)) - 10;
        p.faded(wind * 0.7, () => p.line(x, y, x - 4 * wind, y + 7, "#8fb4e8"));
      }
    }

    /* 번개 — 뒤집히는 순간 한 번, 하늘을 가르고 화면이 하얗게 튄다 */
    const sinceFlash = time - STORM_FLIP_AT;
    if (sinceFlash >= 0 && sinceFlash < 160) {
      const flashAlpha = sinceFlash < 60 ? 1 : clamp01(1 - (sinceFlash - 60) / 100);
      p.faded(flashAlpha * 0.75, () => p.rect(0, 0, p.w, STORM_GROUND, "#ffffff"));

      const bx = STORM_X + STORM_W / 2;
      p.faded(flashAlpha, () => {
        p.line(bx + 6, 0, bx - 4, 40, "#fff3b0");
        p.line(bx - 4, 40, bx + 8, 72, "#fff3b0");
        p.line(bx + 8, 72, bx - 2, 104, "#fff3b0");
      });
    }

    /* 땅 */
    p.rect(0, STORM_GROUND, p.w, 3, "#1c1c24");
    p.rect(0, STORM_GROUND + 3, p.w, p.h - STORM_GROUND - 3, "#121218");

    /*
     * 꼬리 — 무너지는 순간 남는 예전 고점의 흔적. **땅 위엔 이것만 남는다** — 음봉은
     * 몸통을 땅 위에 두지 않으므로, 몸통이 다 가라앉은 뒤에도 이 가는 선이 개미가
     * 붙잡을 자리로 남는다. 뒤집혀 새 몸통이 그 자리를 밀고 올라오면 사라진다.
     */
    const wickAlpha = stormWickAlpha(time);
    if (wickAlpha > 0.01) {
      p.faded(wickAlpha, () => {
        p.rect(STORM_X + 4, STORM_GROUND - STORM_INTRO_H, 4, STORM_INTRO_H, "#5c9dff");
        p.rect(STORM_X + 5, STORM_GROUND - STORM_INTRO_H, 2, STORM_INTRO_H, "#8fc0ff");
      });
    }

    /*
     * 봉 — 땅 위 몫은 뿌리처럼 박힌 아래는 안 움직이고 위로 갈수록 바람에 크게 휜다
     * (**회전 대신 줄마다 좌우로 다시 잰다** — 도트 그림은 회전을 못 믿는다). 땅속 몫은
     * 흙에 파묻혀 있으니 안 흔들린다 — 흔들리는 건 땅 위뿐이다. **꼬리를 먼저 그려야**
     * 무너지는 동안은 몸통이 꼬리를 덮고, 다 가라앉은 뒤에는 몸통이 사라져 꼬리만
     * 남는다 — 순서를 바꾸면 꼬리가 몸통 위에 겹쳐 그려진다.
     */
    const above = stormBarAbove(time);
    const below = stormBarBelow(time);
    const swayAmpl = 3.2 * wind;

    for (let row = 0; row < above; row += 1) {
      const y = STORM_GROUND - 1 - row;
      const lean = (row / Math.max(1, above)) ** 1.3;
      const x = STORM_X + Math.sin(time * 0.0045 + row * 0.12) * swayAmpl * lean;
      p.rect(x, y, STORM_W, 1, mood);
      p.rect(x + 2, y, 3, 1, bodyUp ? "#ffb3b3" : "#a8ccff");
      p.rect(x + STORM_W - 4, y, 3, 1, bodyUp ? "#c0392b" : "#2f6bcc");
    }

    /*
     * 땅속 — 몸통은 짧게 고정해두고, 표면부터 몸통 꼭대기까지는 **가는 꼬리**로 잇는다.
     * 폭풍이 깊어질수록 몸통이 바닥 쪽으로 더 꺼지고, 표면과 몸통 사이가 벌어진 만큼
     * 꼬리가 **하방으로 길어진다.** 흔들림은 꼬리에만 준다 — 몸통까지 흔들면 무게감이
     * 사라지고, 꼬리는 표면(고정된 쪽)에서 몸통(움직이는 쪽)으로 갈수록 더 휘청인다.
     */
    if (below > 0.5) {
      const bodyH = Math.min(STORM_BODY_H, below);
      const wickLen = below - bodyH;

      if (wickLen > 0.5) {
        const waverAmpl = Math.min(4.5, wickLen * 0.16) * wind;
        for (let row = 0; row < wickLen; row += 1) {
          const y = STORM_GROUND + row;
          const reach = row / Math.max(1, wickLen);
          const x = STORM_X + STORM_W / 2 - 2 + Math.sin(time * 0.018 + row * 0.35) * waverAmpl * reach;
          p.rect(x, y, 4, 1, mood);
        }
      }

      const bodyTop = STORM_GROUND + wickLen;
      for (let row = 0; row < bodyH; row += 1) {
        const y = bodyTop + row;
        p.rect(STORM_X, y, STORM_W, 1, mood);
        p.rect(STORM_X + 2, y, 3, 1, bodyUp ? "#ffb3b3" : "#a8ccff");
        p.rect(STORM_X + STORM_W - 4, y, 3, 1, bodyUp ? "#c0392b" : "#2f6bcc");
      }
    }

    /* 뒤집힌 뒤 — 축포. 다섯 발이 절정 뒤 촘촘히 터진다. */
    if (clear > 0.1) {
      for (let i = 0; i < 5; i += 1) {
        const age = (time - (STORM_FLIP_AT + 400 + i * 300)) / 1000;
        if (age <= 0 || age >= 1) continue;
        const spot = seededRandom(frame.seed + 131 + i * 7);
        drawBurst(p, 14 + spot() * 80, 20 + spot() * 60, age, clear, frame.seed + i, i);
      }
    }

    /*
     * 개미 — 처음 양봉일 땐 그냥 서 있다(`stand`). 무너지기 시작하면 꼬리를 두 팔로
     * 붙잡고 엎드려 버티고(`grip`), 봉이 뒤집혀 솟는 순간 함께 튀어 오르고(`jump`,
     * 불기둥의 hop과 같은 요령이다), 다 오른 뒤엔 일어나 손을 흔든다 — 존버가 옳았다는
     * 인사다 (탑승·롤러코스터와 같은 결론).
     */
    const gripping = time >= STORM_INTRO_END && !up;
    const hop = up && time - STORM_FLIP_AT < 420 ? Math.sin(Math.PI * clamp01((time - STORM_FLIP_AT) / 420)) : 0;
    const lift = Math.round(hop * 10);
    const pose: AntPose =
      time < STORM_INTRO_END ? "stand" : gripping ? "grip" : hop > 0.3 ? "jump" : flip2(time, 300) ? "wave1" : "wave2";

    /*
     * 꼬리가 휘청이는 동안(`wind`) 개미도 덜덜 떤다 — 같은 바람을 맞고 있다는 걸
     * 한 몸으로 보여준다. x·y를 다른 진동수로 흔들어야 한 방향으로 미끄러지는 게
     * 아니라 떠는 것으로 보인다.
     */
    const trembleX = gripping ? Math.round(Math.sin(time * 0.07) * wind) : 0;
    const trembleY = gripping ? Math.round(Math.sin(time * 0.11 + 1.3) * wind * 0.6) : 0;
    p.sprite(antPixels(STORM_STAGE, pose), STORM_ANT_LEFT + trembleX, STORM_ANT_TOP - lift + trembleY, STORM_SCALE);

    /*
     * 눈물 — `grip` 자세(엎드리기)의 눈은 12번 칸·13번 줄에 있다(서 있는 자세의
     * `ANT_EYE`와는 다른 자리다 — 몸이 눕는 자세라 눈도 그쪽 좌표를 쓴다). 두 방울이
     * 시차를 두고 떨어지고, 개미가 떠는 만큼 눈물 자리도 같이 흔들린다.
     */
    if (gripping) {
      const eyeX = STORM_ANT_LEFT + trembleX + 12 * STORM_SCALE + 1;
      const eyeY = STORM_ANT_TOP - lift + trembleY + 13 * STORM_SCALE + 2;
      for (let i = 0; i < 2; i += 1) {
        const age = (time + i * 260) % 520;
        if (age > 420) continue;
        const y = eyeY + 1 + age * 0.045;
        p.rect(eyeX, y, 1, 2, "#4a8fd8");
        p.dot(eyeX, y, "#8fc4f0");
      }
    }

    /* 말풍선 꼬리 자리 — 엎드려 있을 땐 뻗은 팔 위쪽(4번 줄)이 머리다, 그 외엔 정수리 위 */
    const bubbleAt = gripping
      ? { x: STORM_ANT_LEFT + 14 * STORM_SCALE, y: STORM_ANT_TOP + STORM_SCALE - 2 }
      : { x: STORM_ANT_LEFT + 8 * STORM_SCALE, y: STORM_ANT_TOP + 2 * STORM_SCALE - 2 - lift };

    /*
     * 수익률 — 화면 위 가운데, 큼직하게. **계산값이 아니라 대본이다** (남극 탐험의
     * 하락률 자막과 같은 자리) — 이 판은 시세를 안 읽으므로 실제 수익률이 아니라
     * 못박힌 숫자를 센다.
     */
    const pctText = `${percent >= 0 ? "+" : ""}${Math.round(percent)}%`;

    return {
      ...speakCuts(STORM_SCRIPT, frame, STORM_SCRIPT_BOUNDS, bubbleAt.x, bubbleAt.y),
      labels: [{ text: pctText, x: 54, y: 24, alpha: 1, unit: 14, bold: true, color: mood, outline: "#0b0d16" }],
    };
  },
};

/* ════════════════════════════════════════════════════
   21. 일희일비 — 표어는 걸려 있고, 개미는 그걸 안 읽었다
   ════════════════════════════════════════════════════ */

/**
 * 개미가 대형 스크린 앞에 서 있고, 스크린 위에는 **"일희일비 금지"** 표어가 걸려 있다.
 * 그런데 개미는 캔들 하나하나에 춤추고 울고, 장이 조용해지면 졸아버린다 — **표어와
 * 개미의 행동이 어긋나는 게 이 판의 농담 전부다.** 농담이 이미 그림이라 숫자도 지표도
 * 안 얹는다 (물타기·계단과 같은 자리).
 *
 * **아침 9시부터 캔들 스무 개가 차례로 찍히는 하루다.** 시작은 빈 차트와 시계
 * (8:59 → 09:00 → 장시작!)고, 개미는 봉이 다 자란 **뒤에** 반응한다 — 차트가 먼저
 * 보이고 그다음 개미가 반응해야 무엇에 대한 반응인지 읽힌다(코인 상자와 같은 규칙).
 *
 * **차트가 차오르는 건 되돌아오지 않는 움직임이라 한 바퀴 끝이 컷이다** (물타기의 자라는
 * 봉·코인 상자의 여정과 같은 예외). 대신 **마지막 캔들을 횡보로 못박아** 이음매에서 개미가
 * `stand`로 서 있게 했다 — 춤추다 첫 프레임으로 끊기면 그건 컷이 아니라 튄 것으로 보인다.
 */
/**
 * 한 바퀴. **800의 배수여야 한다** — 두 프레임을 갈아끼우는 주기(100·200·400)가 전부
 * 짝수 번 들어가야 이음매에서 개미 자세가 안 튄다. 캔들이 다 찍히고 남는 시간이 꼬리다.
 */
const BOARD_LOOP = 31200;
/** 장 시작 전 (빈 차트 + 시계) */
const BOARD_OPEN_MS = 2400;
const BOARD_CANDLE_MS = 660;
const BOARD_COUNT = 30;

/** 스크린 — 화면(108×192)의 약 70%를 먹는다 */
const BRD_SCREEN = { x: 6, y: 22, w: 96, h: 148 } as const;
/**
 * 표어 판때기. **주식창 위쪽에 걸쳐 앉는다** — 창 위 여백에 얹으면 화면 제목처럼 보이지만,
 * 창을 물고 있으면 사무실 벽에 붙은 팻말이 모니터 앞을 가린 그림이 된다. 그래서 **캔들보다
 * 나중에 그린다** (먼저 그리면 창이 팻말을 덮는다). 아래로 더 내리지는 말 것 — 캔들 꼬리가
 * 올라오는 자리(`BRD_TOP` 위)와 겹치면 팻말이 차트를 먹는다.
 */
const BRD_BANNER = { x: 8, y: 14, w: 92, h: 17 } as const;

/**
 * 캔들 자리. **간격이 정수여야 한다** — 3.5칸 같은 값을 쓰면 반올림이 3칸·4칸을 번갈아
 * 내 차트가 덜그럭거린다. 몸통 5칸이면 꼬리가 정확히 가운데(+2)에 선다.
 */
const BRD_PITCH = 7;
const BRD_BODY_W = 5;
/**
 * 첫 봉이 서는 자리 — **화면 한가운데**다 (몸통 폭의 절반만큼 왼쪽). 실시간 차트처럼
 * 오른쪽으로 뻗어나가야 "지금 찍히는 중"으로 보인다: 스무 개를 창 폭에 미리 나눠 앉히면
 * 다 그려진 차트를 켜놓은 그림이라 시간이 안 흐른다.
 */
const BRD_START = 54 - Math.floor(BRD_BODY_W / 2);
/**
 * 제일 새 봉이 여기 닿으면 **세계가 왼쪽으로 흐르기 시작한다** — 창 오른쪽 끝에 딱
 * 붙이면 다음 봉이 자랄 자리가 없어 매번 잘린 채로 태어난다.
 */
const BRD_RIGHT = 88;
/** 몸통이 앉는 밴드. 꼬리는 이 바깥으로 조금 더 나가므로 위아래로 여유를 남긴다. */
const BRD_TOP = 40;
const BRD_BOTTOM = 92;
const BRD_WICK_MAX = 6;
/** 봉 하나가 다 자라는 데 걸리는 시간 */
const BRD_GROW_MS = 220;

/** 단상 — 개미가 서는 앞턱. 스크린 아래에 깔린다. */
const BRD_FLOOR = 170;

const BRD_SCALE = 3;
const BRD_ANT_LEFT = 30;
/**
 * **개미는 통째로 스크린 앞에 선다.** 발끝이 단상 윗면(=스크린 아래끝)에 딱 닿게 앉혀,
 * 몸 전체가 밝은 창을 등지고 서 있게 한다 — 아래로 내리면 다리가 어두운 단상에 묻혀
 * 개미가 단상 **뒤에** 선 것처럼 보인다 ("개미가 배경에 묻히지 않게"와 같은 규칙).
 */
const BRD_ANT_TOP = BRD_FLOOR - 16 * BRD_SCALE;
/** 흰 창 앞에 서므로 붉은 단계로 둔다 — 창백한 쪽은 흰 바탕에 묻힌다 (불기둥과 같은 이유) */
const BRD_STAGE = 44;

/** 이 안쪽이면 횡보로 친다 (%) */
const BRD_FLAT_PCT = 3;
/** 조는 데 필요한 연속 횡보 수 */
const BRD_DOZE_RUN = 3;
/** 말풍선이 뜰 만한 큰 변동 (%) */
const BRD_BIG_PCT = 9;
/** 한마디가 떠 있는 시간 — 캔들 하나(660ms)로는 알파가 안 차오른다 (아래 `boardChartAt`) */
const BRD_SAY_MS = BOARD_CANDLE_MS * 2;
/** 말과 말 사이 숨. 없으면 조는 동안 말풍선이 쉬지 않고 이어 붙는다. */
const BRD_SAY_GAP = 400;

/*
 * ── 못박은 자리들 ──
 *
 * 서른 봉 중 열둘이 대본이고 나머지는 무작위다. 대본으로 두는 건 **매 판 반드시 나와야
 * 농담이 서는 대목**뿐이다 — 뽑기에 맡기면 어떤 판에는 조는 장면이 아예 안 나오고
 * 어떤 판에는 급등이 두 봉에서 끝난다.
 */
/** 장 시작 두 컷 — 큰 음봉 둘에 고정 대사가 얹힌다 */
const BRD_OPEN_CUTS = 2;
/** 하트를 날리는 봉 — 몸짓과 말("유-후 하트")이 같이 나와야 해서 자리를 못박는다 */
const BRD_HEART_INDEX = 9;
/** 조는 구간 */
const BRD_FLAT_FROM = 12;
const BRD_FLAT_TO = 17;
/** 급등 — **장대양봉 셋이 잇달아 선다.** 개미 둘이 좌우에서 튀어나와 같이 춤추는 대목이다. */
const BRD_RALLY_FROM = 18;
const BRD_RALLY_TO = 20;
/** 못박은 큰 음봉 — 급등 뒤에 한 번 꺾인다 */
const BRD_BIG_DOWN_INDEX = 28;

/**
 * 이 캔들이 횡보인가. **무작위 캔들은 최소 등락이 4%라 횡보가 될 수 없으므로**
 * 못박은 자리만 보면 되고, 그래서 씨앗을 안 봐도 캔들 길이를 미리 정할 수 있다.
 * (`boardChartAt`의 `pct`와 이 함수가 어긋나면 조는 구간과 느린 구간이 따로 논다.)
 */
const brdIsFlat = (i: number) => (i >= BRD_FLAT_FROM && i <= BRD_FLAT_TO) || i === BOARD_COUNT - 1;
const brdIsRally = (i: number) => i >= BRD_RALLY_FROM && i <= BRD_RALLY_TO;

/**
 * **대목의 봉은 두 배로 오래 머문다** (장 시작 두 컷 · 횡보 · 급등). 장이 안 움직이는
 * 구간은 실제로도 길게 느껴지고 조는 연출은 한 박자로 안 읽히며, 급등은 개미 둘이
 * 튀어나와 춤출 시간이 필요하다 — 봉 수를 늘려 그 시간을 버는 대신 봉 하나를 오래 두면
 * 평범한 구간의 봉 수를 안 깎아도 된다.
 */
const brdIsLong = (i: number) => i < BRD_OPEN_CUTS || brdIsFlat(i) || brdIsRally(i);

const BRD_STARTS: readonly number[] = (() => {
  const starts: number[] = [];
  let at = BOARD_OPEN_MS;
  for (let i = 0; i < BOARD_COUNT; i += 1) {
    starts.push(at);
    at += brdIsLong(i) ? BOARD_CANDLE_MS * 2 : BOARD_CANDLE_MS;
  }
  return starts;
})();

/** 마지막 캔들이 끝나는 시각. 남는 시간 동안 말풍선이 지고 개미가 선다. */
const BRD_TAIL_FROM =
  (BRD_STARTS[BOARD_COUNT - 1] ?? BOARD_OPEN_MS) + BOARD_CANDLE_MS * 2;

/** 급등 막의 시작·끝 (ms). 개미 둘이 여기서만 나온다. */
const BRD_RALLY_AT = BRD_STARTS[BRD_RALLY_FROM] ?? 0;
const BRD_RALLY_END = (BRD_STARTS[BRD_RALLY_TO] ?? 0) + BOARD_CANDLE_MS * 2;
/** 좌우 개미가 튀어나오고 물러나는 데 걸리는 시간 */
const BRD_JOIN_MS = 420;

/**
 * **말이 반드시 나와야 하는 봉.** 앞말이 아직 떠 있어도 밀고 들어간다 — 장 시작 두 컷은
 * 순서가 곧 이야기고, 하트와 급등 마지막 봉은 몸짓과 말이 같이 나와야 하는 자리다.
 */
const BRD_MUST_SAY: readonly number[] = [0, 1, BRD_HEART_INDEX, BRD_RALLY_TO];

const brdCandleMs = (i: number) => (brdIsFlat(i) ? BOARD_CANDLE_MS * 2 : BOARD_CANDLE_MS);

interface BoardCandle {
  top: number;
  bottom: number;
  up: boolean;
  wickUp: number;
  wickDown: number;
  /** 등락폭(%). 개미 반응도 횡보 판정도 이 값 하나가 정한다. */
  pct: number;
  /** 반응 고르기 (0~2) — 같은 방향이라도 판마다 다른 몸짓이 나오게 씨앗에서 뽑아둔다 */
  pick: number;
}

interface BoardChart {
  candles: readonly BoardCandle[];
  /** 이 캔들에서 개미가 조는가 (횡보가 `BRD_DOZE_RUN`번 이어진 시점부터) */
  doze: readonly boolean[];
  /** 이 캔들에서 **뜨기 시작하는 한마디**. 안 뜨면 null. */
  says: readonly (string | null)[];
}

/**
 * 씨앗 하나가 하루치 차트를 뽑는다. **스무 개를 한 번에 다 뽑아두고 시간이 흐르는 만큼만
 * 그린다** — 그려진 만큼만 재서 세로 배율을 잡으면 차트가 차오를 때마다 앞 캔들이 위아래로
 * 튄다.
 *
 * **걸음은 곱셈이 아니라 덧셈이다.** `level *= (1 + pct)`로 쌓으면 스무 걸음 뒤 값이 몇
 * 배로 벌어져, 전역 배율에서 낮은 쪽 캔들이 한 줄도 안 되게 눌린다 — `Painter.rect`가
 * 양끝을 반올림하므로 그 캔들은 아예 안 그려진다.
 *
 * **못박는 건 셋뿐이고 나머지는 무작위다** (`BRD_FLAT_FROM`~`BRD_FLAT_TO` 횡보 ·
 * `BRD_STILL_INDEX` 큰 음봉 · 마지막 캔들 횡보). 자연 발생 횡보는 없으므로(최소 등락이
 * 4%다) 조는 구간은 늘 못박은 자리 하나뿐이고, 큰 음봉이 그 구간을 잇거나 쪼갤 일이 없다.
 */
function boardChartAt(seed: number): BoardChart {
  /*
   * **첫 draw를 버린다.** 짤 공장이 주는 씨앗은 1~997이라 `seededRandom`의 첫 값이
   * 0.00002~0.022에 몰려 있다 — 그대로 쓰면 "다시 뽑기"를 눌러도 0번 캔들은 늘 같은
   * 방향에 같은 크기로 나온다. 같은 이유로 캔들마다 `seededRandom(seed + i)`를 새로
   * 만들지 않는다 (이웃 씨앗의 첫 값 차이가 2e-5라 스무 개가 전부 같아진다).
   */
  const random = seededRandom(seed * 7919 + 13);
  random();
  random();

  const pcts: number[] = [];
  for (let i = 0; i < BOARD_COUNT; i += 1) {
    if (brdIsFlat(i)) {
      pcts.push((random() < 0.5 ? -1 : 1) * (0.4 + random() * 2.4));
    } else if (brdIsRally(i)) {
      /* 장대양봉 — 무작위 봉의 최대(13%)보다 확실히 굵어야 셋이 잇달아 선 게 급등으로 읽힌다 */
      pcts.push(12 + random() * 6);
    } else if (i < BRD_OPEN_CUTS || i === BRD_BIG_DOWN_INDEX) {
      pcts.push(-(9 + random() * 4));
    } else if (i === BRD_HEART_INDEX) {
      pcts.push(10 + random() * 3);
    } else {
      pcts.push((random() < 0.5 ? -1 : 1) * (4 + random() * 9));
    }
  }

  /* 종가가 다음 캔들의 시가가 된다 — 그래야 막대그래프가 아니라 차트로 보인다 */
  const levels: number[] = [0];
  for (let i = 0; i < BOARD_COUNT; i += 1) levels.push((levels[i] ?? 0) + (pcts[i] ?? 0));

  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const span = Math.max(1, high - low);
  const toY = (level: number) => BRD_BOTTOM - ((level - low) / span) * (BRD_BOTTOM - BRD_TOP);

  const candles: BoardCandle[] = [];
  for (let i = 0; i < BOARD_COUNT; i += 1) {
    const openY = toY(levels[i] ?? 0);
    const closeY = toY(levels[i + 1] ?? 0);
    const pct = pcts[i] ?? 0;
    const roll = Math.floor(random() * 3);

    candles.push({
      top: Math.min(openY, closeY),
      bottom: Math.max(openY, closeY),
      up: pct > 0,
      wickUp: random() < 0.6 ? 1 + Math.floor(random() * BRD_WICK_MAX) : 0,
      wickDown: random() < 0.6 ? 1 + Math.floor(random() * BRD_WICK_MAX) : 0,
      pct,
      /* 하트 봉은 하트 발사(2), 급등은 셋이 같이 추도록 춤(0)으로 못박는다 */
      pick: i === BRD_HEART_INDEX ? 2 : brdIsRally(i) ? 0 : roll,
    });
  }

  /*
   * 조는 구간은 **여기서 미리 세어둔다.** 그리는 쪽에서 매번 뒤로 거슬러 세면 0·1번
   * 캔들과 장 시작 전 구간에서 경계가 어긋난다.
   */
  const doze: boolean[] = [];
  let run = 0;
  for (const candle of candles) {
    run = Math.abs(candle.pct) <= BRD_FLAT_PCT ? run + 1 : 0;
    doze.push(run >= BRD_DOZE_RUN);
  }

  /*
   * 말풍선은 **큰 변동과 조는 구간에만** 뜬다 — 캔들마다 띄우면 0.66초짜리 문장이라
   * 읽히기 전에 갈리고 화면만 시끄러워진다. 그리고 **한마디가 캔들 둘을 걸친다**:
   * 660ms 안에서 뜨고 지면 `FADE_MS` 때문에 알파가 0.73까지밖에 안 올라, 한 컷 이미지에
   * 반투명한 말풍선이 그대로 박힌다.
   */
  const says: (string | null)[] = [];
  /** 앞말이 지고 숨까지 돌아가는 시각 (ms). 캔들 길이가 제각각이라 칸이 아니라 시각으로 센다. */
  let sayUntil = 0;
  let dozeSaid = 0;

  for (let i = 0; i < BOARD_COUNT; i += 1) {
    const start = BRD_STARTS[i] ?? 0;
    if (start < sayUntil && !BRD_MUST_SAY.includes(i)) {
      says.push(null);
      continue;
    }

    const candle = candles[i];
    const pool: MemeLinePool | null = doze[i]
      ? "boardDoze"
      : candle && Math.abs(candle.pct) >= BRD_BIG_PCT
        ? candle.up
          ? "board"
          : "boardDown"
        : null;

    if (!pool) {
      says.push(null);
      continue;
    }

    /*
     * **몸짓·순서에 매인 말만 뽑지 않는다.** 장 시작 두 컷은 순서가 곧 이야기고, 하트를
     * 날리는 순간과 눈이 감기는 순간은 말이 그림과 같이 나와야 한다 — 풀에 맡기면 그
     * 몸짓이 나온 판에서 엉뚱한 말이 뜨고 정작 이 말은 몇 판에 한 번만 나온다.
     * 나머지는 평소대로 풀에서 뽑는다.
     */
    let text: string;
    if (i < BRD_OPEN_CUTS) {
      text = BOARD_OPEN_SCRIPT[i] ?? "";
    } else if (i === BRD_HEART_INDEX) {
      text = BOARD_CUE_SCRIPT[0] ?? "";
    } else if (pool === "boardDoze" && dozeSaid === 0) {
      text = BOARD_CUE_SCRIPT[1] ?? "";
    } else {
      text = pickMemeLine(pool, seed, i);
    }
    if (pool === "boardDoze") dozeSaid += 1;

    says.push(text);
    sayUntil = start + BRD_SAY_MS + BRD_SAY_GAP;
  }

  return { candles, doze, says };
}

/**
 * 도트 하트 — **스프라이트가 아니라 무대가 그린다** (눈물과 같은 자리). 날아가는 그림은
 * 시간이 있어야 성립하므로 문자맵에 박으면 프레임 수만큼만 날아간다.
 */
const BRD_HEART: readonly string[] = [".x.x.", "xxxxx", "xxxxx", ".xxx.", "..x.."];

function drawHeart(p: Painter, x: number, y: number, color: string): void {
  const left = Math.round(x);
  const top = Math.round(y);

  BRD_HEART.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      if (row[rx] === "x") p.dot(left + rx, top + ry, color);
    }
  });
}

const board: MemeScene = {
  id: "board",
  title: "일희일비",
  blurb: "표어는 일희일비 금지. 개미는 안 읽었다.",
  loopMs: BOARD_LOOP,
  /**
   * 급등 마지막 봉 — **장대양봉 셋이 다 서고 개미 셋이 춤추는 순간**이다. 이 판에서
   * 제일 볼 것이 많은 프레임이라 한 컷 이미지가 여기서 멈춘다 (말풍선도 알파 1이다).
   */
  stillMs: (BRD_STARTS[BRD_RALLY_TO] ?? 0) + 600,

  draw(p, frame) {
    const time = frame.time;
    const chart = boardChartAt(frame.seed);

    /*
     * 지금 몇 번째 캔들인가. **나눗셈으로 못 구한다** — 횡보 봉이 두 배로 머물러 캔들
     * 길이가 제각각이라, 미리 깔아둔 시작 시각(`BRD_STARTS`)을 훑는다. 장 시작 전은 -1이고,
     * 꼬리 구간은 마지막 캔들에 머문다 (그냥 나누면 거기서 20이 나와 배열 밖을 짚는다).
     */
    let index = -1;
    for (let i = 0; i < BOARD_COUNT; i += 1) if (time >= (BRD_STARTS[i] ?? 0)) index = i;
    const inCandle = index < 0 ? 0 : time - (BRD_STARTS[index] ?? 0);
    const candleMs = index < 0 ? BOARD_CANDLE_MS : brdCandleMs(index);

    /* ── 방과 단상 ── */
    p.clear("#1b2130");
    p.rect(0, BRD_FLOOR, p.w, p.h - BRD_FLOOR, "#2b3346");
    /* 단상 윗면 — 개미 발끝이 여기 닿는다. 한 줄 밝혀야 서 있는 턱으로 읽힌다. */
    p.rect(0, BRD_FLOOR, p.w, 2, "#4c5872");
    p.rect(0, BRD_FLOOR, p.w, 1, "#6b7a99");

    /* ── 스크린 ── */
    p.rect(BRD_SCREEN.x - 1, BRD_SCREEN.y - 1, BRD_SCREEN.w + 2, BRD_SCREEN.h + 2, "#39435c");
    p.rect(BRD_SCREEN.x, BRD_SCREEN.y, BRD_SCREEN.w, BRD_SCREEN.h, "#f4f6f9");

    /* 머리띠 — **글자는 안 넣는다.** 종목명을 적으면 남의 계좌 화면이 된다 (불기둥과 같다) */
    p.rect(BRD_SCREEN.x, BRD_SCREEN.y, BRD_SCREEN.w, 5, "#dfe5ee");
    p.rect(BRD_SCREEN.x, BRD_SCREEN.y + 5, BRD_SCREEN.w, 1, "#c3ccdb");
    for (let i = 0; i < 3; i += 1) p.rect(BRD_SCREEN.x + 3 + i * 4, BRD_SCREEN.y + 2, 2, 2, "#b6c0d0");

    /* 눈금 — 흰 바탕만 있으면 차트 창이 아니라 그냥 판때기다 */
    for (let y = BRD_SCREEN.y + 18; y < BRD_SCREEN.y + BRD_SCREEN.h; y += 16) {
      p.rect(BRD_SCREEN.x, y, BRD_SCREEN.w, 1, "#e6eaf1");
    }

    /*
     * ── 캔들 ──
     *
     * 첫 봉은 화면 한가운데 서고 새 봉이 오른쪽으로 붙는다. 제일 새 봉이 `BRD_RIGHT`에
     * 닿으면 **세계가 왼쪽으로 흐르며** 지나간 봉들을 창 밖으로 밀어낸다 — 실시간 차트가
     * 하는 그 움직임이다. 흐름은 봉 단위로 툭툭 끊지 않고 **봉이 자라는 동안 이어서**
     * 민다 (`progress`가 소수를 포함한다) — 칸씩 뛰면 차트가 아니라 슬라이드가 된다.
     */
    const progress = index < 0 ? 0 : Math.min(BOARD_COUNT - 1, index + clamp01(inCandle / candleMs));
    const scroll = Math.max(0, BRD_START + progress * BRD_PITCH - BRD_RIGHT);

    p.clipped(BRD_SCREEN.x, BRD_SCREEN.y + 6, BRD_SCREEN.w, BRD_SCREEN.h - 6, () => {
      /* 세로 눈금도 같이 흘러야 차트가 흐르는 것으로 보인다 (가만히 있으면 봉만 미끄러진다) */
      for (let g = -1; g < 8; g += 1) {
        const gx = BRD_START + (g + Math.floor(scroll / (BRD_PITCH * 3))) * BRD_PITCH * 3 - scroll;
        p.rect(gx, BRD_SCREEN.y + 6, 1, BRD_SCREEN.h - 6, "#eef1f6");
      }

      for (let i = 0; i <= index; i += 1) {
        const candle = chart.candles[i];
        if (!candle) continue;

        /* 지금 찍히는 봉만 자란다 — 다 자란 뒤엔 그대로 선다 */
        const grow = i === index ? clamp01(inCandle / BRD_GROW_MS) : 1;
        const x = BRD_START + i * BRD_PITCH - scroll;
        if (x + BRD_BODY_W < BRD_SCREEN.x || x > BRD_SCREEN.x + BRD_SCREEN.w) continue;
        const color = candle.up ? "#ff5c5c" : "#5c9dff";

        /* **시가에서 종가 쪽으로** 자란다 — 반대로 두면 봉이 하늘에서 내려온다 */
        const from = candle.up ? candle.bottom : candle.top;
        const edge = lerp(from, candle.up ? candle.top : candle.bottom, grow);
        const top = Math.min(from, edge);
        /* 몸통은 한 줄을 보장한다 — 반올림으로 사라지면 횡보 구간이 빈칸이 된다 */
        const height = Math.max(1, Math.abs(edge - from));

        /* 꼬리는 몸통 한가운데 선다 — 몸통 폭이 홀수(5)라 정확히 x+2다 */
        if (candle.wickUp > 0) {
          p.rect(x + 2, top - candle.wickUp * grow, 1, candle.wickUp * grow, color);
        }
        if (candle.wickDown > 0) {
          p.rect(x + 2, top + height, 1, candle.wickDown * grow, color);
        }
        p.rect(x, top, BRD_BODY_W, height, color);
        p.rect(x, top, BRD_BODY_W, 1, candle.up ? "#ff8f8f" : "#8fc4ff");
      }
    });

    /*
     * ── 표어 — 창 앞에 걸린 팻말 ──
     *
     * **캔들 뒤에 그린다.** 창을 물고 앉는 팻말이라 먼저 그리면 창이 덮는다. 창 위로
     * 삐져나온 부분에는 그림자를 안 넣고 **창에 겹친 아래쪽에만** 한 줄 깔아, 벽이 아니라
     * 모니터 앞에 떠 있는 것으로 읽히게 한다. 글자는 아래 `labels`가 얹는다 (판때기는
     * 도트로, 글자는 늘린 뒤에).
     */
    p.rect(BRD_BANNER.x + 2, BRD_BANNER.y + BRD_BANNER.h, BRD_BANNER.w, 2, "#d2d8e2");
    p.rect(BRD_BANNER.x, BRD_BANNER.y, BRD_BANNER.w, BRD_BANNER.h, "#f3ece2");
    p.rect(BRD_BANNER.x, BRD_BANNER.y, BRD_BANNER.w, 2, "#d94b4b");
    p.rect(BRD_BANNER.x, BRD_BANNER.y + BRD_BANNER.h - 2, BRD_BANNER.w, 2, "#d94b4b");

    /*
     * ── 개미 ──
     *
     * **봉이 자라기 시작하고 한 박자 뒤에 반응한다** — 차트가 먼저 보이고 그다음 개미가
     * 움직여야 무엇에 대한 반응인지 읽힌다. 두 프레임을 갈아끼우는 주기(100·200·400)는
     * 전부 루프를 **짝수 번** 나눈다 — 홀수면 이음매에서 자세가 튄다.
     */
    const candle = index >= 0 ? chart.candles[index] : undefined;
    const settled = index >= 0 && inCandle >= BRD_GROW_MS + 30 && time < BRD_TAIL_FROM;

    let pose: AntPose = "stand";
    let shiver = 0;
    let shooting = false;

    if (settled && candle) {
      if (chart.doze[index]) {
        pose = flip2(time, 400) ? "doze1" : "doze2";
      } else if (Math.abs(candle.pct) <= BRD_FLAT_PCT) {
        /* 횡보인데 아직 졸 만큼은 아니다 — 그냥 서서 본다 */
        pose = "stand";
      } else if (candle.up) {
        pose = candle.pick === 0 ? (flip2(time, 200) ? "wave1" : "wave2") : candle.pick === 1 ? "jump" : "shoot";
        shooting = candle.pick === 2;
      } else if (candle.pick === 0) {
        pose = flip2(time, 200) ? "cry1" : "cry2";
      } else {
        pose = "prone";
        /* 엎드려 떨기 — 자세를 새로 그리지 않고 무대가 한 도트씩 흔든다 */
        if (candle.pick === 2) shiver = flip2(time, 100) ? 1 : 0;
      }
    }

    /* 뛰는 동안엔 한 캔들에 두 번 뛴다 */
    const hop = pose === "jump" ? Math.round(Math.abs(Math.sin((inCandle / candleMs) * TAU)) * 5) : 0;
    const antTop = BRD_ANT_TOP - hop;
    const antLeft = BRD_ANT_LEFT + shiver;

    /*
     * ── 급등에 튀어나오는 개미 둘 ──
     *
     * 장대양봉 셋이 서는 동안 **좌우 화면 밖에서 미끄러져 들어와 같이 춤추고 물러난다.**
     * 가운데를 보도록 오른쪽 개미만 뒤집고(`flip`), 둘의 자세를 반 박자 어긋나게 갈아
     * 끼운다 — 같은 프레임을 쓰면 셋이 한 몸처럼 움직여 인형처럼 보인다.
     *
     * 주인공 개미보다 **먼저** 그린다: 겹치는 자리에서 주인공이 앞에 서야 누가 이 판의
     * 개미인지가 안 흔들린다. 발끝은 셋 다 같은 단상 윗면에 둔다.
     */
    if (time >= BRD_RALLY_AT && time < BRD_RALLY_END) {
      const inRally = time - BRD_RALLY_AT;
      const join = Math.min(
        easeOut(clamp01(inRally / BRD_JOIN_MS)),
        easeOut(clamp01((BRD_RALLY_END - time) / BRD_JOIN_MS)),
      );

      for (const mate of [
        { home: 0, from: -34, stage: 46, flip: false, beat: 0 },
        { home: 60, from: 108, stage: 42, flip: true, beat: 100 },
      ]) {
        const x = Math.round(lerp(mate.from, mate.home, join));
        /* 신나서 콩콩 뛴다 — 도트 단위로 끊어야 개미 해상도와 어긋나지 않는다 */
        const bounce = Math.round(Math.abs(Math.sin((time + mate.beat) * 0.012)) * 3);
        const matePose: AntPose = flip2(time + mate.beat, 200) ? "wave1" : "wave2";
        p.sprite(antPixels(mate.stage, matePose), x, BRD_ANT_TOP - bounce, BRD_SCALE, mate.flip);
      }
    }

    p.sprite(antPixels(BRD_STAGE, pose), antLeft, antTop, BRD_SCALE);

    /*
     * 감긴 눈은 **개미 도트보다 얇게 긋는다.** 문자맵 한 칸이 곧 도트 셋(`BRD_SCALE`)이라
     * 그대로 두면 감긴 눈이 뜬 눈만큼 두꺼워 그냥 눈으로 보인다 — 무대가 위아래 한 도트씩을
     * 껍질 색으로 덮어 **가운데 한 줄만** 남긴다. 개미 도트보다 가는 선은 원래 안 만드는
     * 규칙이지만(테두리·외곽선), 여기서는 그 가늚이 곧 "감겼다"는 표시다.
     */
    if (pose === "doze1" || pose === "doze2") {
      const lidRow = pose === "doze1" ? 3 : 2;
      const lidX = antLeft + ANT_EYE.x * BRD_SCALE;
      const lidY = antTop + lidRow * BRD_SCALE;
      const skin = antPalette(BRD_STAGE).head;
      p.rect(lidX, lidY, BRD_SCALE * 2, 1, skin);
      p.rect(lidX, lidY + 2, BRD_SCALE * 2, 1, skin);
    }

    /* 눈물 — 무대가 눈(e) 좌표에서 흘려보낸다 */
    if (pose === "cry1" || pose === "cry2") {
      const eyeX = antLeft + ANT_EYE.x * BRD_SCALE + 1;
      const eyeY = antTop + (ANT_EYE.y + 1) * BRD_SCALE;
      for (let i = 0; i < 2; i += 1) {
        const age = (time + i * 260) % 520;
        if (age > 420) continue;
        p.rect(eyeX, eyeY + age * 0.05, 1, 2, "#4a8fd8");
      }
    }

    /* 하트 — 뻗은 손끝(14, 7)에서 앞위로 날아간다 */
    if (shooting) {
      const fromX = antLeft + 14 * BRD_SCALE;
      const fromY = antTop + 7 * BRD_SCALE;
      for (let i = 0; i < 3; i += 1) {
        const born = inCandle - BRD_GROW_MS + i * 150;
        if (born < 0) continue;
        const age = (born % 600) / 600;
        drawHeart(p, fromX + age * 26, fromY - age * 20 - 2, age < 0.7 ? "#ff5c7a" : "#ffa8bd");
      }
    }

    /*
     * ── 무대 글자 ──
     *
     * 표어를 두 토막으로 나눈 건 가운데 공백 때문에 글자 폭 합이 소수가 되어서다 —
     * `drawLabels`는 가운데 정렬로 한 번에 찍으므로 폭이 정수가 아니면 모든 글자가 소수
     * 좌표에 앉아 픽셀 폰트가 흐려진다. 문자열은 `meme-lines.ts`에 있다 (폰트 서브셋이
     * 글자를 긁어가는 파일이 거기라서).
     */
    const labels: SceneLabel[] = [
      { text: BOARD_MOTTO[0], x: 39, y: BRD_BANNER.y + 2, alpha: 1, unit: 11, bold: true },
      { text: BOARD_MOTTO[1], x: 80, y: BRD_BANNER.y + 2, alpha: 1, unit: 11, bold: true },
    ];

    if (index < 0) {
      /* 장 시작 전 — 빈 차트 위에서 시계가 넘어간다 */
      const step = time < 900 ? 0 : time < 1500 ? 1 : 2;
      labels.push({
        text: BOARD_CLOCK[step] ?? "",
        x: 54,
        y: 60,
        alpha: 1,
        unit: 12,
        bold: step === 2,
        color: step === 2 ? "#d94b4b" : "#7b8aa3",
      });
    }

    /*
     * 말풍선 — **박자가 아니라 캔들 사건에 걸린다** (코인 상자가 상자를 박을 때 말하는
     * 것과 같은 손). 지금 캔들이나 바로 앞 캔들에서 시작한 말이 아직 떠 있으면 그걸 띄운다.
     */
    let bubble = { text: "", x: 54, y: 120, alpha: 0 };

    for (let i = Math.max(0, index - 1); i <= index; i += 1) {
      const text = chart.says[i];
      if (!text) continue;

      const inSay = time - (BRD_STARTS[i] ?? 0);
      if (inSay < 0 || inSay >= BRD_SAY_MS) continue;

      /* 엎드리면 머리가 오른쪽 끝에 온다 — 꼬리를 정수리 위에 두면 빈자리에 뜬다 */
      const at =
        pose === "prone"
          ? { x: antLeft + 13 * BRD_SCALE, y: antTop + 11 * BRD_SCALE - 2 }
          : { x: antLeft + 8 * BRD_SCALE, y: antTop + 2 * BRD_SCALE - 2 };

      bubble = {
        text,
        x: at.x,
        y: at.y,
        alpha: clamp01(Math.min(inSay, BRD_SAY_MS - inSay) / FADE_MS),
      };
    }

    return { ...bubble, labels };
  },
};

/* ════════════════════════════════════════════════════
   22. 세계의 개미들 — 나라마다 개미를 부르는 이름이 다르다
   ════════════════════════════════════════════════════ */

/**
 * 한국은 개미, 중국은 부추(韭菜), 일본은 메뚜기(イナゴ), 브라질은 정어리(sardinha),
 * 미국은 유인원(ape), 러시아는 햄스터(хомяк)다. **이름이 곧 그 나라 개인투자자가 당하는
 * 방식이라** 몸짓도 거기서 나온다 — 부추는 잘려도 또 자라고, 메뚜기는 떼로 몰리고,
 * 정어리는 고래가 무섭고, 유인원은 뭉치고, 햄스터는 볼에 쟁인다.
 *
 * **캐릭터가 로테이션되는 판이다.** 여섯이 차례로 나와 제 몸짓을 하고 제 한마디를 한다.
 * 컷마다 캐릭터가 들어왔다 나가므로 **한 바퀴 끝도 시작도 빈 무대라 이음매가 저절로 맞는다.**
 *
 * **무대는 하나로 공유한다** — 배경까지 컷마다 새로 지으면 여섯 판을 만든 셈이고,
 * 로테이션이 아니라 슬라이드쇼로 보인다. 컷이 더하는 건 소품뿐이다 (가위 · 좌우 양봉 ·
 * 고래 그림자 · 바닥에 널린 봉). 정어리 컷만 배경을 물빛으로 물들이는데, 고래가 무섭다는
 * 말이 물속이라야 서기 때문이다 — 색만 갈아끼우는 거라 무대를 새로 짓는 건 아니다.
 */
const WORLD_CUT_MS = 5000;
const WORLD_ACTS = 6;
/** 800의 배수라 두 프레임을 갈아끼우는 주기(100·200·400)가 짝수 번 들어간다 */
const WORLD_LOOP = WORLD_CUT_MS * WORLD_ACTS;
/** 캐릭터가 들어오고 물러나는 데 걸리는 시간 */
const WLD_IN_MS = 400;
const WLD_OUT_AT = WORLD_CUT_MS - 600;
/** 말풍선이 뜨는 창 — 양끝에서 알파가 0이라 컷 전환에서 안 튄다 */
const WLD_SAY_FROM = 600;
const WLD_SAY_TO = 4300;

/**
 * **바닥선.** 아래 흙 띠가 화면(192칸)의 나머지라, 이 값을 내리면 띠가 얇아지고 하늘이
 * 넓어진다 — 캐릭터·봉·이름판이 전부 여기서 파생되므로 같이 내려간다. 42칸이던 띠를
 * 28칸으로 줄인 자리다.
 */
const WLD_GROUND = 164;
/**
 * **몸은 32칸 격자에 배율 2로 찍는다** — 16칸 × 3과 화면 크기는 비슷하고 그 안의 도트만
 * 잘아져, 눈·팔·잎처럼 한두 칸으로는 못 그리던 게 들어간다. 개미만 16칸 몸이라 배율 4로
 * 키를 맞춘다(그래서 개미 컷만 도트가 굵다 — 앱 개미와 같은 몸을 쓰는 값이다).
 */
const WLD_SCALE = 2;
const WLD_BODY = 32;
/** 몸이 바닥선에 발을 딛는 자리 */
const WLD_TOP = WLD_GROUND - WLD_BODY * WLD_SCALE;
const WLD_MID = 54;
/** 32칸 몸의 왼쪽 끝 */
const WLD_LEFT = WLD_MID - (WLD_BODY / 2) * WLD_SCALE;

/* 국기와 두 이름의 자리 — 위는 "어느 나라", 아래 땅은 "거기선 뭐라 부르나" */
const WLD_FLAG_K = 1;
const WLD_FLAG_LEFT = WLD_MID - (FLAG_W / 2) * WLD_FLAG_K;
/* 말풍선이 덮지 않게 30칸 내려 앉힌다 — 예전엔 국기가 말풍선 뒤로 들어가 띠처럼 보였다 */
const WLD_FLAG_TOP = 36;
const WLD_NAME_Y = 171;

interface WorldAct {
  flag: FlagId;
  /** 물속 컷인가 (정어리만) */
  water?: boolean;
  /** 말풍선 꼬리가 붙을 자리 */
  say: { x: number; y: number };
  /**
   * 컷 안에서의 시간(`t`)만 받는다 — 전역 시간을 넘기면 컷마다 위상이 달라진다.
   *
   * **글자를 돌려줄 수 있다.** 컷 안에서 움직이는 것에 딸리는 글자(곁 원숭이의 "우끼")는
   * 그 자리를 컷만 아는데, 바깥에서 만드는 `labels`는 그 좌표를 모른다.
   */
  draw(p: Painter, t: number, frame: SceneFrame, enter: number): SceneLabel[] | void;
}

/**
 * **여섯 컷이 공통으로 깔고 가는 배경 차트.** 나라가 바뀌어도 뒤에 서 있는 건 같은 시장이라,
 * 이 한 줄이 여섯 컷을 한 판으로 묶는다 — 컷마다 배경을 새로 지으면 로테이션이 아니라
 * 슬라이드쇼가 된다.
 *
 * **캐릭터보다 먼저 그리고, 투명도가 아니라 색으로 뒤에 놓는다** (아래 `WLD_BACK_TONES`).
 *
 * 높이는 **못박은 배열**이다. 다시 뽑을 때마다 지형이 바뀌면 배경이 아니라 사건이 된다
 * (코인 상자의 캔들 스카이라인과 같은 대우).
 */
const WLD_BACK_CHART: readonly number[] = [30, 44, 38, 56, 48, 68, 60, 78, 70, 62, 74, 88];

/**
 * 배경 차트의 색. **투명도로 뒤에 놓지 않는다** — 반투명은 앞의 것이 지나갈 때마다 색이
 * 섞여, 배경이 아니라 앞 오브젝트에 얹힌 무늬처럼 보인다. 대신 **하늘빛에 가까운 색을
 * 그대로 칠해** 배경으로만 서게 한다: 앞의 봉이 쓰는 선명한 빨강·파랑(`#ff5c5c`/`#5c9dff`)과
 * 한눈에 갈리는 흐린 색이라, 겹쳐 서도 무엇이 앞인지가 안 헷갈린다.
 *
 * 물속은 바탕이 어두우므로 **더 어두운 쪽으로** 흐린다 — 밝게 하면 물 위에 뜬 것으로 보이고,
 * 그 밝기대는 고래가 이미 쓰고 있다.
 */
const WLD_BACK_TONES = {
  land: { up: "#e2c6cc", down: "#c6d3e8" },
  water: { up: "#245f8f", down: "#1b5079" },
} as const;

function drawWorldBackChart(p: Painter, t: number, water: boolean): void {
  const tone = water ? WLD_BACK_TONES.water : WLD_BACK_TONES.land;
  /** 값 하나가 앉는 화면 높이 */
  const at = (level: number) => WLD_GROUND - 6 - level;

  WLD_BACK_CHART.forEach((close, i) => {
    /*
     * **봉마다 시작하는 높이가 다르다.** 예전엔 전부 땅에서 올라와 밑동이 한 줄로 늘어서,
     * 차트가 아니라 울타리로 보였다 — 실제 차트는 앞 봉이 끝난 값에서 다음 봉이 시작하므로,
     * 여기서도 **앞 값이 시가, 지금 값이 종가**다. 그러면 밑동도 꼭대기도 저마다 달라진다.
     */
    const open = WLD_BACK_CHART[i - 1] ?? close - 10;
    const up = close >= open;
    const color = up ? tone.up : tone.down;

    /*
     * **은은하게 숨쉰다.** 봉마다 위상을 어긋나게 줘서 차트 전체가 한 덩이로 오르내리지
     * 않게 하고, 흔들림은 **도트 단위로 끊는다** (소수로 두면 봉 가장자리가 프레임마다
     * 흐려진다). 한 컷에 **정수 번** 돌아야 컷이 바뀌는 자리에서 안 튄다.
     */
    const breathe = Math.round(Math.sin((t / WORLD_CUT_MS) * TAU * 2 + i * 0.55) * 2);

    const x = 2 + i * 9;
    const top = at(Math.max(open, close)) + breathe;
    /* 몸통은 한 줄을 보장한다 — 시가와 종가가 같으면 아예 안 그려진다 */
    const body = Math.max(2, Math.abs(close - open));

    /* 꼬리 — 몸통 위아래로 삐져나와야 봉으로 읽힌다 */
    p.rect(x + 3, top - 4, 1, body + 8, color);
    p.rect(x, top, 7, body, color);
  });
}

/** 바닥에 눕히는 작은 봉 — 햄스터가 주워 담고, 메뚜기가 몰려가는 그 봉이다 */
function drawWorldCandle(p: Painter, x: number, bottom: number, h: number, up: boolean): void {
  const color = up ? "#ff5c5c" : "#5c9dff";
  p.rect(x + 2, bottom - h - 3, 1, h + 6, color);
  p.rect(x, bottom - h, 5, h, color);
  p.rect(x, bottom - h, 5, 1, up ? "#ff8f8f" : "#8fc4ff");
}

/** 가위 — 부추를 자르러 오른쪽에서 들어온다. 도트 그림이 회전을 못 하므로 벌림만 바꾼다. */
function drawScissors(p: Painter, x: number, y: number, open: number): void {
  const gap = Math.round(open * 3);

  for (const side of [-1, 1]) {
    p.rect(x, y + side * gap - 1, 13, 2, "#b8c0cc");
    p.rect(x + 11, y + side * gap - 1, 2, 2, "#8b96a6");
  }
  p.rect(x + 13, y - 3, 2, 7, "#6b7484");
  p.disc(x + 18, y - 4, 3, "#d94b4b");
  p.disc(x + 18, y + 4, 3, "#d94b4b");
}

const WORLD_ACT_LIST: readonly WorldAct[] = [
  /* 1. 개미 (한국) — 오늘도 판다. 이 앱의 주인공이라 맨 앞에 세운다. */
  {
    flag: "kr",
    say: { x: WLD_MID, y: WLD_TOP + 8 },
    draw(p, t, frame, enter) {
      /*
       * **여기 개미는 32칸 몸이다** (`ANT_BIG_ROWS`). 16칸 몸을 배율 4로 키우면 도트만
       * 굵어져서 32칸으로 그린 다른 나라 캐릭터들 옆에서 혼자 뭉툭하다 — 클로즈업 얼굴이
       * 도트를 키우는 대신 쪼개는 것과 같은 자리다. 색은 같은 `antPalette`에서 갈라진다.
       */
      const left = WLD_LEFT;
      const top = WLD_TOP + Math.round((1 - enter) * 40);
      const key = antBigKey(44);

      /*
       * **뒤에서도 다른 개미들이 판다** — 혼자 파면 굴이 아니라 마당이다.
       *
       * 크기는 **배율 1**이다(주인공의 절반). 스프라이트 배율은 정수뿐이라 0.6배 같은 값은
       * 없고, 소수로 그리면 도트가 정수 픽셀에 안 떨어져 뒷개미만 흐려진다 — 도트 그림에서
       * "조금 작게"는 없다.
       *
       * **주인공보다 먼저 그린다** (뒤에 서야 한다). 곡괭이질도 박자를 어긋나게 줘야 셋이
       * 한 몸처럼 안 움직인다.
       */
      for (const [bx, phase] of [
        [-4, 70],
        [80, 130],
      ] as const) {
        const small = WLD_GROUND - 32;
        drawRows(p, antBigPoseRows(flip2(t + phase, 200) ? "dig1" : "dig2"), key, bx, small, 1);

        /* 튀는 흙은 뒤에서도 조금 — 동전은 안 준다 (그건 주인공 몫이다) */
        for (let i = 0; i < 2; i += 1) {
          const age = ((t + phase + i * 260) % 700) / 700;
          p.rect(
            bx + 28 + Math.round(age * 6),
            WLD_GROUND - 3 - Math.round(Math.sin(age * Math.PI) * 6),
            2,
            2,
            "#a98b5f",
          );
        }
      }

      /* 파는 건 팔뿐이다 — 몸통을 좌표까지 물려받은 두 프레임을 갈아끼운다 */
      drawRows(p, antBigPoseRows(flip2(t, 200) ? "dig1" : "dig2"), key, left, top, WLD_SCALE);

      /*
       * 튀는 흙 — 곡괭이 끝(오른쪽)에서만 튄다. **셋에 하나는 동전이다**: 파는 게 헛수고가
       * 아니라는 게 이 컷의 농담이라, 흙만 튀면 그냥 삽질하는 그림이 된다. 동전도 흙과 같은
       * 포물선을 타야 같이 튀어나온 것으로 읽힌다 — 따로 띄우면 허공에서 생긴 것으로 보인다.
       */
      const random = seededRandom(frame.seed + 3);
      for (let i = 0; i < 7; i += 1) {
        const age = ((t + i * 140) % 760) / 760;
        const r = random();
        const x = left + 28 * WLD_SCALE + Math.round(age * (6 + r * 12));
        const y = WLD_GROUND - 4 - Math.round(Math.sin(age * Math.PI) * (10 + r * 8));

        if (i % 3 === 0) {
          /* 동전 — 흙보다 한 칸 크고 위쪽에 빛 한 점을 둔다 */
          p.rect(x, y, 3, 3, "#e8b53c");
          p.rect(x, y, 3, 1, "#ffe08a");
        } else {
          p.rect(x, y, 2, 2, "#a98b5f");
        }
      }
    },
  },

  /* 2. 부추 (중국) — 가위가 끝을 자르면 또 자란다. 한 컷에 두 번 당한다. */
  {
    flag: "cn",
    /* 가위가 오른쪽에서 들어오므로 말풍선은 가운데다 — 오른쪽에 두면 가위를 덮는다 */
    say: { x: WLD_MID, y: WLD_TOP + 12 },
    draw(p, t, _frame, enter) {
      /*
       * **좌우로 살랑인다.** 흔들림은 도트 단위로 끊고(소수로 두면 잎 가장자리가 프레임마다
       * 흐려진다) 한 컷 안에서 정수 번 돌게 주기를 잡는다.
       */
      const sway = Math.round(Math.sin((t / 1000) * Math.PI * 2) * 2);
      const left = WLD_LEFT + sway;
      const top = WLD_TOP + Math.round((1 - enter) * 40);

      /* 한 번 잘리고 다 자라기까지가 한 돌이다 */
      const cycle = 1500;
      const c = Math.max(0, t - WLD_IN_MS) % cycle;
      const snip = 520;
      const grown = c < snip ? 1 : easeOut(Math.min(1, (c - snip) / (cycle - snip - 120))) * 0.75 + 0.25;

      drawChive(p, left, top, WLD_SCALE, grown);

      /*
       * 가위는 자르기 직전에 다가와 그 순간 닫힌다 — 닫힌 채로 오면 뭘 했는지가 안 남는다.
       *
       * **높이는 자르기 전 잎 끝에 못박는다.** 지금 자란 높이를 따라가게 두면 잘리는 순간
       * 잎이 짧아지면서 가위가 같이 뚝 떨어져, 자른 게 아니라 순간이동한 것으로 보인다.
       * 좌우로는 살랑이는 몸을 따라간다 (안 따라가면 가위만 제자리에 붙박여 어긋난다).
       */
      if (c < snip + 260) {
        const near = clamp01(c / snip);
        const cutY = chiveCutY(top, WLD_SCALE, 1) + 4;
        drawScissors(
          p,
          Math.round(lerp(108, WLD_MID + 12, easeOut(near))) + sway,
          cutY,
          c >= snip ? 0 : 1,
        );
      }
    },
  },

  /* 3. 메뚜기 (일본) — 양봉이 서는 쪽으로 셋이 뛴다. 그게 파래지면 반대쪽으로 또 뛴다. */
  {
    flag: "jp",
    /* 국기 아래로 물린다 — 위에 두면 두 줄짜리 말풍선이 국기를 덮는다 */
    say: { x: WLD_MID, y: 100 },
    draw(p, t, _frame, enter) {
      /* 한 번 뛰고 내려앉기까지가 한 돌 — 뛰는 쪽이 양봉(빨강), 두고 온 쪽이 음봉(파랑) */
      /* 컷 안에서 정확히 두 번 건너뛴다 — 남는 시간(컷 − 등장)을 반으로 나눈 값이다 */
      const swing = Math.max(0, t - WLD_IN_MS) / ((WORLD_CUT_MS - WLD_IN_MS) / 2);
      const toRight = Math.floor(swing) % 2 === 1;
      const at = easeInOut(clamp01((swing % 1) * 1.5));

      /*
       * **봉은 뛰는 쪽만 붉다.** 색이 뒤집히는 걸 보고 방향을 바꾸는 판이라, 두 봉이 같은
       * 색이면 왜 옮겨 가는지가 안 보인다.
       */
      /* 봉을 안쪽으로 물린다 — 메뚜기가 32칸이라 봉이 가장자리에 붙으면 몸이 잘린다 */
      drawWorldCandle(p, 28, WLD_GROUND, toRight ? 14 : 30, !toRight);
      drawWorldCandle(p, 76, WLD_GROUND, toRight ? 30 : 14, toRight);

      /* 가운데 놈이 봉에 앉게 잡은 값 — 나머지 둘은 그 앞뒤로 어긋나 붙는다 */
      const from = toRight ? 0 : 48;
      const to = toRight ? 48 : 0;

      /*
       * **메뚜기는 들고 나갈 때 아래로 안 떨어진다.** 다른 컷은 캐릭터를 화면 밖으로 내려
       * 보내며 퇴장하는데(발이 땅에 붙어 있으니 그게 맞다), 이쪽은 공중에 뜬 채라 같은 손을
       * 쓰면 **뛰다 말고 추락하는 그림**이 된다 — 실제로 한쪽에 닿을 때마다 바닥 밖으로
       * 떨어졌다. 자리는 두고 흐려지게만 한다.
       */
      p.faded(enter, () => {
        for (let i = 0; i < 3; i += 1) {
          /* 셋이 반 박자씩 어긋나 뛴다 — 같이 뛰면 세 마리가 한 몸처럼 보인다 */
          const lag = i * 0.14;
          const step = clamp01((at - lag) / (1 - lag));
          /*
           * **박자만 어긋나게 해서는 안 겹치게 못 한다.** 앞선 놈이 먼저 닿아도 뒤엣놈이
           * 따라와 결국 같은 자리에 포개진다 — 실제로 셋이 한 마리처럼 뭉쳐 보였다.
           * 그래서 **자리 자체를 어긋나게** 준다: 가로로 한 몸의 3분의 1(12칸), 세로로
           * 반 몸(10칸)씩 물려 셋이 늘 떨어져 있게 한다.
           */
          const x = Math.round(lerp(from, to, step)) + i * 12;
          /*
           * **가는 건 좌우다.** 포물선은 건너뛰는 표시로만 얕게 준다 — 깊게 주면 옆으로
           * 가는 게 아니라 오르내리는 그림이 된다.
           */
          const arc = Math.round(Math.sin(step * Math.PI) * 14);

          drawLocust(p, x, WLD_GROUND - 26 - arc - i * 10, 1, !toRight);
        }
      });
    },
  },

  /* 4. 정어리 (브라질) — 셋이 벌벌 떤다. 뒤로 고래가 지나간다. */
  {
    flag: "br",
    water: true,
    /* 정어리 머리 바로 위 — 더 띄우면 누가 하는 말인지가 안 붙는다 (국기까지는 아직 여유가 있다) */
    say: { x: WLD_MID, y: 104 },
    draw(p, t, _frame, enter) {
      /* 고래는 **정어리보다 먼저** 그린다 — 뒤에 있어야 그림자로 읽힌다 */
      const swim = clamp01((t - 700) / (WORLD_CUT_MS - 1100));
      const wx = Math.round(lerp(108, -100, swim));
      /*
       * **배율 2다.** 도트 그림이라 배율은 정수뿐이라서 2.5배는 못 넣는다 — 48칸 몸이
       * 96칸이 되어 화면 폭(108칸)을 거의 채우므로, 여기가 이 판에서 키울 수 있는 끝이다.
       */
      const whaleK = 2;
      const whaleTop = 58;
      drawWhale(p, wx, whaleTop, whaleK);

      /* 눈빛 — 반짝이는 건 시간 위에서만 성립해 문자맵에 못 넣는다 (눈물·하트와 같은 자리) */
      if (flip2(t, 260)) {
        const ex = wx + WHALE_EYE.x * whaleK;
        const ey = whaleTop + WHALE_EYE.y * whaleK;
        p.rect(ex, ey - whaleK, whaleK, whaleK, "#eaf4ff");
        p.rect(ex + whaleK, ey, whaleK, whaleK, "#ffffff");
      }

      const drop = Math.round((1 - enter) * 50);
      for (let i = 0; i < 3; i += 1) {
        /* 벌벌 — 도트 하나씩만 떤다. 소수로 흔들면 은빛 몸이 프레임마다 뭉개진다. */
        const shake = flip2(t + i * 53, 100) ? 1 : 0;
        const shakeY = flip2(t + i * 37, 100) ? 0 : 1;

        /*
         * **셋이 화면 안에 다 들어와야 한다.** 한 마리가 44칸이라 26칸 간격으로 셋을 놓으면
         * 오른쪽 끝이 108칸 밖으로 나가 꼬리가 잘렸다 — 무리 전체 폭(26×2 + 44 = 96)을
         * 재서 가운데에 앉힌다. 배율이 이미 1이라 더 줄일 수는 없다.
         */
        drawSardine(p, 6 + i * 26 + shake, 110 + (i % 2) * 16 + shakeY + drop, 1, false);
      }
    },
  },

  /* 5. 유인원 (미국) — 부르면 모여든다. */
  {
    flag: "us",
    say: { x: WLD_MID, y: WLD_TOP + 2 },
    draw(p, t, _frame, enter) {
      const gather = easeOut(clamp01((t - WLD_IN_MS) / 2200));
      const said: SceneLabel[] = [];

      /* 작은 유인원들이 좌우에서 붙는다 — 큰 놈보다 먼저 그려 뒤에 서게 한다 */
      for (let i = 0; i < 4; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const rank = Math.floor(i / 2);
        const home = WLD_MID + side * (30 + rank * 16);
        const x = Math.round(lerp(WLD_MID + side * 100, home, gather)) - 16;
        const bob = flip2(t + i * 90, 200) ? 0 : 2;

        drawApe(p, x, WLD_GROUND - 32 - bob, 1, false, side > 0);

        /*
         * **앞줄 둘만 말한다** (rank 0). 넷이 다 떠들면 화면이 말풍선으로 덮이고, 뒷줄은
         * 앞줄에 가려 꼬리가 어디서 나온 건지도 안 보인다.
         *
         * 판때기는 **무대가 도트로 그리고 글자만 얹는다** (역 이름 간판과 같은 손). 주인공
         * 말풍선보다 작아야 곁말로 읽혀서, 크기도 글자도 한 단 낮춘다.
         */
        if (rank > 0 || gather < 0.85) continue;

        const cx = x + 16;
        const boxY = WLD_GROUND - 32 - bob - 15;
        p.rect(cx - 12, boxY, 24, 12, "#f6efe2");
        p.rect(cx - 12, boxY, 24, 1, "#c9bda6");
        p.rect(cx - 12, boxY + 11, 24, 1, "#c9bda6");
        p.rect(cx - 2, boxY + 12, 4, 2, "#f6efe2");
        p.rect(cx - 1, boxY + 14, 2, 1, "#f6efe2");

        said.push({
          text: APE_CHEER,
          x: cx,
          y: boxY + 2,
          alpha: 1,
          unit: 7,
          color: "#2b3346",
        });
      }

      drawApe(p, WLD_LEFT, WLD_TOP + Math.round((1 - enter) * 40), WLD_SCALE, flip2(t, 400));

      return said;
    },
  },

  /* 6. 햄스터 (러시아) — 차트를 두 손에 쥐고 흔든다. 흔들수록 볼이 부푼다. */
  {
    flag: "ru",
    say: { x: WLD_MID, y: WLD_TOP + 2 },
    draw(p, t, frame, enter) {
      const drop = Math.round((1 - enter) * 40);
      const top = WLD_TOP + drop;

      /*
       * 발밑에 작은 봉을 깔아둔다 — **볼에 쟁여둔 것들**이라 이 컷에서만 바닥에 쌓인다.
       * 양봉·음봉을 섞어야 쟁여둔 게 차트로 읽힌다 (다 빨가면 전리품 더미로만 보인다).
       *
       * **`seededRandom`으로 뽑는다** — `Math.random()`을 그리는 중에 부르면 1초에 60번
       * 자리가 바뀌어 발밑이 지글거리고, 미리보기와 녹화본이 달라진다.
       */
      const stash = seededRandom(frame.seed + 29);
      for (let i = 0; i < 8; i += 1) {
        drawWorldCandle(p, 4 + i * 13, WLD_GROUND + 3, 4 + Math.round(stash() * 7), stash() > 0.45);
      }

      /* 씹는 박자 — 루프를 짝수로 나누는 주기라야 한 바퀴 끝에서 자세가 안 튄다 */
      const chew = flip2(t, 200);

      drawHamster(p, WLD_LEFT, top, WLD_SCALE, clamp01((t - WLD_IN_MS) / 2400), chew);

      /*
       * **차트는 햄스터보다 앞이다.** 두 손으로 쥔 물건이라 몸 뒤로 가면 쥔 것으로 안 읽힌다 —
       * 몸을 먼저 찍고 그 위에 얹는다. 손이 붙는 자리(문자맵 17~21줄, 왼 9칸 · 오른 22칸)에
       * 맞춰 판을 걸치므로 **얼굴을 다시 그리면 이 좌표도 같이 잰다.**
       *
       * 흔드는 건 판뿐이다 — 몸까지 같이 흔들면 흔드는 게 아니라 화면이 떠는 것으로 보인다.
       */
      const shake = chew ? 1 : 0;
      /*
       * **쥔 건 차트 한 판이 아니라 봉 하나다.** 여러 개를 그리면 판때기를 든 것으로 읽혀
       * "봉을 쥐었다"가 안 남는다 — 두 손 사이에 한 자루만 세우고 그걸 흔든다.
       */
      const barX = WLD_LEFT + 13 * WLD_SCALE;
      /*
       * **손 높이에 맞춰 내린다.** 위로 올리면 봉이 코를 덮어 먹는 얼굴이 통째로 가려진다 —
       * 쥔 손(문자맵 17~21줄)에 걸치는 자리가 곧 이 봉의 자리다.
       */
      const barTop = top + 17 * WLD_SCALE + shake;
      const barW = 6 * WLD_SCALE;
      const barH = 11 * WLD_SCALE;

      /* 꼬리 — 몸통 위아래로 삐져나온다 (이게 없으면 그냥 막대다) */
      p.rect(barX + barW / 2 - 1, barTop - 5, 2, barH + 10, "#d94b4b");
      p.rect(barX, barTop, barW, barH, "#d94b4b");
      p.rect(barX, barTop, barW, 2, "#ff8f8f");
    },
  },
];

const world: MemeScene = {
  id: "world",
  title: "세계의 개미들",
  blurb: "부추, 메뚜기, 정어리, 유인원, 햄스터. 나라마다 이름이 다르다.",
  loopMs: WORLD_LOOP,
  /** 햄스터 볼이 다 부푼 순간 — 한 컷으로 제일 웃긴 그림이다 */
  stillMs: WORLD_CUT_MS * 5 + 2600,

  draw(p, frame) {
    const time = frame.time;
    /* 마지막 프레임에서 6이 나와 배열 밖을 짚으므로 끝을 잘라 쓴다 */
    const index = Math.min(WORLD_ACTS - 1, Math.floor(time / WORLD_CUT_MS));
    const t = time - index * WORLD_CUT_MS;
    const act = WORLD_ACT_LIST[index];
    if (!act) return { text: "", x: WLD_MID, y: 100, alpha: 0 };

    /* 들어왔다 물러나는 정도 (0~1). 컷 양끝이 0이라 전환이 저절로 맞는다. */
    const enter = Math.min(
      easeOut(clamp01(t / WLD_IN_MS)),
      easeOut(clamp01((WORLD_CUT_MS - t) / (WORLD_CUT_MS - WLD_OUT_AT))),
    );

    /* ── 무대 ── */
    if (act.water) {
      p.vGradient(0, p.h, "#2a6ea8", "#124a76");
      /* 물속에도 바닥은 있어야 캐릭터가 떠 있는 게 아니라 잠긴 것으로 보인다 */
      p.rect(0, WLD_GROUND + 18, p.w, p.h - WLD_GROUND - 18, "#0e3a5c");
    } else {
      p.vGradient(0, WLD_GROUND, "#dbe7f7", "#f4f8fd");
      p.rect(0, WLD_GROUND, p.w, p.h - WLD_GROUND, "#c2a878");
      p.rect(0, WLD_GROUND, p.w, 2, "#a98b5f");
    }

    drawWorldBackChart(p, t, !!act.water);

    const extra = act.draw(p, t, frame, enter) ?? [];

    /* ── 국기 ── (나라 이름은 그 위, 캐릭터 이름은 아래 땅에 — 아래 `labels`) */
    p.faded(enter, () => drawFlag(p, act.flag, WLD_FLAG_LEFT, WLD_FLAG_TOP, WLD_FLAG_K));

    /* 캐릭터 이름이 앉는 땅 위 판때기 — 흙빛 위의 먹색 글자는 안 읽힌다 */
    p.rect(WLD_MID - 26, WLD_NAME_Y - 3, 52, 15, act.water ? "#0b3350" : "#8f7448");
    p.rect(WLD_MID - 26, WLD_NAME_Y - 3, 52, 1, act.water ? "#1d5c86" : "#a98b5f");

    return {
      text: WORLD_SCRIPT[index] ?? "",
      x: act.say.x,
      y: act.say.y,
      alpha:
        t < WLD_SAY_FROM || t > WLD_SAY_TO
          ? 0
          : clamp01(Math.min(t - WLD_SAY_FROM, WLD_SAY_TO - t) / FADE_MS),
      labels: [
        /* 위 — 어느 나라인가 */
        {
          text: WORLD_COUNTRIES[index] ?? "",
          x: WLD_MID,
          y: 24,
          alpha: enter,
          unit: 8,
          color: act.water ? "#eaf3fb" : "#2b3346",
        },
        /* 아래 — 거기선 개인투자자를 뭐라 부르는가 */
        {
          text: WORLD_NAMES[index] ?? "",
          x: WLD_MID,
          y: WLD_NAME_Y,
          alpha: enter,
          unit: 8,
          color: "#f6efe2",
        },
        ...extra,
      ],
    };
  },
};

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
  pillar,
  water,
  block,
  polar,
  stair,
  grind,
  phone,
  storm,
  board,
  world,
];

export function findScene(id: MemeSceneId): MemeScene {
  return MEME_SCENES.find((scene) => scene.id === id) ?? dig;
}
