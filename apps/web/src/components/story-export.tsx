"use client";

import { type Mood, encodeShareSnapshot } from "@yca/shared";
import { useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics";
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
  const source = useMemo(() => {
    try {
      return storyImageUrl(
        encodeShareSnapshot({
          n: name,
          s: seconds,
          g: stage,
          m: mood === "loss" ? "l" : mood === "profit" ? "p" : "e",
        }),
      );
    } catch {
      return null;
    }
  }, [name, seconds, stage, mood]);

  // 목업(서버 없음)에서도 null이라 아예 안 그린다 — 눌러도 안 되는 버튼을 두지 않는다.
  if (!source) return null;

  return (
    <>
      <button
        className="btn-ghost mt-3 w-full"
        onClick={() => {
          track("story_open");
          setOpen(true);
        }}
      >
        인스타 스토리로 내보내기
      </button>

      {open && <StorySheet source={source} mood={mood} onClose={() => setOpen(false)} />}
    </>
  );
}

const FILE_NAME = "yungcha-ants.png";

function StorySheet({
  source,
  mood,
  onClose,
}: {
  source: string;
  mood: Mood;
  onClose: () => void;
}) {
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /*
   * **파일 공유는 보안 컨텍스트에서만 된다** (HTTPS·localhost). 실기기 테스트로
   * LAN IP(http)에 들어오면 `navigator.share` 자체가 없어서 인스타로 넘길 방법이
   * 아예 없다 — 그걸 안 알려주면 위쪽 "공유하기"(링크용)를 누르게 되고, 그러면
   * 스토리가 아니라 링크가 나간다. 왜 안 되는지 시트에서 말해준다.
   */
  const [insecure, setInsecure] = useState(false);

  useLockedBodyScroll();

  useEffect(() => setInsecure(!window.isSecureContext), []);

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
        setCanShareFile(navigator.canShare?.({ files: [file] }) ?? false);
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

  const share = async () => {
    if (!image) return;

    try {
      await navigator.share({ files: [image.file] });
      track("story_export", { export_method: "share", mood });
    } catch {
      // 사용자가 시트를 닫은 경우 — 아무 일도 없었던 걸로 둔다.
    }
  };

  const download = () => {
    if (!image) return;

    const link = document.createElement("a");
    link.href = image.url;
    link.download = FILE_NAME;
    link.click();
    track("story_export", { export_method: "download", mood });
    // iOS Safari는 download 속성을 무시하고 이미지를 새 탭에 열어버린다 —
    // 그때는 길게 눌러 저장하는 길밖에 없어서 그걸 알려준다.
    setNote("저장이 안 됐으면 이미지를 길게 눌러 사진에 저장해줘.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-dvh w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold">인스타에 올리기</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {canShareFile
            ? "공유하기를 누르고 인스타그램을 고르면 스토리로 넘어가."
            : insecure
              ? "지금 주소(http)에서는 브라우저가 이미지 공유를 막아. 배포된 https 주소에서 열면 인스타로 바로 넘어가 — 여기서는 저장만 돼."
              : "이 브라우저는 이미지 공유가 안 돼. 저장해서 인스타에 올려줘."}
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

        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>
            닫기
          </button>
          <button
            className="btn-ghost flex-1 disabled:opacity-30"
            disabled={!image}
            onClick={download}
          >
            이미지 저장
          </button>
          {canShareFile && (
            <button className="btn-primary flex-[1.4]" disabled={!image} onClick={share}>
              공유하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
