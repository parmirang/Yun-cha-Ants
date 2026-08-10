import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PixelLab } from "@/components/pixel-lab/pixel-lab";

/**
 * 도트 랩 — 개미 스프라이트를 그리고 프레임을 쌓는 **작업용 화면**이다.
 *
 * **배포에는 안 실린다.** 사용자에게 보여줄 물건이 아니라 그림을 만드는 연장이라,
 * 프로덕션 빌드에서는 404로 떨어뜨려 앱 표면을 안 넓힌다 (`/meme`은 사용자가 쓰는
 * 기능이라 실린다 — 그쪽과 헷갈리지 말 것).
 *
 * 배포된 주소에서도 쓰고 싶으면 아래 `notFound()` 한 줄만 지우면 된다. 로컬에서는
 * `pnpm dev:web` 뒤 http://localhost:3000/pixel-lab 로 들어간다 (실기기로 볼 때는
 * localhost 대신 맥의 LAN IP를 쓴다 — 앱의 다른 화면과 같은 규칙이다).
 */
export const metadata: Metadata = {
  title: "도트 랩",
  robots: { index: false },
};

export default function PixelLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <PixelLab />;
}
