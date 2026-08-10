"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { CANVAS_H, CANVAS_W, GRID_H, GRID_W, createPainter } from "@/lib/pixel-canvas";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";
import { type VideoTake, canRecordVideo, recordCanvas } from "@/lib/video-export";

import { drawBrand, drawBubble, drawLabels, memeFontFaces } from "./meme-bubble";
import { MEME_LINES, type MemeSceneId } from "./meme-lines";
import { MEME_SCENES, findScene } from "./meme-scenes";

/**
 * 짤 공장.
 *
 * 개미가 나오는 9:16 짤 일곱 판을 돌려보고 **영상으로 내보내는** 화면이다. 계산도
 * 시세도 없다 — 이 화면은 연봉도 평단도 안 읽는다 (그래서 온보딩을 안 거쳐도 열린다).
 *
 * 그림은 캔버스 하나에 그린다. **미리보기와 결과물이 같은 캔버스다** — 화면에 보이는
 * 걸 그대로 녹화하므로 눌러보기 전에 뭐가 나올지 모르는 일이 없다. 캔버스는 처음부터
 * 1080×1920(스토리 규격)이고 화면에서만 줄여 보여준다.
 *
 * **시간은 rAF 한 곳에서만 흐른다.** 장면 함수는 시간을 받아 그리기만 하고 상태를 안
 * 쥔다 — 그래야 "다시 뽑기"로 씨앗만 바꿔도 같은 장면이 다른 판으로 나오고, 녹화가
 * 루프 첫 프레임에서 정확히 시작한다.
 */

/** 픽셀 폰트를 미리 깔아둔다 — 글자가 늦게 도착하면 말풍선만 시스템 폰트로 떨어진다. */
const FONT_SAMPLE = Object.values(MEME_LINES).flat().join("");

export function MemeStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  /** 루프가 시작된 시각. 녹화를 누르면 여기부터 다시 센다. */
  const startRef = useRef(0);

  const [sceneId, setSceneId] = useState<MemeSceneId>("dig");
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [take, setTake] = useState<VideoTake | null>(null);
  const [video, setVideo] = useState(false);

  const scene = findScene(sceneId);
  const recording = progress !== null;

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

    let frame = 0;
    const paint = (now: number) => {
      const time = (now - startRef.current) % scene.loopMs;
      const bubble = scene.draw(painter, { time, seed });

      context.imageSmoothingEnabled = false;
      context.drawImage(world, 0, 0, CANVAS_W, CANVAS_H);
      drawLabels(context, bubble.labels);
      drawBubble(context, bubble);
      drawBrand(context);

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);

    return () => cancelAnimationFrame(frame);
  }, [scene, seed]);

  // 미리보기 URL은 시트를 닫을 때 놓아준다 (영상은 수십 MB라 쥐고 있으면 쌓인다).
  useEffect(() => {
    return () => {
      if (take) URL.revokeObjectURL(take.url);
    };
  }, [take]);

  /** 영상을 못 굽는 브라우저에서 남는 길 — 지금 이 한 컷을 PNG로 내려받는다. */
  const saveStill = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `yungcha-ants-${sceneId}.png`;
      link.click();
      URL.revokeObjectURL(url);
      track("meme_export", { export_method: "download", meme_scene: sceneId, meme_format: "image" });
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
      setTake(await recordCanvas(canvas, scene.loopMs, `yungcha-ants-${sceneId}`, setProgress));
    } catch {
      // 굽다 막히면 설명 대신 되는 일을 한다 — 한 컷이라도 손에 쥐어준다.
      saveStill();
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

      {/* 장면 고르기. 판이 한 화면에 나란히 있어야 뭘 만들 수 있는지가 한눈에 보인다. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
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
          onClick={video ? record : saveStill}
        >
          {video ? "영상으로 저장" : "이미지로 저장"}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-[color:var(--muted)]">
        말풍선은 누를 때마다 새로 뽑혀. 마음에 드는 말이 나올 때까지 돌려봐.
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
 * 다 구운 영상을 보여주는 시트.
 *
 * 인스타 스토리 시트(`story-export.tsx`)와 같은 규칙을 따른다 — **먼저 보여주고
 * 그다음에 내보낸다.** iOS는 `navigator.share()`를 사용자 제스처 안에서 불러야 하는데
 * 영상을 굽는 시간이 그 제스처를 이미 삼켰다. 시트 안에서 다시 누르면 새 제스처다.
 */
function TakeSheet({
  take,
  sceneId,
  onClose,
}: {
  take: VideoTake;
  sceneId: MemeSceneId;
  onClose: () => void;
}) {
  useLockedBodyScroll();

  const download = () => {
    const link = document.createElement("a");
    link.href = take.url;
    link.download = take.file.name;
    link.click();
    track("meme_export", { export_method: "download", meme_scene: sceneId, meme_format: "video" });
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
      track("meme_export", { export_method: "share", meme_scene: sceneId, meme_format: "video" });
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
          아래의 영상을 SNS로 공유하기
        </p>

        <div className="mx-auto mt-4 flex aspect-[9/16] max-h-[52dvh] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
          {/* 소리가 없는 짤이라 muted로 두면 iOS에서도 자동 재생된다 */}
          <video
            src={take.url}
            className="h-full w-full object-contain"
            autoPlay
            loop
            muted
            playsInline
          />
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

          <button type="button" className="btn-icon" aria-label="영상 저장" onClick={download}>
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
            영상 친구에게 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
