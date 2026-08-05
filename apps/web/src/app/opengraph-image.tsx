import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/components/og-card";
import { pickHeroLine } from "@/components/speech-lines";
import { ogFont } from "@/lib/og-font";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "영차Ants";

/**
 * 주소만 공유했을 때(대문 링크) 뜨는 카드. 손익이 없으니 시간도 종목도 없고,
 * 늘 신난 대문 개미가 수익 봉 옆에 선다 — 공유 카드와 같은 무대를 쓴다.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        mood="profit"
        stage={44}
        seconds={40 * 3600}
        speech={pickHeroLine(0)}
        headline={["내 주식,", "몇 시간 더 일하면", "본전일까?"]}
      />
    ),
    { ...size, fonts: [{ name: "Galmuri11", data: await ogFont(), style: "normal", weight: 400 }] },
  );
}
