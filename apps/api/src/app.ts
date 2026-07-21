import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { env } from "./env.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === "development" ? { level: "info" } : true,
  });

  await app.register(cors, { origin: env.webOrigin });
  await app.register(registerHealthRoutes);

  return app;
}
