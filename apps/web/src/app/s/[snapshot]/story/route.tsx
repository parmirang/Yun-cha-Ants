import { decodeShareSnapshot } from "@yca/shared";
import { ImageResponse } from "next/og";

import { STORY_SIZE, StoryCard } from "@/components/story-card";
import { cardText } from "@/lib/card-text";
import { ogFont } from "@/lib/og-font";

/**
 * 인스타 스토리로 내보낼 1080×1920 PNG.
 *
 * 링크 카드(opengraph-image)와 달리 **크롤러가 아니라 사람이 받아 간다** — 앱에서
 * 이 주소를 받아 공유 시트에 파일로 얹는다(`story-export.tsx`). 그래서 파일 규칙이
 * 아니라 라우트 핸들러다. 주소를 그대로 열면 이미지가 떠서 길게 눌러 저장할 수도 있다.
 *
 * 글자는 링크 카드와 **같은 `cardText()`**에서 나온다 — 같은 링크가 두 판형에서
 * 다른 말을 하면 안 된다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshot: string }> },
) {
  const text = cardText(decodeShareSnapshot((await params).snapshot));

  return new ImageResponse(<StoryCard {...text} />, {
    ...STORY_SIZE,
    fonts: [{ name: "Galmuri11", data: await ogFont(), style: "normal", weight: 400 }],
    headers: {
      // 스냅샷 토큰이 그림을 통째로 결정하므로 하루쯤은 그대로 써도 된다.
      "Cache-Control": "public, max-age=86400",
      // 공유 화면과 같은 이유로 색인은 막는다 — 이미지 검색에 남의 손익이 뜨면 안 된다.
      "X-Robots-Tag": "noindex",
    },
  });
}
