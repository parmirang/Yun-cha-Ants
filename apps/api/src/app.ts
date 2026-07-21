import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { MockMarket } from "@yca/shared";

import { env } from "./env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { marketRoutes } from "./routes/market.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === "development" ? { level: "info" } : true,
  });

  const market = new MockMarket();
  market.start();
  app.addHook("onClose", async () => market.stop());

  // 개발 중에는 localhost / 127.0.0.1 / 휴대폰에서 접속하는 LAN IP가 모두 섞이므로
  // 오리진을 열어둔다. 배포 시에는 WEB_ORIGIN에 적힌 것만 허용한다.
  await app.register(cors, { origin: env.isDevelopment ? true : env.webOrigins });
  await app.register(registerHealthRoutes);
  await app.register(marketRoutes(market));

  return app;
}
