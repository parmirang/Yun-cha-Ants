import { type Mood, decodeShareSnapshot, formatWorkSpanWords } from "@yca/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CandleScene } from "@/components/candle-scene";
import { Countdown } from "@/components/countdown";
import { StageMeter } from "@/components/stage-meter";
import { BRAND, SHARE_TAGLINE } from "@/lib/share-copy";

import { ShareCta } from "./share-cta";

interface PageProps {
  params: Promise<{ snapshot: string }>;
}

const MOOD: Record<string, Mood> = { l: "loss", p: "profit", e: "even" };

/**
 * 링크 미리보기에 실리는 글자. 그림(og:image)은 같은 폴더의 opengraph-image.tsx가
 * 굽고, 여기서는 그 옆에 붙는 제목과 설명만 정한다 — 설명은 카드에 찍히는 문장과
 * **같은 한 줄**이라 `SHARE_TAGLINE` 하나를 같이 쓴다.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  if (!snapshot) return { title: BRAND };

  const mood = MOOD[snapshot.m] ?? "even";
  // 카드 큰 글씨와 같은 표기 — 제목은 시계가 아니라 헤드라인 자리다.
  const time = formatWorkSpanWords(snapshot.s);
  const headline =
    mood === "loss"
      ? `${time} 만큼 더 벌어야 해..`
      : mood === "profit"
        ? `${time} 만큼 안 일해도 돼!`
        : "딱 본전이야";
  const title = `${snapshot.n} · ${headline}`;

  return {
    title: `${title} · ${BRAND}`,
    description: SHARE_TAGLINE,
    openGraph: { title, description: SHARE_TAGLINE },
    twitter: { title, description: SHARE_TAGLINE },
  };
}

/**
 * 공유받은 사람이 보는 화면.
 *
 * **보낸 사람이 보던 그 화면을 그대로 보여준다** — 카운터, 장대봉이 자라고 개미가
 * 기어와 말을 거는 연출, 단계 눈금까지 대시보드와 같은 컴포넌트를 쓴다. 링크용으로
 * 따로 그리면 두 화면이 갈라지고, 받은 사람은 스크린샷보다 못한 걸 보게 된다.
 *
 * 대시보드와 다른 건 딱 셋이다.
 * 1. **금액이 없다.** 스냅샷에 안 실리므로 `Countdown`에 `pnl`을 안 넘기고,
 *    그러면 물건 환산 줄("맥모닝 1,237개가 그냥 사라졌네..")도 같이 빠진다.
 *    시급·연봉이 새어나가지 않게 하는 규칙의 연장이다.
 * 2. **개미를 눌러도 안 열린다** — 물타기 계산에는 내 평단과 수량이 필요하다.
 * 3. 아래는 "다시 계산해보기" 버튼 하나뿐이다. 종목 카드도, 하단 한마디도 없다.
 */
export default async function SharePage({ params }: PageProps) {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  if (!snapshot) notFound();

  const mood = MOOD[snapshot.m] ?? "even";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6"
      data-mood={mood}
    >
      <Countdown seconds={snapshot.s} mood={mood} />

      <section className="my-5">
        <CandleScene seconds={snapshot.s} mood={mood} stage={snapshot.g} />
      </section>

      <StageMeter stage={snapshot.g} />

      {/* 어느 종목 이야기인지는 있어야 한다 — 숫자만 남으면 무엇의 손익인지 모른다. */}
      <p className="mt-4 text-center text-sm text-[color:var(--muted)]">{snapshot.n}</p>

      <ShareCta />
    </main>
  );
}
