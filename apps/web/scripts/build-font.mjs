/**
 * 픽셀 한글 폰트(Galmuri11)를 두 벌로 굽는다.
 *
 * 1) `src/app/galmuri.css` — 브라우저 말풍선용. **실제로 쓰는 글자만** 남긴
 *    woff2를 data URI로 박는다.
 *    - 전체 Galmuri11은 493KB다. 모바일에서 말풍선 몇 줄 띄우자고 실을 무게가 아니다.
 *    - 단일 HTML 목업은 파일 하나로 굴러가야 하므로 url(...)로 외부 파일을 못 건다.
 *      data URI로 CSS에 박아두면 Next 앱과 목업이 같은 파일을 그대로 쓴다.
 *    서브셋 범위는 아래 `speechSources`에 등장하는 모든 글자다. **문구를 고치면 다시 굽는다**
 *    (`pnpm --filter @yca/web font`). 안 구우면 새 글자만 시스템 폰트로 떨어져
 *    문장 중간에서 서체가 바뀐다.
 *
 * 2) `assets/galmuri11-og.woff` — OG 카드용. 카드를 굽는 satori는 woff2를 못 읽고
 *    (ttf/otf/woff만 받는다) CSS도 안 쓰므로 파일로 따로 낸다. 이쪽은 **현대 한글
 *    전체(11,172자)**를 담는다 — 카드에 종목명이 찍히는데 그 글자는 KRX가 런타임에
 *    주는 값이라 구울 때 알 수가 없다. 그래도 woff로 300KB뿐이라 통째로 싣는다.
 *    범위가 고정이라 **문구를 고쳐도 이쪽은 다시 구울 필요가 없다.**
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(webRoot, "node_modules", "galmuri", "dist", "Galmuri11.woff2");
// OG용은 woff로 다시 압축해야 해서 원본 ttf에서 뽑는다 (woff2 → woff 재포장은 안 된다).
const sourceTtf = join(webRoot, "node_modules", "galmuri", "dist", "Galmuri11.ttf");
/**
 * 픽셀 폰트로 그려지는 글자가 있는 파일 전부. **말풍선을 새로 띄우는 화면이 생기면
 * 여기에 더한다** — 빠뜨리면 그 화면의 새 글자만 시스템 폰트로 떨어져 문장 중간에서
 * 서체가 바뀐다 (짤 공장은 캔버스에 같은 폰트로 글자를 찍는다).
 */
const speechSources = [
  join(webRoot, "src", "components", "speech-lines.ts"),
  join(webRoot, "src", "components", "meme", "meme-lines.ts"),
  join(webRoot, "src", "lib", "share-copy.ts"),
];
const outCss = join(webRoot, "src", "app", "galmuri.css");
const outOgFont = join(webRoot, "assets", "galmuri11-og.woff");

/** 현대 한글 음절 전체 + 라틴/숫자/기호 — 종목명이 뭐가 들어와도 글자가 안 빠지게. */
const OG_UNICODES = "U+0020-007E,U+00B7,U+2014,U+2026,U+AC00-D7A3";

// 문구 파일에 등장하는 글자 전부 + 기본 라틴/숫자/기호.
// 파일 전체를 훑으므로 식별자나 주석의 글자까지 들어가지만, 몇 글리프 더 실릴 뿐이다.
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const sourceText = speechSources.map((file) => readFileSync(file, "utf8")).join("");
const text = [...new Set([...sourceText, ...ascii, "…", "·", "—"])]
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
 * 말풍선(speech-lines.ts · meme/meme-lines.ts)에 쓰이는 글자만 남긴 서브셋이다.
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

  mkdirSync(dirname(outOgFont), { recursive: true });
  execFileSync(
    "python3",
    [
      "-m",
      "fontTools.subset",
      sourceTtf,
      `--unicodes=${OG_UNICODES}`,
      "--flavor=woff",
      "--layout-features=",
      "--no-hinting",
      "--desubroutinize",
      `--output-file=${outOgFont}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  console.log(`✓ ${outOgFont}\n  현대 한글 전체 · woff ${(statSync(outOgFont).size / 1024).toFixed(1)}KB`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
