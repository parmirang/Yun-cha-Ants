import { decodeShareSnapshot } from "@yca/shared";
import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/components/og-card";
import { cardText } from "@/lib/card-text";
import { ogFont } from "@/lib/og-font";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "영차Ants";

/**
 * 링크 미리보기 카드. 글자는 [card-text.ts](apps/web/src/lib/card-text.ts)가 정하고
 * (인스타 스토리와 같은 값), 여기서는 판형과 폰트만 얹는다.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ snapshot: string }>;
}) {
  const text = cardText(decodeShareSnapshot((await params).snapshot));

  return new ImageResponse(<OgCard {...text} />, {
    ...size,
    fonts: [{ name: "Galmuri11", data: await ogFont(), style: "normal", weight: 400 }],
  });
}
