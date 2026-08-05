// apps/api/.env를 읽는다. 파일이 없으면 조용히 넘어가고 실제 환경변수만 쓴다.
try {
  process.loadEnvFile?.();
} catch {
  // .env 없음 — 배포 환경에서는 정상이다.
}

const nodeEnv = process.env.NODE_ENV ?? "development";

/**
 * 늘 허용하는 오리진 — **서비스 중인 웹 주소**다.
 *
 * 공개된 주소라 숨길 게 없고, 여기 박아두면 CORS가 배포 대시보드의 손입력에
 * 매달리지 않는다. 실제로 `WEB_ORIGIN`이 `http://localhost:3000`으로 잘못 남아
 * 있어서 배포된 사이트가 제 API를 통째로 못 부른 적이 있다 — 대시보드는 값을
 * 눈으로 확인하기 어렵고 고치려면 재시작을 기다려야 해서 원인을 늦게 찾는다.
 *
 * `WEB_ORIGIN`은 여전히 읽는다. 커스텀 도메인이나 프리뷰 배포처럼 **여기 없는
 * 주소를 더할 때** 쓴다 (덮어쓰기가 아니라 추가다).
 */
const ALWAYS_ALLOWED_ORIGINS = ["https://yun-cha-ants-web.vercel.app"];

export const env = {
  port: Number(process.env.PORT ?? 4300),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  /**
   * 허용 오리진 목록 — 위 기본 목록에 `WEB_ORIGIN`(쉼표 구분)을 **더한다.**
   * 개발 중에는 localhost·127.0.0.1·실기기 LAN IP가 섞여 들어오므로
   * app.ts에서 개발 모드일 때 이 목록 대신 전체 허용으로 간다.
   */
  // Array.from으로 만든다 — 배열 리터럴로 쓰면 `as const`가 readonly로 굳혀
  // @fastify/cors의 origin 옵션이 안 받는다.
  webOrigins: Array.from(
    new Set([
      ...ALWAYS_ALLOWED_ORIGINS,
      ...(process.env.WEB_ORIGIN ?? "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]),
  ),
  /**
   * KRX Data Marketplace OPEN API 인증키.
   * 없으면 목 종목으로 뜬다 — 개발에 지장은 없다.
   */
  krxAuthKey: process.env.KRX_AUTH_KEY?.trim() || undefined,
} as const;
