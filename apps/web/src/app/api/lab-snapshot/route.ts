import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { NextResponse } from "next/server";

/**
 * 도트 랩의 **저장소 안 백업**.
 *
 * 랩이 그린 그림은 브라우저(localStorage)에만 있었다 — 그런데 그건 브라우저·프로필·
 * 주소(포트)마다 따로 저장되고 사이트 데이터를 지우면 같이 날아간다. 실제로 그렇게
 * **하루치 작업을 통째로 잃었다.** 그래서 저장할 때마다 저장소 안 파일에도 같이 적는다 —
 * git이 지켜주므로 브라우저가 비어도, 다른 브라우저로 열어도 그림이 남는다.
 *
 * **개발 서버에서만 연다.** 배포에서는 파일을 쓸 곳도 없고 열어둘 이유도 없다
 * (랩 화면 자체가 프로덕션에서 404다).
 *
 * 여기 쓰는 건 **소스 코드가 아니라 데이터 파일**이다 — 코드에 박는 건 사람이 "코드로
 * 뽑기"로 확인하고 붙이는 일로 남긴다. 자동으로 소스를 고치면 잘못 그린 한 획이
 * `ant-sprite.tsx`를 조용히 덮어쓴다.
 */

const SNAPSHOT = join(process.cwd(), ".lab", "snapshot.json");

const devOnly = () =>
  process.env.NODE_ENV === "production"
    ? NextResponse.json({ error: "개발 서버에서만 쓴다" }, { status: 404 })
    : null;

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    return NextResponse.json(JSON.parse(await readFile(SNAPSHOT, "utf8")));
  } catch {
    // 아직 한 번도 안 그렸으면 파일이 없다 — 빈 것과 같은 뜻이다.
    return NextResponse.json({ overrides: {} });
  }
}

export async function POST(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as { overrides?: unknown };
    const table = body.overrides;
    if (!table || typeof table !== "object") {
      return NextResponse.json({ error: "overrides가 없다" }, { status: 400 });
    }

    /*
     * **빈 표는 안 받는다.** 브라우저가 비어 있는 채로 열리면(다른 프로필·지운 사이트
     * 데이터) 그 빈 상태가 곧바로 파일을 덮어써서, 살아 있던 백업까지 같이 사라진다 —
     * 백업을 두는 이유가 통째로 없어지는 자리다. 지우는 건 사람이 파일을 지우면 된다.
     */
    if (Object.keys(table as Record<string, unknown>).length === 0) {
      return NextResponse.json({ skipped: "빈 표라 안 덮어썼다" });
    }

    await mkdir(dirname(SNAPSHOT), { recursive: true });
    await writeFile(SNAPSHOT, `${JSON.stringify({ overrides: table }, null, 2)}\n`, "utf8");

    return NextResponse.json({ saved: Object.keys(table as Record<string, unknown>).length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
