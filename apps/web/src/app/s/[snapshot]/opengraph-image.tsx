import { decodeShareSnapshot, formatDuration } from "@yca/shared";
import { ImageResponse } from "next/og";

import { antDataUri } from "@/components/ant-sprite";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "영차Ants";

const CAPTION: Record<string, string> = {
  l: "만큼 더 벌어야 해..",
  p: "만큼 안 일해도 돼!",
  e: "딱 본전이야",
};

const MOOD_COLOR: Record<string, string> = {
  l: "#5c9dff",
  p: "#ff5c5c",
  e: "#f3ece2",
};

/**
 * satori에는 시스템 폰트가 없어서, 한글을 그리려면 폰트 바이너리를 직접 넘겨야 한다.
 * 네트워크가 막힌 환경에서도 카드가 깨지지 않도록 실패하면 null을 돌려주고,
 * 호출부는 숫자만 있는 레이아웃으로 떨어진다.
 */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    // 구형 UA로 요청해야 woff2 대신 satori가 읽을 수 있는 ttf를 준다.
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
    }).then((response) => response.text());

    const fontUrl = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!fontUrl) return null;

    return await fetch(fontUrl).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ snapshot: string }>;
}) {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  const time = formatDuration(snapshot?.s ?? 0);
  const mood = snapshot?.m ?? "e";
  const caption = CAPTION[mood] ?? "";
  const name = snapshot?.n ?? "";

  const font = await loadKoreanFont(`${caption}${name}영차Ants`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#14100c",
          color: "#f3ece2",
          fontFamily: font ? "Noto Sans KR" : "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={antDataUri(snapshot?.g ?? 25)} width={200} height={200} alt="" />

        <div
          style={{
            fontSize: 128,
            fontWeight: 700,
            color: MOOD_COLOR[mood] ?? "#f3ece2",
          }}
        >
          {time}
        </div>

        {font && <div style={{ fontSize: 44, color: "#9c8f7e" }}>{caption}</div>}
        <div style={{ fontSize: 32, color: "#9c8f7e" }}>
          {font ? `${name} · 영차Ants` : "YUNGCHA ANTS"}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans KR", data: font, style: "normal", weight: 700 }]
        : [],
    },
  );
}
