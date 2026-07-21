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
} as const;
