"use client";

import { type Mood, encodeShareSnapshotFromStage } from "@yca/shared";
import { useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { shareUrl } from "@/lib/share-url";
import { storyImageUrl } from "@/lib/story-image";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";

/**
 * 인스타로 내보내기.
 *
 * **인스타는 링크 미리보기가 없다** — 링크를 붙여도 그림이 안 뜨므로, 링크 대신
 * 이미지를 만들어 넘긴다. 그림은 서버가 굽고(`/s/[snapshot]/story`, 1080×1920)
 * 여기서는 그걸 받아 공유 시트에 **파일로** 얹는다. 시트에서 인스타그램을 고르면
 * 스토리 편집기로 바로 들어간다.
 *
 * **누르면 바로 공유하지 않고 미리보기를 먼저 띄운다.** 두 가지 때문이다.
 * 1. iOS는 `navigator.share()`를 사용자 제스처 안에서 불러야 하는데, 이미지를
 *    받아오는 `await`가 그 제스처를 소모해 버린다. 받아둔 뒤 시트 안에서 다시
 *    누르면 새 제스처라 통과한다.
 * 2. 어차피 올리기 전에 뭐가 올라가는지 보고 싶다.
 *
 * 공유 시트가 없는 브라우저(데스크톱)에서는 저장만 남는다.
 */
export function StoryExportButton({
  name,
  seconds,
  stage,
  mood,
}: {
  name: string;
  seconds: number;
  stage: number;
  mood: Mood;
}) {
  const [open, setOpen] = useState(false);

  // 토큰 만들기는 스키마 검증을 거치므로 값이 어긋나면 던진다 — 대시보드가 통째로
  // 죽는 대신 버튼만 빠지게 둔다 (링크 공유 쪽은 눌렀을 때만 만드느라 이 위험이 없다).
  const target = useMemo(() => {
    try {
      const token = encodeShareSnapshotFromStage({
        n: name,
        s: seconds,
        stage,
        m: mood === "loss" ? "l" : mood === "profit" ? "p" : "e",
      });
      const source = storyImageUrl(token);

      // 링크는 여기서 만들지 않는다 — `shareUrl()`이 `window`를 읽어서 서버 렌더에서
      // 던지고, 그러면 서버는 버튼을 안 그리고 클라이언트만 그려 하이드레이션이 어긋난다.
      // 누른 뒤(시트 안)에 만든다.
      return source ? { source, token } : null;
    } catch {
      return null;
    }
  }, [name, seconds, stage, mood]);

  // 목업(서버 없음)에서도 null이라 아예 안 그린다 — 눌러도 안 되는 버튼을 두지 않는다.
  if (!target) return null;

  return (
    <>
      {/* 공유의 기본값이라 채움 버튼이다 — 옆의 링크 공유(흰 선)와 한 줄에 선다. */}
      <button
        type="button"
        className="btn-primary flex-1"
        onClick={() => {
          track("story_open");
          setOpen(true);
        }}
      >
        이미지 공유하기
      </button>

      {open && (
        <StorySheet
          source={target.source}
          token={target.token}
          mood={mood}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const FILE_NAME = "yungcha-ants.png";

function StorySheet({
  source,
  token,
  mood,
  onClose,
}: {
  source: string;
  /** 링크 스티커에 붙여넣을 공유 링크의 토큰 */
  token: string;
  mood: Mood;
  onClose: () => void;
}) {
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useLockedBodyScroll();

  // 이미지는 시트가 열리는 즉시 받아둔다 — 공유 버튼을 누르는 순간엔 이미 손에 있어야
  // iOS의 제스처 검사를 통과한다 (위 주석 참고).
  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;

    (async () => {
      try {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`story ${response.status}`);

        const blob = await response.blob();
        const file = new File([blob], FILE_NAME, { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);

        if (!alive) return;
        setImage({ url: objectUrl, file });
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  /** 내려받기. 공유 시트가 없는 브라우저에서는 이 길만 남는다. */
  const download = () => {
    if (!image) return;

    const link = document.createElement("a");
    link.href = image.url;
    link.download = FILE_NAME;
    link.click();
    track("story_export", { export_method: "download", mood });
  };

  const share = async () => {
    if (!image) return;

    /*
     * 브라우저가 파일 공유를 못 하면(데스크톱·http) 조용히 저장으로 떨어진다 —
     * **왜 안 되는지 설명하지 않는다.** 브라우저 사정은 쓰는 사람 잘못이 아니고,
     * 그 자리에서 할 수 있는 일(이미지를 손에 넣는 것)은 어차피 같다.
     *
     * `canShare`가 없어도 `share`가 있으면 일단 불러본다 — 옛 브라우저에는 검사
     * 함수만 없는 경우가 있어서, 없다고 곧장 저장으로 떨어뜨리면 될 것도 안 된다.
     */
    const shareable = navigator.canShare
      ? navigator.canShare({ files: [image.file] })
      : typeof navigator.share === "function";

    if (!shareable) {
      download();
      return;
    }

    /*
     * **share()를 제일 먼저 부른다.** iOS는 사용자 제스처 안에서만 공유 시트를 열어주고,
     * 그 앞에 다른 비동기 호출(클립보드 등)이 끼면 제스처를 잃어 거부당한다. 시트를
     * 띄우는 약속을 먼저 받아두고, 링크 복사는 그 뒤에 붙인다.
     */
    const opening = navigator.share({ files: [image.file] });

    /*
     * **이미지에는 링크를 심을 수 없다.** PNG는 픽셀뿐이고, 스토리에서 누를 수 있는
     * 건 사람이 붙이는 **링크 스티커**뿐이다. 그래서 보내는 김에 링크를 클립보드에
     * 넣어준다 — 스티커에 붙여넣기 한 번이면 끝난다.
     */
    void copyText(shareUrl(token)).then((copied) => {
      if (copied) setNote("링크도 복사됐어 — 스토리에서 링크 스티커에 붙여넣으면 돼.");
    });

    try {
      await opening;
      track("story_export", { export_method: "share", mood });
    } catch (error) {
      // 사용자가 시트를 닫은 것뿐이면 그대로 둔다. 브라우저가 거부한 거라면
      // 아무 일도 없었던 것처럼 두지 말고 저장으로 대신한다 — 막다른 길을 안 만든다.
      if ((error as Error | undefined)?.name !== "AbortError") download();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-dvh w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 제목이 먼저 답하는 건 "이거 누르면 내 연봉도 같이 나가나?"다. */}
        <h2 className="text-center text-lg font-bold">
          걱정마, 다른 정보는 절대 공유되지 않아!
        </h2>
        <p className="mt-1 text-center text-xs text-[color:var(--muted)]">
          아래의 이미지를 SNS로 공유하기
        </p>

        {/* 9:16 자리를 미리 잡아둔다 — 이미지가 들어올 때 시트가 튀지 않도록. */}
        <div className="mx-auto mt-4 flex aspect-[9/16] max-h-[52dvh] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt="인스타 스토리 이미지" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-[color:var(--muted)]">
              {failed ? "이미지를 못 만들었어" : "개미 데리러 가는 중.."}
            </span>
          )}
        </div>

        {note && (
          <p className="mt-3 text-center text-xs text-[color:var(--muted)]">{note}</p>
        )}

        {/*
          닫기·저장은 아이콘만 남긴다 — 이 시트에서 읽을 것은 제목과 이미지지,
          버튼 이름이 아니다. 글자를 쥔 건 실제로 하려던 일(보내기) 하나뿐이다.
        */}
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

          <button
            type="button"
            className="btn-icon"
            aria-label="이미지 저장"
            disabled={!image}
            onClick={download}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 4v11m0 0 4-4m-4 4-4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 19h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!image}
            onClick={share}
          >
            이미지 공유하기
          </button>
        </div>
      </div>
    </div>
  );
}
