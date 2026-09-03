"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { CANVAS_H, CANVAS_W, GRID_H, GRID_W, createPainter } from "@/lib/pixel-canvas";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";
import { canRecordVideo, recordCanvas } from "@/lib/video-export";

import { drawBrand, drawBubble, drawLabels, memeFontFaces } from "./meme-bubble";
import { MEME_LINES, MEME_SCRIPTS, type MemeSceneId } from "./meme-lines";
import { MEME_SCENES, findScene } from "./meme-scenes";

/**
 * 짤 공장.
 *
 * 개미가 나오는 9:16 짤들을 돌려보고 **영상이나 이미지로 내보내는** 화면이다. 계산도
 * 시세도 없다 — 이 화면은 연봉도 평단도 안 읽는다 (그래서 온보딩을 안 거쳐도 열린다).
 *
 * **탭이 둘이다: 움직이는 짤과 한 컷 이미지.** 판은 그대로고 내보내는 모양만 다르다 —
 * 영상은 무겁고 못 받는 데가 있어서(카톡 프로필, 커뮤니티 글, 캡처 한 장이면 되는 자리)
 * 이미지 한 장이 더 멀리 간다. 판을 두 벌로 나누지 않는 게 규칙이다: **같은 장면 함수를
 * 흐르게 두느냐 한 순간에 멈춰 세우느냐**의 차이뿐이라, 새 판을 더하면 양쪽에 함께 생긴다.
 *
 * 그림은 캔버스 하나에 그린다. **미리보기와 결과물이 같은 캔버스다** — 화면에 보이는
 * 걸 그대로 녹화하므로 눌러보기 전에 뭐가 나올지 모르는 일이 없다. 캔버스는 처음부터
 * 1080×1920(스토리 규격)이고 화면에서만 줄여 보여준다.
 *
 * **시간은 rAF 한 곳에서만 흐른다.** 장면 함수는 시간을 받아 그리기만 하고 상태를 안
 * 쥔다 — 그래야 "다시 뽑기"로 씨앗만 바꿔도 같은 장면이 다른 판으로 나오고, 녹화가
 * 루프 첫 프레임에서 정확히 시작한다.
 */

/**
 * 픽셀 폰트를 미리 깔아둔다 — 글자가 늦게 도착하면 말풍선만 시스템 폰트로 떨어진다.
 * **대본 판(`MEME_SCRIPTS`)도 함께 넣는다**: 풀에 없다고 빠뜨리면 그 판만 첫 바퀴에서
 * 서체가 바뀐다.
 */
const FONT_SAMPLE = [...Object.values(MEME_LINES), ...Object.values(MEME_SCRIPTS)]
  .flat()
  .join("");

/** 내보내는 모양. 판은 그대로고 이것만 바뀐다. */
type Mode = "video" | "image";

const MODES: readonly { id: Mode; label: string; hint: string }[] = [
  {
    id: "video",
    label: "움직이는 짤",
    hint: "말풍선은 다시 뽑을 때마다 바뀌어. 마음에 드는 말이 나올 때까지 돌려봐.",
  },
  {
    id: "image",
    label: "한 컷 이미지",
    hint: "순간을 밀어 원하는 장면에서 멈추고, 말풍선은 다시 뽑아 바꿔.",
  },
];

/** 다 구운 결과물. 영상이든 이미지든 시트에서 하는 일이 같아 한 모양으로 쥔다. */
interface Take {
  url: string;
  file: File;
  kind: Mode;
}

