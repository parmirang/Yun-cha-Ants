import { z } from "zod";

import { STAGE_COUNT } from "./status.js";

/**
 * SNS로 내보내는 스냅샷.
 * 연봉과 시급은 절대 포함하지 않는다 — 공유되는 건 "몇 시간"뿐이다.
 * 서버에 저장하지 않고 URL 자체에 실어 보내므로 링크가 곧 데이터다.
 */
export const shareSnapshotSchema = z.object({
  /** 종목명 */
  n: z.string().min(1).max(40),
  /** 복구/여유 시간 (초) */
  s: z.number().int().nonnegative(),
  /** 엔트 단계 0..49 */
  g: z.number().int().min(0).max(STAGE_COUNT - 1),
  /** mood: l=loss, p=profit, e=even */
  m: z.enum(["l", "p", "e"]),
});

export type ShareSnapshot = z.infer<typeof shareSnapshotSchema>;

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

export function encodeShareSnapshot(snapshot: ShareSnapshot): string {
  return toBase64Url(JSON.stringify(shareSnapshotSchema.parse(snapshot)));
}

export function decodeShareSnapshot(token: string): ShareSnapshot | null {
  try {
    return shareSnapshotSchema.parse(JSON.parse(fromBase64Url(token)));
  } catch {
    return null;
  }
}
