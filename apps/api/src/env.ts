// apps/api/.env를 읽는다. 파일이 없으면 조용히 넘어가고 실제 환경변수만 쓴다.
try {
  process.loadEnvFile?.();
} catch {
  // .env 없음 — 배포 환경에서는 정상이다.
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  port: Number(process.env.PORT ?? 4300),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv,
  isDevelopment: nodeEnv === "development",
  /**
   * 허용 오리진 목록 (쉼표 구분).
   * 개발 중에는 localhost·127.0.0.1·실기기 LAN IP가 섞여 들어오므로
   * app.ts에서 개발 모드일 때 이 목록 대신 전체 허용으로 간다.
   */
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * KRX Data Marketplace OPEN API 인증키.
   * 없으면 목 종목으로 뜬다 — 개발에 지장은 없다.
   */
  krxAuthKey: process.env.KRX_AUTH_KEY?.trim() || undefined,
} as const;
