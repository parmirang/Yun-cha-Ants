import { z } from "zod";

/**
 * Contracts shared by apps/api and apps/web.
 * The API validates against these; the web app derives its types from them,
 * so a change here surfaces as a type error on both sides.
 */

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
