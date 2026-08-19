/**
 * 랜덤 문구 풀 검사기.
 *
 * 문구는 코드가 아니라 글이라 타입 검사가 아무것도 안 잡아준다. 그런데 여기서
 * 깨지는 건 늘 같은 몇 가지라 규칙으로 적을 수 있다 — 실제로 한 번씩 다 터졌다.
 *
 *   · "{43일 22시간} 만큼 **평생** 안 나가도 돼" — 앞에서 잰 시간을 뒤에서 딴 단위로 덮어씀
 *   · "{23분} 만큼 안 **나가도** 돼"            — 목적어가 안 서는 구간에서 출근 은유를 씀
 *   · 상단·말풍선·하단이 같은 구간에서 같은 문장 — 한 얘기를 세 번 함
 *   · 풀 길이가 구간 수와 어긋남                — 그 구간이 통째로 빈 말풍선이 됨
 *   · 짤 세 판이 같은 말을 함 / 앱 말풍선과 겹침 — 문구가 몇 개 없어 보임
 *   · 짤 문구가 길어 9:16 한 줄을 넘침           — 말풍선이 개미보다 커짐
 *
 * `pnpm --filter @yca/web lines`로 돌리고, `build`/`vercel-build`가 먼저 부른다.
 * 문구는 배포돼야 보이는 물건이라 사람이 기억해서 돌리는 검사로는 안 걸린다.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const components = join(webRoot, "src", "components");

/**
 * "{시간} 만큼 ___"의 앞말과 부딪히는 기간명사. **상단 풀에만** 금지한다 —
 * 하단 한마디와 말풍선은 앞에 시간이 안 붙으므로 마음껏 쓴다.
 */
const PERIOD_WORDS = [
  "하루",
  "이틀",
  "사흘",
  "며칠",
  "반나절",
  "한나절",
  "평생",
  "내일",
  "모레",
  "주말",
  "한 달",
  "반년",
  "올해",
  "점심시간",
  "온종일",
  "밤새",
];

/** 앞말이 "출근 N번"일 때만 뜻이 서는 은유. 그 아래 구간에서는 목적어가 없다. */
const COMMUTE_WORDS = ["나가", "출근", "결근", "도장", "빠져"];

const work = mkdtempSync(join(tmpdir(), "yca-lines-"));
const failures = [];
const fail = (message) => failures.push(message);