export function MemeStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  /** 루프가 시작된 시각. 녹화를 누르면 여기부터 다시 센다. */
  const startRef = useRef(0);

  const [sceneId, setSceneId] = useState<MemeSceneId>("dig");
  const [mode, setMode] = useState<Mode>("video");
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [video, setVideo] = useState(false);

  const scene = findScene(sceneId);
  const recording = progress !== null;
  /** 한 컷 모드에서 멈춰 세운 순간. 판을 바꾸면 그 판이 정한 자리로 돌아간다. */
  const [still, setStill] = useState(scene.stillMs);

  useEffect(() => {
    setStill(scene.stillMs);
  }, [scene]);

  // 씨앗은 마운트 뒤에 뽑는다 — 서버와 클라이언트가 다른 값을 그리면 하이드레이션이 깨진다.
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 997) + 1);
    setVideo(canRecordVideo());
    track("meme_open");

    // 크기마다 따로 실리므로 쓰는 크기를 모두 미리 깐다
    if ("fonts" in document) {
      for (const face of memeFontFaces()) void document.fonts.load(face, FONT_SAMPLE).catch(() => {});
    }
  }, []);

  // 그림 한 판. 저해상도 격자에 그린 뒤 통째로 늘리고, 글자만 그 위에 얹는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let offscreen = offscreenRef.current;
    if (!offscreen) {
      offscreen = document.createElement("canvas");
      offscreen.width = GRID_W;
      offscreen.height = GRID_H;
      offscreenRef.current = offscreen;
    }

    const offContext = offscreen.getContext("2d");
    if (!offContext) return;

    const painter = createPainter(offContext);
    const world = offscreen;
    startRef.current = performance.now();

    const paintAt = (time: number) => {
      const bubble = scene.draw(painter, { time, seed });

      context.imageSmoothingEnabled = false;
      context.drawImage(world, 0, 0, CANVAS_W, CANVAS_H);
      drawLabels(context, bubble.labels);
      drawBubble(context, bubble);
      // 여럿이 동시에 떠드는 판(일개미 행진)만 채워지는 자리 — 나머지는 늘 빈 배열이다.
      bubble.extra?.forEach((extra) => drawBubble(context, extra));
      drawBrand(context);
    };

    /*
     * **한 컷 모드에서는 시간을 안 흘린다.** rAF를 돌려놓고 마지막 프레임만 저장하면
     * 화면에서 본 그림과 저장된 그림이 한 프레임씩 어긋난다 — 고른 순간이 곧 결과물이라야
     * 슬라이더를 미는 게 의미가 있다.
     */
    if (mode === "image") {
      paintAt(still);
      return;
    }

    let frame = 0;
    const paint = (now: number) => {
      paintAt((now - startRef.current) % scene.loopMs);
      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);

    return () => cancelAnimationFrame(frame);
  }, [scene, seed, mode, still]);

  // 미리보기 URL은 시트를 닫을 때 놓아준다 (영상은 수십 MB라 쥐고 있으면 쌓인다).
  useEffect(() => {
    return () => {
      if (take) URL.revokeObjectURL(take.url);
    };
  }, [take]);

  /**
   * 지금 화면의 한 컷을 PNG로 굽는다.
   *
   * **바로 내려받지 않고 시트를 띄운다** — 영상과 같은 이유다: `toBlob`을 기다리는 사이
   * iOS가 사용자 제스처를 잃어 바로 뒤의 `share()`가 거부당한다. 시트에서 다시 누르면
   * 새 제스처다. 겸사겸사 뭘 내보내는지 보고 가게 된다.
   */
  const shoot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], `yungcha-ants-${sceneId}.png`, { type: "image/png" });
      setTake({ url: URL.createObjectURL(file), file, kind: "image" });
    }, "image/png");
  }, [sceneId]);

  const record = async () => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;

    track("meme_record", { meme_scene: sceneId });
    setProgress(0);
    // 루프 첫 프레임부터 담아야 시작과 끝이 이어진다.
    startRef.current = performance.now();

    try {
      const shot = await recordCanvas(canvas, scene.loopMs, `yungcha-ants-${sceneId}`, setProgress);
      setTake({ url: shot.url, file: shot.file, kind: "video" });
    } catch {
      // 굽다 막히면 설명 대신 되는 일을 한다 — 한 컷이라도 손에 쥐어준다.
      shoot();
    } finally {
      setProgress(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-[color:var(--muted)]">
          ← 돌아가기
        </Link>
        <h1 className="text-base font-bold">개미 짤 공장</h1>
      </div>

      {/*
        내보내는 모양 고르기. **판보다 먼저 묻는다** — 영상이냐 한 장이냐에 따라 아래 판을
        고르는 마음이 다르고(움직임이 좋은 판 / 한 컷이 좋은 판), 버튼 문구도 여기서 갈린다.
      */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="meme-mode"
            data-on={item.id === mode ? "yes" : undefined}
            disabled={recording}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 장면 고르기. 판이 한 화면에 나란히 있어야 뭘 만들 수 있는지가 한눈에 보인다. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MEME_SCENES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="meme-tab"
            data-on={item.id === sceneId ? "yes" : undefined}
            disabled={recording}
            onClick={() => {
              setSceneId(item.id);
              setSeed(Math.floor(Math.random() * 997) + 1);
            }}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="meme-canvas" />

        {recording && (
          <div className="meme-recording">
            <span>{Math.round((progress ?? 0) * 100)}% 굽는 중..</span>
            <div className="meme-progress">
              <i style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-[color:var(--muted)]">{scene.blurb}</p>

      {/*
        순간 고르기. **한 컷 모드에만 있다** — 영상은 한 바퀴를 통째로 굽느라 고를 순간이
        없다. 판마다 제일 그 판다운 순간(`stillMs`)에서 시작하므로 안 만져도 된다.
      */}
      {mode === "image" && (
        <label className="mt-4 block">
          <span className="text-xs text-[color:var(--muted)]">순간 고르기</span>
          <input
            type="range"
            className="meme-scrub"
            min={0}
            max={scene.loopMs - 1}
            step={20}
            value={still}
            onChange={(event) => setStill(Number(event.target.value))}
          />
        </label>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="btn-outline flex-1"
          disabled={recording}
          onClick={() => setSeed(Math.floor(Math.random() * 997) + 1)}
        >
          다시 뽑기
        </button>

        <button
          type="button"
          className="btn-primary flex-1"
          disabled={recording}
          onClick={mode === "image" || !video ? shoot : record}
        >
          {mode === "image" || !video ? "이미지로 저장" : "영상으로 저장"}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-[color:var(--muted)]">
        {MODES.find((item) => item.id === mode)?.hint}
      </p>

      {take && (
        <TakeSheet
          take={take}
          sceneId={sceneId}
          onClose={() => {
            URL.revokeObjectURL(take.url);
            setTake(null);
          }}
        />
      )}
    </main>
  );
}

/**
 * 다 구운 것을 보여주는 시트. **영상과 이미지가 같은 시트를 쓴다** — 하는 일(보여주고,
 * 저장하고, 공유하고)이 같아서, 두 벌로 나누면 한쪽만 고쳐지는 자리가 된다.
 *
 * 인스타 스토리 시트(`story-export.tsx`)와 같은 규칙을 따른다 — **먼저 보여주고
 * 그다음에 내보낸다.** iOS는 `navigator.share()`를 사용자 제스처 안에서 불러야 하는데
 * 굽는 시간이 그 제스처를 이미 삼켰다. 시트 안에서 다시 누르면 새 제스처다.
 */
function TakeSheet({
  take,
  sceneId,
  onClose,
}: {
  take: Take;
  sceneId: MemeSceneId;
  onClose: () => void;
}) {
  /** 시트에 적히는 말은 여기서만 갈린다 (하는 일은 같다) */
  const noun = take.kind === "video" ? "영상" : "이미지";
  useLockedBodyScroll();

  const download = () => {
    const link = document.createElement("a");
    link.href = take.url;
    link.download = take.file.name;
    link.click();
    track("meme_export", { export_method: "download", meme_scene: sceneId, meme_format: take.kind });
  };

  const share = async () => {
    const shareable = navigator.canShare
      ? navigator.canShare({ files: [take.file] })
      : typeof navigator.share === "function";

    if (!shareable) {
      download();
      return;
    }

    try {
      await navigator.share({ files: [take.file] });
      track("meme_export", { export_method: "share", meme_scene: sceneId, meme_format: take.kind });
    } catch (error) {
      // 사용자가 시트를 닫은 것뿐이면 그대로 둔다. 브라우저가 거부한 거면 저장으로 대신한다.
      if ((error as Error | undefined)?.name !== "AbortError") download();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-dvh w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-center text-lg font-bold">걱정마, 다른 정보는 절대 공유되지 않아!</h2>
        <p className="mt-1 text-center text-xs text-[color:var(--muted)]">
          아래의 {noun}을 SNS로 공유하기
        </p>

        <div className="mx-auto mt-4 flex aspect-[9/16] max-h-[52dvh] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
          {take.kind === "video" ? (
            /* 소리가 없는 짤이라 muted로 두면 iOS에서도 자동 재생된다 */
            <video
              src={take.url}
              className="h-full w-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 방금 구운 blob이라 최적화할 원본이 없다
            <img src={take.url} alt="방금 구운 짤" className="h-full w-full object-contain" />
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-icon" aria-label="닫기" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6 18 18M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button type="button" className="btn-icon" aria-label={`${noun} 저장`} onClick={download}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 4v11m0 0 4-4m-4 4-4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <button type="button" className="btn-primary flex-1" onClick={share}>
            {noun} 친구에게 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
