/**
 * SNS로 내보낼 때 따라나가는 한 줄.
 *
 * OG 카드에 찍히는 글자이자, 링크 미리보기의 설명(description)이고, 앱 자체의
 * 소개 문구다 — **세 곳이 같은 문장이어야** 카드와 그 옆 텍스트가 따로 놀지 않는다.
 * 그래서 문구를 여기 한 곳에만 둔다.
 *
 * 카드는 픽셀 폰트(Galmuri11)로 그리지만 이 문장은 서브셋 대상이 아니다 —
 * OG용 폰트(`assets/galmuri11-og.woff`)는 현대 한글 전체를 담고 있어서
 * 문구를 고쳐도 `pnpm --filter @yca/web font`를 다시 돌릴 필요가 없다.
 */
/**
 * 세로 카드(인스타)는 폭이 좁아 한 줄로는 안 들어간다. 쉼표에서 끊어 두 줄로 적되,
 * **두 벌을 따로 두지 않는다** — 아래 `SHARE_TAGLINE`이 이걸 이어 붙여 만들어지므로
 * 문구를 고치면 양쪽이 함께 바뀐다.
 */
export const SHARE_TAGLINE_LINES = ["영-차 개미, 내 평단,", "얼만큼 더 일해야 할까?"];

export const SHARE_TAGLINE = SHARE_TAGLINE_LINES.join(" ");

export const BRAND = "영차Ants";