try {
  const lines = await load(join(components, "countdown-lines.ts"));
  const speech = await load(join(components, "speech-lines.ts"));
  const nudge = await load(join(components, "nudge-lines.ts"));

  const { TIER_COUNT, WORK_UNIT_TIER } = nudge;

  const surfaces = [
    { name: "상단", pools: lines.COUNTDOWN_LINES },
    { name: "말풍선", pools: speech.SPEECH_LINES },
    { name: "하단", pools: nudge.NUDGE_LINES },
  ];

  // 1. 구조 — 구간 수가 맞고, 구간마다 고를 게 충분한가.
  for (const { name, pools } of surfaces) {
    for (const mood of ["loss", "profit"]) {
      const tiers = pools[mood];

      if (tiers.length !== TIER_COUNT) {
        fail(`${name}/${mood}: 구간이 ${tiers.length}개다 (TIER_COUNT=${TIER_COUNT})`);
        continue;
      }

      tiers.forEach((pool, tier) => {
        if (pool.length < 5) fail(`${name}/${mood} ${tier}구간: 문장이 ${pool.length}개뿐이다 (5개 이상)`);
        duplicates(pool).forEach((line) => fail(`${name}/${mood} ${tier}구간: "${line}"이 두 번 있다`));
      });

      // 구간이 올라갔는데 같은 말이 나오면 세기가 안 올라간 것처럼 읽힌다.
      duplicates(tiers.flat()).forEach((line) =>
        fail(`${name}/${mood}: "${line}"이 여러 구간에 있다`),
      );
    }
  }

  // 2. 상단 전용 규칙 — 앞에 "{시간} 만큼"이 붙는 줄이라서 생기는 제약.
  for (const mood of ["loss", "profit"]) {
    lines.COUNTDOWN_LINES[mood].forEach((pool, tier) => {
      for (const line of pool) {
        const period = PERIOD_WORDS.find((word) => line.includes(word));
        if (period) fail(`상단/${mood} ${tier}구간: "${line}" — 기간명사 "${period}"가 앞말과 부딪힌다`);

        if (tier < WORK_UNIT_TIER) {
          const commute = COMMUTE_WORDS.find((word) => line.includes(word));
          if (commute) {
            fail(
              `상단/${mood} ${tier}구간: "${line}" — 출근 은유("${commute}")는 ${WORK_UNIT_TIER}구간부터다 (앞말이 "출근 N번"이 아니다)`,
            );
          }
        }
      }
    });
  }

  // 3. 같은 구간에서 세 surface가 같은 문장을 내면 화면에 같은 말이 겹쳐 뜬다.
  for (const mood of ["loss", "profit"]) {
    for (let tier = 0; tier < TIER_COUNT; tier += 1) {
      const seen = new Map();

      for (const { name, pools } of surfaces) {
        for (const line of pools[mood][tier] ?? []) {
          const owner = seen.get(line);
          if (owner) fail(`${mood} ${tier}구간: "${line}"이 ${owner}·${name}에 모두 있다`);
          else seen.set(line, name);
        }
      }
    }
  }

  // 4. 손익이 없는 풀들. 상단 본전은 "딱 본전이야" 한 줄로 고정이라 값으로 박아 비교한다.
  const EVEN_HEADLINE = "딱 본전이야";
  const standalone = [
    { name: "상단(본전)", pool: [EVEN_HEADLINE] },
    { name: "말풍선(본전)", pool: speech.EVEN_SPEECH },
    { name: "하단(본전)", pool: nudge.EVEN_NUDGE_LINES },
  ];

  const evenSeen = new Map();
  for (const { name, pool } of standalone) {
    duplicates(pool).forEach((line) => fail(`${name}: "${line}"이 두 번 있다`));

    for (const line of pool) {
      const owner = evenSeen.get(line);
      if (owner) fail(`본전: "${line}"이 ${owner}·${name}에 모두 있다`);
      else evenSeen.set(line, name);
    }
  }

  // 대문 개미는 결과 화면 최상위 구간과 겹치면 안 된다 — 문구가 몇 개 없어 보인다.
  const topProfit = new Set(speech.SPEECH_LINES.profit[TIER_COUNT - 1] ?? []);
  for (const line of speech.HERO_LINES) {
    if (topProfit.has(line)) fail(`대문: "${line}"이 말풍선 최상위 구간과 겹친다`);
  }

  duplicates(speech.HERO_LINES).forEach((line) => fail(`대문: "${line}"이 두 번 있다`));
  duplicates(speech.WAITING_LINES).forEach((line) => fail(`대기: "${line}"이 두 번 있다`));

  /*
   * 5. 짤 공장 말풍선. 구간도 손익 방향도 없는 대신 **판마다 풀 하나**라, 여기서
   *    깨지는 건 다른 것들이다.
   *
   *    · 세 판이 한 화면에서 탭으로 오가는데 같은 말을 하면 문구가 몇 개 없어 보인다
   *    · 앱 말풍선과 겹치면 같은 개미가 같은 자리에서 한 벌을 돌려쓰는 것으로 읽힌다
   *    · 9:16 한 칸에 한 줄로 들어가야 한다 — 넘치면 말풍선이 개미보다 커진다
   */
  const meme = await load(join(components, "meme", "meme-lines.ts"));
  const MEME_MAX_CHARS = 14;

  const appSpeech = new Set([
    ...speech.SPEECH_LINES.loss.flat(),
    ...speech.SPEECH_LINES.profit.flat(),
    ...speech.EVEN_SPEECH,
    ...speech.HERO_LINES,
    ...speech.WAITING_LINES,
  ]);

  const memeSeen = new Map();
  for (const [id, pool] of Object.entries(meme.MEME_LINES)) {
    if (pool.length < 5) fail(`짤/${id}: 문장이 ${pool.length}개뿐이다 (5개 이상)`);

    duplicates(pool).forEach((line) => fail(`짤/${id}: "${line}"이 두 번 있다`));

    for (const line of pool) {
      if ([...line].length > MEME_MAX_CHARS) {
        fail(`짤/${id}: "${line}" — ${MEME_MAX_CHARS}자를 넘어 말풍선이 화면을 넘는다`);
      }

      if (appSpeech.has(line)) fail(`짤/${id}: "${line}"이 앱 말풍선에도 있다`);

      const owner = memeSeen.get(line);
      if (owner) fail(`짤: "${line}"이 ${owner}·${id} 두 판에 있다`);
      else memeSeen.set(line, id);
    }
  }

  const counted =
    surfaces.reduce(
      (total, { pools }) => total + pools.loss.flat().length + pools.profit.flat().length,
      0,
    ) + memeSeen.size;

  if (failures.length > 0) {
    console.error(`\n✗ 문구 검사 실패 (${failures.length}건)\n`);
    failures.forEach((message) => console.error(`  · ${message}`));
    console.error("");
    process.exit(1);
  }

  console.log(
    `✓ 문구 ${counted}줄 — ${TIER_COUNT}구간 구조·상단 어법·surface 중복·짤 풀 이상 없음`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

/** 문구 파일 하나를 번들해서 모듈로 읽어온다 (@yca/shared 임포트를 풀어야 해서 esbuild를 거친다). */
async function load(entry) {
  const out = join(work, `${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);

  await esbuild.build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    target: ["node18"],
    absWorkingDir: webRoot,
    tsconfig: join(webRoot, "tsconfig.json"),
    logLevel: "warning",
  });

  return import(pathToFileURL(out).href);
}

function duplicates(pool) {
  const seen = new Set();
  const dupes = new Set();

  for (const line of pool) {
    if (seen.has(line)) dupes.add(line);
    seen.add(line);
  }

  return [...dupes];
}
