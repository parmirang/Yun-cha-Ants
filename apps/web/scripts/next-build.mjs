import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `next build`를 **개발 서버의 `.next` 밖으로** 돌린다.
 *
 * 기본 폴더에 그냥 구우면 `pnpm dev`가 쓰던 결과물과 섞여, 굽고 나서 화면이 통째로
 * 빈 채 뜬다 (청크가 404). 그래서 목업 빌드도 배포 전 확인용 빌드도 여기를 지난다.
 *
 * 딴 폴더로 뽑을 때 딸려오는 문제가 하나 있다 — `next build`는 **`next-env.d.ts`와
 * `tsconfig.json`을 자기 dist 폴더에 맞춰 고쳐 쓴다.** 기본 `.next`면 같은 내용이라
 * 티가 안 나지만, 딴 폴더면 추적 중인 파일 둘이 그 폴더를 가리키도록 바뀐다
 * (커밋에 딸려 들어가면 남의 기계에서 없는 폴더를 참조한다). 구운 뒤 되돌려 놓는다.
 */
export function nextBuild(distDir) {
  const touched = ["next-env.d.ts", "tsconfig.json"].map((name) => ({
    path: join(webRoot, name),
    before: readFileSync(join(webRoot, name), "utf8"),
  }));

  try {
    execFileSync("pnpm", ["exec", "next", "build"], {
      cwd: webRoot,
      stdio: "inherit",
      env: { ...process.env, NEXT_DIST_DIR: distDir },
    });
  } finally {
    // 빌드가 실패해도 되돌린다 — 고쳐 쓰는 건 빌드 초반이라 이미 바뀌어 있다.
    for (const file of touched) {
      if (readFileSync(file.path, "utf8") !== file.before) {
        writeFileSync(file.path, file.before);
      }
    }
  }

  return join(webRoot, distDir);
}

// `node scripts/next-build.mjs [distDir]`로 직접 부르면 확인용 빌드가 된다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  nextBuild(process.argv[2] || ".next-verify");
}
