/**
 * API 주소.
 *
 * 배포에서는 `NEXT_PUBLIC_API_URL`이 정한다 (Vercel 환경변수 → 빌드 때 값이 박힌다).
 *
 * 없으면 개발이라 보고 **지금 보고 있는 호스트**의 4300 포트를 쓴다. `localhost`로
 * 못박으면 실기기 테스트가 통째로 막힌다 — 폰에서 `192.168.x.x:3000`으로 들어왔을 때
 * localhost는 맥이 아니라 **그 폰 자신**을 가리켜 아무 데도 안 닿는다. API 쪽은 이미
 * 열려 있다 (개발 모드는 CORS 전체 허용, host도 `0.0.0.0`).
 *
 * 서버 렌더 중에는 창이 없어 localhost로 떨어진다. 실제 호출은 전부 브라우저에서
 * 일어나고 이 모듈도 거기서 다시 평가되므로, 화면이 쓰는 값은 늘 위 규칙을 따른다.
 */
function developmentApiUrl(): string {
  if (typeof window === "undefined") return "http://localhost:4300";

  return `${window.location.protocol}//${window.location.hostname}:4300`;
}

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? developmentApiUrl();
