import { healthResponseSchema } from "@yca/shared";

import { apiBaseUrl } from "@/lib/api";

/**
 * Server component: proves the web -> api -> shared-schema wiring end to end.
 * Replace once there is a real first feature.
 */
export async function ApiHealth() {
  let body: string;

  try {
    const response = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });
    const health = healthResponseSchema.parse(await response.json());
    body = `${health.service} · up ${health.uptimeSeconds}s`;
  } catch {
    body = `API에 연결할 수 없습니다 (${apiBaseUrl}). pnpm dev:api 를 실행하세요.`;
  }

  return (
    <div className="rounded-lg border border-current/15 px-4 py-3 text-sm">
      <span className="font-medium">API</span>
      <span className="opacity-70"> — {body}</span>
    </div>
  );
}
