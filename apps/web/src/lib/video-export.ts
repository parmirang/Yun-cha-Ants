/**
 * 캔버스를 그대로 영상으로 굽는다.
 *
 * **화면에 돌아가는 그 캔버스를 녹화한다** — 영상용으로 장면을 다시 그리지 않는다.
 * 미리보기와 결과물이 갈라지는 순간, 눌러서 받아보기 전에는 뭐가 나올지 알 수 없게 된다.
 * 캔버스는 처음부터 1080×1920(스토리 규격)으로 그려두고 화면에서만 줄여 보여준다.
 *
 * **한 바퀴만 녹화한다.** 장면은 루프로 만들어져 있어서 시작과 끝이 같은 그림이다 —
 * 딱 한 바퀴를 담으면 SNS에서 반복 재생될 때 이음매가 안 보인다.
 *
 * 그릇(mimeType)은 브라우저가 주는 것 중 **mp4를 먼저** 고른다. webm은 인스타·카톡이
 * 못 받아서, 받는 쪽에서 열리지 않으면 만든 의미가 없다.
 */

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export interface VideoTake {
  blob: Blob;
  /** 미리보기용 objectURL — 다 쓰면 부르는 쪽이 revoke한다 */
  url: string;
  file: File;
  extension: "mp4" | "webm";
}

/** 이 브라우저에서 영상을 구울 수 있는가 (데스크톱 사파리 옛 버전·일부 인앱 브라우저는 못 한다) */
export function pickVideoMime(): string | null {
  if (typeof window === "undefined") return null;
  if (typeof MediaRecorder === "undefined") return null;
  if (typeof HTMLCanvasElement === "undefined") return null;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;

  // isTypeSupported가 아예 없는 구현도 있다 — 그때는 브라우저 기본값에 맡긴다.
  if (typeof MediaRecorder.isTypeSupported !== "function") return "";

  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}

export function canRecordVideo(): boolean {
  return pickVideoMime() !== null;
}

export async function recordCanvas(
  canvas: HTMLCanvasElement,
  durationMs: number,
  fileName: string,
  onProgress?: (ratio: number) => void,
): Promise<VideoTake> {
  const mime = pickVideoMime();
  if (mime === null) throw new Error("no recorder");

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const started = performance.now();
  const ticking = window.setInterval(() => {
    onProgress?.(Math.min(1, (performance.now() - started) / durationMs));
  }, 100);

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/mp4" }));
    recorder.onerror = () => reject(new Error("recorder failed"));
  });

  // 조각을 주기적으로 받아둔다 — 통째로 받는 구현에서 긴 녹화가 통째로 날아가는 걸 막는다.
  recorder.start(200);

  try {
    await sleep(durationMs);
    if (recorder.state !== "inactive") recorder.stop();

    const blob = await finished;
    const extension = (recorder.mimeType || mime || "").includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `${fileName}.${extension}`, { type: blob.type });

    onProgress?.(1);

    return { blob, url: URL.createObjectURL(blob), file, extension };
  } finally {
    window.clearInterval(ticking);
    stream.getTracks().forEach((track) => track.stop());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
