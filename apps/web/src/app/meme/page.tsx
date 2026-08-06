import type { Metadata } from "next";

import { MemeStudio } from "@/components/meme/meme-studio";

/**
 * 짤 공장. 계산 화면과 달리 **연봉도 평단도 안 읽으므로** 온보딩을 안 거친 사람도
 * 바로 들어올 수 있다 — 링크를 받아 여기부터 시작해도 화면이 성립한다.
 */
export const metadata: Metadata = {
  title: "개미 짤 공장",
  description: "땅 파는 개미, 차트에 올라탄 개미, 눈물바다 개미. 움직이는 짤로 만들어 보내기.",
};

export default function MemePage() {
  return <MemeStudio />;
}
