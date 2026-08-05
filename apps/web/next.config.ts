import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
