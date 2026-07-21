/**
 * 공유 링크. 단일 HTML 목업 빌드에서는 해시 라우팅 버전으로 교체된다
 * (apps/web/mockup/build.mjs의 alias 참고).
 */
export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
