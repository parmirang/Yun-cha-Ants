/**
 * 목업은 파일 하나로 돌아가므로 이미지를 구울 서버가 없다.
 * null을 돌려주면 인스타 내보내기 버튼이 아예 안 그려진다 — 눌러도 안 되는 버튼을
 * 남겨두는 것보다 낫다. (신호는 `src/lib/story-image.ts`와 같은 모양이어야 한다.)
 */
export function storyImageUrl(_token: string): string | null {
  return null;
}
