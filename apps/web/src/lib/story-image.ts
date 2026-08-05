/**
 * 인스타로 내보낼 세로 이미지를 굽는 주소.
 *
 * 서버가 필요한 지점이라 여기 한 모듈로 뽑아뒀다 — 단일 HTML 목업은 서버가 없어서
 * `mockup/story-image.ts`로 갈아끼우고, 거기서는 null을 돌려준다
 * (`StoryExportButton`이 null을 받으면 버튼째 사라진다).
 */
export function storyImageUrl(token: string): string | null {
  return `/s/${token}/story`;
}
