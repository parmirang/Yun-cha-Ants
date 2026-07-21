import { type HealthResponse } from "@yca/shared";
import { type FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      service: "yung-chaants-api",
      uptimeSeconds: Math.round(process.uptime()),
    };
  });
}
