export const env = {
  port: Number(process.env.PORT ?? 4300),
  host: process.env.HOST ?? "0.0.0.0",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
} as const;
