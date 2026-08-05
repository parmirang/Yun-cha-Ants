import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { MockMarket } from "@yca/shared";

import { env } from "./env.js";
import { loadKrxTickers } from "./krx.js";
import { registerHealthRoutes } from "./routes/health.js";
import { marketRoutes } from "./routes/market.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === "development" ? { level: "info" } : true,
  });

  /*
   * 종목 마스터와 전일 종가는 KRX에서 받아온다 (KRX OPEN API에는 장중 현재가가 없다).
   * 기동 때 한 번만 받으므로 종가를 갱신하려면 서버를 다시 띄운다.
   *
   * **이 호출을 기다리지 않는다.** 목 20종목으로 먼저 서 있다가 응답이 오면 갈아끼운다.
   * 예전엔 await로 붙잡았는데, KRX가 느리면(개장일을 못 찾아 12일치를 되짚는 최악의
   * 경우 요청 하나에 60초씩) 그동안 포트가 안 열려 서버가 죽은 것처럼 보였다.
   * Render 무료는 15분마다 잠들었다 깨므로 그 지연이 깰 때마다 반복된다.
   */
  const market = new MockMarket();
  market.start();

  void loadKrxTickers((message) => app.log.info(message)).then((krxTickers) => {
    if (krxTickers) market.replaceTickers(krxTickers);
  });

  app.addHook("onClose", async () => market.stop());

  // 개발 중에는 localhost / 127.0.0.1 / 휴대폰에서 접속하는 LAN IP가 모두 섞이므로
  // 오리진을 열어둔다. 배포 시에는 WEB_ORIGIN에 적힌 것만 허용한다.
  await app.register(cors, { origin: env.isDevelopment ? true : env.webOrigins });
  await app.register(registerHealthRoutes);
  await app.register(marketRoutes(market));

  return app;
}
