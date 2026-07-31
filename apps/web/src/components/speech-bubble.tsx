/**
 * 개미 머리 위 말풍선. 폰트는 픽셀 한글(Galmuri11)이고
 * 글자 수가 늘면 `pnpm --filter @yca/web font`으로 서브셋을 다시 구워야 한다.
 *
 * `headTop`은 스프라이트 상자 위에서 개미 꼭대기까지의 px이다. 상자 기준으로
 * 붙이면 기어갈 때(몸이 낮아 위가 비는 자세) 말풍선만 허공에 뜬다.
 */
export function SpeechBubble({
  text,
  visible,
  headTop = 0,
}: {
  text: string;
  visible: boolean;
  headTop?: number;
}) {
  return (
    <div
      className="speech-bubble"
      data-visible={visible ? "yes" : "no"}
      style={{ bottom: `calc(100% - ${headTop}px)` }}
    >
      {text}
    </div>
  );
}
