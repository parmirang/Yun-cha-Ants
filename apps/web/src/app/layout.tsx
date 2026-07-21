import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "영차Ants",
  description: "내 주식, 몇 시간 더 일하면 본전일까?",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 모바일 웹에서 입력 필드 포커스 시 확대되는 걸 막는다.
  maximumScale: 1,
  themeColor: "#14100c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
