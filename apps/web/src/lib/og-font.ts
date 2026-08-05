import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * OG 카드용 픽셀 폰트.
 *
 * satori에는 시스템 폰트가 없어서 한글을 그리려면 바이너리를 직접 넘겨야 한다.
 * 화면이 쓰는 woff2는 **satori가 못 읽으므로**(ttf/otf/woff만 받는다) 같은 폰트를
 * woff로 따로 구워 `assets/`에 둔다 (`pnpm --filter @yca/web font`).
 * 현대 한글 전체가 들어있어 종목명이 뭐가 오든 글자가 빠지지 않는다.
 *
 * 예전엔 카드 글자를 구글 폰트에서 매번 받아왔는데, 네트워크에 기대는 만큼
 * 실패하면 카드에서 글자가 통째로 빠졌다. 파일로 들고 있으면 그럴 일이 없다.
 * 대신 번들에 실려야 하므로 next.config.ts의 outputFileTracingIncludes에
 * `assets/**`가 들어가 있다 — 지우면 배포에서만 카드가 깨진다.
 */
let cached: Promise<Buffer> | null = null;

export function ogFont(): Promise<Buffer> {
  cached ??= readFile(join(process.cwd(), "assets", "galmuri11-og.woff"));

  return cached;
}
