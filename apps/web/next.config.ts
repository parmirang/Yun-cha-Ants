import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * 빌드 결과가 나갈 곳. 기본은 `.next`이고, **개발 서버가 그 폴더를 쓰고 있는 동안
   * 프로덕션 빌드를 돌리면 둘이 섞여 화면이 통째로 빈다** (`_next/static/chunks/
   * main-app.js`가 404로 떨어진다). 목업을 굽거나 배포 전 확인용으로 빌드할 때는
   * `NEXT_DIST_DIR`로 딴 폴더에 뽑아 개발 서버를 안 건드린다.
   *
   * 배포(Vercel)는 이 변수를 안 넣으므로 그대로 `.next`에 쌓인다.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /*
   * 개발 배지를 위로 올린다. 기본 자리(왼쪽 아래)가 **숫자 키패드의 ⌫ 키와 정확히
   * 겹쳐서**, 로컬에서 실기기로 만져보면 지우기가 안 눌린다 — 배포에는 없는 물건이라
   * 화면 탓인 줄 알고 키패드를 뜯게 된다. 개발 모드에서만 뜨는 설정이다.
   */
  devIndicators: { position: "top-left" },
  // The home directory above this repo holds a stray yarn.lock; without this
  // Next picks it as the workspace root and warns on every start.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  /*
   * OG 카드가 `assets/galmuri11-og.woff`를 런타임에 읽는다 (src/lib/og-font.ts).
   * fs로 읽는 파일은 추적이 안 되므로 여기 적어야 배포 번들에 딸려 간다 —
   * 빼면 로컬은 멀쩡한데 배포에서만 카드가 500으로 죽는다.
   */
  outputFileTracingIncludes: {
    "/**": ["./assets/**"],
  },
};

export default nextConfig;
