import { STAGE_COUNT } from "@yca/shared";

/**
 * 눈금 한 칸의 색. 개미 껍질 색과 같은 축을 쓰되, 얇은 막대라 명도만 조금 올린다.
 *
 * **성분을 전부 정수로 반올림한다** — 이미지를 굽는 resvg가 소수점 hue를 거부하고
 * fill을 검정으로 떨군다 (브라우저는 멀쩡히 그려서 눈치채기 어렵다). 화면과 인스타
 * 카드가 같은 함수를 쓰므로 여기서 한 번만 지키면 된다.
 */
export function stageMeterColor(index: number): string {
  const t = index / (STAGE_COUNT - 1);

  return `hsl(${Math.round(30 - t * 18)}, ${Math.round(8 + t * 54)}%, ${Math.round(41 + t * 13)}%)`;
}

/**
 * 개미가 50단계 중 어디에 서 있는지 보여주는 눈금.
 *
 * 대시보드와 공유 화면이 **같은 걸 쓴다** — 공유받은 사람이 보는 화면은 보낸 사람이
 * 보던 화면이어야 한다. 한쪽에만 두면 두 화면이 갈라진다.
 */
export function StageMeter({ stage }: { stage: number }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-[color:var(--muted)]">
        <span>탈진</span>
        <span className="tabular-nums">
          {stage + 1} / {STAGE_COUNT} 단계
        </span>
        <span>쌩쌩</span>
      </div>
      <div className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: STAGE_COUNT }, (_, index) => (
          <span
            key={index}
            className="h-2 flex-1 rounded-[1px]"
            style={{
              background: index <= stage ? stageMeterColor(index) : "var(--line)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
