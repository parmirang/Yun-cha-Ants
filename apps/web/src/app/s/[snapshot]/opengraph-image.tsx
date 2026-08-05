import { decodeShareSnapshot, formatTotalWorkLine, formatWorkSpanWords } from "@yca/shared";
import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/components/og-card";
import { pickWorkLine } from "@/components/countdown-lines";
import { pickAntSpeech } from "@/components/speech-lines";
import { ogFont } from "@/lib/og-font";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "영차Ants";

const MOOD = { l: "loss", p: "profit", e: "even" } as const;

export default async function Image({
  params,
}: {
  params: Promise<{ snapshot: string }>;
}) {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  const seconds = snapshot?.s ?? 0;
  const mood = MOOD[snapshot?.m ?? "e"];
  const stage = snapshot?.g ?? 25;

  /*
   * 문구는 화면과 같은 풀에서 뽑되 **시간에서 나온 씨앗**을 쓴다. 링크 하나가 늘 같은
   * 카드를 내야 미리보기 캐시가 다시 구워질 때 문장이 갈리지 않는다 (화면은 매번
   * 새로 뽑아도 되지만 카드는 아니다).
   */
  const seed = seconds % 997;

  const headline =
    mood === "even"
      ? ["딱 본전이야"]
      : [`${formatWorkSpanWords(seconds)} 만큼`, pickWorkLine(mood, seconds, seed)];

  /*
   * **말풍선은 큰 글씨와 다른 씨앗으로 뽑는다.** 같은 seed를 그대로 넘기면 두 풀에서
   * 늘 같은 자리의 문장이 뽑힌다 — 화면은 seed가 서로 독립이라 가끔이지만, 카드는
   * 매번이다. 한쪽을 흩어놔야 짝이 고정되지 않는다.
   *
   * 그래도 겹칠 수 있으니(본전은 풀이 좁다) 같으면 한 칸 밀어 다시 뽑는다.
   * 비교 대상은 **말줄(`headline[1]`)**이다 — `headline[0]`은 "{시간} 만큼"이라
   * 말풍선과 같아질 수가 없어서, 예전 코드는 검사를 하고도 아무것도 못 걸렀다.
   */
  const speechSeed = (seed * 7 + 3) % 997;
  const spoken = headline[1] ?? headline[0];
  const first = pickAntSpeech(mood, seconds, speechSeed);
  const speech = first === spoken ? pickAntSpeech(mood, seconds, speechSeed + 1) : first;

  return new ImageResponse(
    (
      <OgCard
        mood={mood}
        stage={stage}
        seconds={seconds}
        speech={speech}
        eyebrow={snapshot?.n}
        headline={headline}
        footnote={formatTotalWorkLine(seconds, mood) ?? undefined}
      />
    ),
    { ...size, fonts: [{ name: "Galmuri11", data: await ogFont(), style: "normal", weight: 400 }] },
  );
}
