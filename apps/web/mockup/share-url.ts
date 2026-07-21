/**
 * 목업은 파일 하나로 돌아가므로 경로 라우팅을 쓸 수 없다.
 * 공유 링크를 해시로 만들면 같은 파일을 그대로 열면서 공유 화면이 뜬다.
 */
export function shareUrl(token: string): string {
  const { origin, pathname, search } = window.location;

  return `${origin}${pathname}${search}#/s/${token}`;
}
