import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

/**
 * 앱 전체를 파일 하나로 굽는다.
 *
 * 계산 로직과 화면은 실제 소스(@yca/shared, src/components)를 그대로 번들하고,
 * 서버가 필요한 네 지점만 브라우저용 구현으로 바꿔 끼운다.
 *   @/lib/use-quote    → mockup/market-browser.ts  (SSE 대신 브라우저에서 목 엔진 실행)
 *   @/lib/tickers      → mockup/market-browser.ts  (검색 API 대신 같은 엔진)
 *   @/lib/share-url    → mockup/share-url.ts       (경로 대신 해시 라우팅)
 *   @/lib/story-image  → mockup/story-image.ts     (이미지를 구울 서버가 없다 → 버튼 숨김)
 *
 * CSS는 Next 프로덕션 빌드가 뽑아낸 Tailwind 결과물을 그대로 인라인한다 —
 * 목업에서만 쓰는 별도 스타일시트를 두지 않기 위해서다.
 */
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const outDir = join(webRoot, "mockup", "dist");
const out = join(outDir, "yungcha-ants.html");
// Artifact 호스팅은 문서 골격을 스스로 씌우므로 <html>/<head>/<body> 없는 조각도 함께 굽는다.
const outFragment = join(outDir, "yungcha-ants.fragment.html");

console.log("· next build (Tailwind CSS 추출용)");
execFileSync("pnpm", ["exec", "next", "build"], { cwd: webRoot, stdio: "inherit" });

const cssDir = join(webRoot, ".next", "static", "css");
const css = readdirSync(cssDir)
  .filter((file) => file.endsWith(".css"))
  .map((file) => readFileSync(join(cssDir, file), "utf8"))
  .join("\n");

if (!css.trim()) throw new Error(`Tailwind CSS를 찾지 못했다: ${cssDir}`);
console.log(`· CSS ${(css.length / 1024).toFixed(0)}KB`);

const bundle = await esbuild.build({
  entryPoints: [join(here, "entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "@/lib/use-quote": join(here, "market-browser.ts"),
    "@/lib/tickers": join(here, "market-browser.ts"),
    "@/lib/share-url": join(here, "share-url.ts"),
    "@/lib/story-image": join(here, "story-image.ts"),
  },
  absWorkingDir: webRoot,
  tsconfig: join(webRoot, "tsconfig.json"),
  logLevel: "warning",
});

const js = bundle.outputFiles[0].text;
console.log(`· JS  ${(js.length / 1024).toFixed(0)}KB`);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<meta name="theme-color" content="#14100c" />
<title>영차Ants</title>
<style>${css}</style>
</head>
<body class="antialiased">
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;

const fragment = `<title>영차Ants</title>
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;

writeFileSync(out, html);
writeFileSync(outFragment, fragment);
console.log(`✓ ${out} (${(html.length / 1024).toFixed(0)}KB)`);
console.log(`✓ ${outFragment} (${(fragment.length / 1024).toFixed(0)}KB)`);
