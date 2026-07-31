/**
 * 말풍선용 픽셀 한글 폰트(Galmuri11)를 **실제로 쓰는 글자만** 남기고 구워서
 * data URI로 박은 CSS 한 장을 만든다.
 *
 * 왜 서브셋하고 왜 인라인하나:
 * - 전체 Galmuri11은 493KB다. 모바일에서 말풍선 몇 줄 띄우자고 실을 무게가 아니다.
 * - 단일 HTML 목업은 파일 하나로 굴러가야 하므로 url(...)로 외부 파일을 못 건다.
 *   data URI로 CSS에 박아두면 Next 앱과 목업이 같은 파일을 그대로 쓴다.
 *
 * 서브셋 범위는 speech-lines.ts에 등장하는 모든 글자다. **문구를 고치면 다시 굽는다**
 * (`pnpm --filter @yca/web font`). 안 구우면 새 글자만 시스템 폰트로 떨어져
 * 문장 중간에서 서체가 바뀐다.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(webRoot, "node_modules", "galmuri", "dist", "Galmuri11.woff2");
const speechLines = join(webRoot, "src", "components", "speech-lines.ts");
const outCss = join(webRoot, "src", "app", "galmuri.css");

// 문구 파일에 등장하는 글자 전부 + 기본 라틴/숫자/기호.
// 파일 전체를 훑으므로 식별자나 주석의 글자까지 들어가지만, 몇 글리프 더 실릴 뿐이다.
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const text = [...new Set([...readFileSync(speechLines, "utf8"), ...ascii, "…", "·", "—"])]
  .filter((char) => char !== "\n" && char !== "\r" && char !== "\t")
  .join("");

const work = mkdtempSync(join(tmpdir(), "yca-font-"));
const subset = join(work, "galmuri-subset.woff2");

try {
  execFileSync(
    "python3",
    [
      "-m",
      "fontTools.subset",
      source,
      `--text=${text}`,
      "--flavor=woff2",
      "--layout-features=",
      "--no-hinting",
      "--desubroutinize",
      `--output-file=${subset}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const base64 = readFileSync(subset).toString("base64");

  writeFileSync(
    outCss,
    `/* 생성 파일 — 직접 고치지 말 것. \`pnpm --filter @yca/web font\`으로 다시 굽는다.
 *
 * Galmuri (c) 2019-2025 Lee Minseo, SIL Open Font License 1.1
 * https://github.com/quiple/galmuri
 *
 * 말풍선(speech-lines.ts)에 쓰이는 글자만 남긴 서브셋이다.
 */
@font-face {
  font-family: "Galmuri11";
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(data:font/woff2;base64,${base64}) format("woff2");
}
`,
    "utf8",
  );

  const glyphCount = [...text].length;
  console.log(
    `✓ ${outCss}\n  글자 ${glyphCount}자 · woff2 ${(base64.length / 1024).toFixed(1)}KB (base64)`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
