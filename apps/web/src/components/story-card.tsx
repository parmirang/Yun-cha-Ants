import { STAGE_COUNT, type Mood } from "@yca/shared";

import { BRAND, SHARE_TAGLINE_LINES } from "@/lib/share-copy";

import { OgScene, SCENE_COLOR, moodColor, pixelFont } from "./og-scene";
import { stageMeterColor } from "./stage-meter";

/**
 * 인스타 스토리로 내보내는 세로 카드(1080×1920).
 *
 * 무대는 링크 카드와 **같은 [og-scene.tsx](og-scene.tsx)**를 쓰고, 여기서는 세로
 * 판형만 맡는다 — 글자 위, 무대 가운데, 한 줄 문구 아래. 화면(모바일 세로)과 같은
 * 순서라 스크린샷을 찍은 것처럼 읽힌다.
 *
 * **주소는 안 적고 서비스명만 적는다.** 이미지에는 링크를 심을 수 없고, 스토리에서
 * 누를 수 있는 링크는 사람이 붙이는 **링크 스티커**뿐이다 — 그래서 내보낼 때 앱이
 * 공유 링크를 클립보드에 넣어주고(`story-export.tsx`), 카드에는 날 주소 대신 이름만
 * 남긴다. 주소를 적어두면 스티커와 겹쳐 같은 말을 두 번 하는 꼴이 된다.
 *
 * 위아래 여백이 큰 건 인스타 UI가 그만큼을 덮기 때문이다 — 위는 프로필 줄,
 * 아래는 답장 입력창이 올라온다. **여백을 줄이면 글자가 그 밑으로 들어간다.**
 */

export const STORY_SIZE = { width: 1080, height: 1920 };

const W = STORY_SIZE.width;
const H = STORY_SIZE.height;

const PAD_X = 88;
const PAD_TOP = 150;
const PAD_BOTTOM = 250;

/**
 * 무대 높이는 위아래 글자를 다 앉히고 남는 만큼이다 — 이 값을 키우면 아래 한 줄
 * 문구가 인스타 UI 밑으로 밀려 들어간다 (여백을 줄이는 것도 마찬가지다).
 */
const SCENE = { width: W - PAD_X * 2, height: 760 };

const FONT = {
  brand: pixelFont(H, 0.023),
  eyebrow: pixelFont(H, 0.029),
  /** 큰 글씨는 한 줄에 들어가야 한다 — "쉬는 날 없이 벌어야 해"가 딱 차는 크기다 */
  headline: pixelFont(H, 0.041),
  foot: pixelFont(H, 0.023),
  meter: pixelFont(H, 0.017),
  tagline: pixelFont(H, 0.023),
  signature: pixelFont(H, 0.017),
};

export interface StoryCardProps {
  mood: Mood;
  stage: number;
  seconds: number;
  speech: string;
  /** 종목명 */
  eyebrow?: string;
  headline: readonly string[];
  /** 총 몇 시간 */
  footnote?: string;
}

export function StoryCard({
  mood,
  stage,
  seconds,
  speech,
  eyebrow,
  headline,
  footnote,
}: StoryCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: W,
        height: H,
        padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
        background: SCENE_COLOR.bg,
        color: SCENE_COLOR.fg,
        fontFamily: "Galmuri11",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: FONT.brand,
            color: SCENE_COLOR.muted,
            letterSpacing: 4,
          }}
        >
          <span>{BRAND}</span>
          <span style={{ color: SCENE_COLOR.up }}>베타</span>
        </div>

        {eyebrow ? (
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: FONT.eyebrow,
              color: SCENE_COLOR.muted,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
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
        </div>

        {footnote ? (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: FONT.foot,
              color: SCENE_COLOR.muted,
            }}
          >
            {footnote}
          </div>
        ) : null}
      </div>

      {/* 무대는 절대배치로 그려지므로 크기를 못 박은 상자에 담는다. */}
      <div
        style={{
          position: "relative",
          display: "flex",
          width: SCENE.width,
          height: SCENE.height,
        }}
      >
        <OgScene
          width={SCENE.width}
          height={SCENE.height}
          mood={mood}
          stage={stage}
          seconds={seconds}
          speech={speech}
          borderRadius={40}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <StageBar stage={stage} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 44,
            fontSize: FONT.tagline,
            lineHeight: 1.35,
            color: SCENE_COLOR.fg,
          }}
        >
          {SHARE_TAGLINE_LINES.map((line) => (
            <div key={line} style={{ display: "flex" }}>
              {line}
            </div>
          ))}
        </div>
        {/* 서명 자리. 날 주소 대신 이름만 — 누를 수 있는 링크는 링크 스티커가 맡는다. */}
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: FONT.signature,
            color: SCENE_COLOR.muted,
            letterSpacing: 2,
          }}
        >
          {BRAND}
        </div>
      </div>
    </div>
  );
}

/** 화면의 `StageMeter`와 같은 눈금 — Tailwind를 못 쓰는 satori용으로 인라인 스타일이다. */
function StageBar({ stage }: { stage: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: FONT.meter,
          color: SCENE_COLOR.muted,
        }}
      >
        <span>탈진</span>
        <span>{`${stage + 1} / ${STAGE_COUNT} 단계`}</span>
        <span>쌩쌩</span>
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
        {Array.from({ length: STAGE_COUNT }, (_, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexGrow: 1,
              height: 24,
              borderRadius: 2,
              background: index <= stage ? stageMeterColor(index) : "#33291d",
            }}
          />
        ))}
      </div>
    </div>
  );
}
