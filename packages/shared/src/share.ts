import { z } from "zod";

import { sceneLevelFromStage } from "./scene.js";
import { STAGE_COUNT } from "./status.js";

/**
 * SNS로 내보내는 스냅샷.
 * 연봉과 시급은 절대 포함하지 않는다 — 공유되는 건 "몇 시간"뿐이다.
 * 서버에 저장하지 않고 URL 자체에 실어 보내므로 링크가 곧 데이터다.
 *
 * **싣는 값은 되돌릴 수 있다고 보고 고른다.** 서버에 아무것도 저장하지 않아서 남의
 * 링크를 찾아낼 방법은 없지만, 받은 링크 하나는 계산기에 넣을 수 있다 — 종목명이
 * 실리면 그 종목의 종가는 누구나 조회하는 공개 정보이기 때문이다. 그래서 여기 있는
 * 필드는 "보여주고 싶은 것"이 아니라 **"역산돼도 괜찮은 것"**이어야 한다.
 */
export const shareSnapshotSchema = z.object({
  /**
   * 종목명. 길이를 24자로 자르고 글자 종류를 좁힌 건 개인정보 때문이 아니라
   * **토큰을 아무나 지어낼 수 있기 때문**이다 — 서명이 없어서 남의 이름이든 아무
   * 문장이든 박아 넣은 링크 카드를 우리 도메인에서 굽게 만들 수 있다. 실제 국내
   * 종목명은 전부 이 안에 들어온다 (제일 긴 리츠·스팩도 20자 아래다).
   */
  n: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 &.,\-()/%+]+$/),
  /** 복구/여유 시간 (초) */
  s: z.number().int().nonnegative(),
  /**
   * 배경 날씨 레벨 -3..+3.
   *
   * **예전엔 개미 50단계(`g`)를 그대로 실었는데, 그게 평단가를 되돌려줬다.** 50단계는
   * 수익률을 2%p 해상도로 알려주고, `평단 = 종가 ÷ (1 + 수익률)`이라 링크 하나로
   * "이 사람은 7만 7천 언저리에 샀다"가 ±1%로 나왔다 (실시간 시세를 붙이면 종가
   * 추정 오차까지 사라져 더 정확해진다). 화면이 실제로 쓰는 축은 어차피 이 7레벨이라
   * (개미 껍질 색은 연속 보간이라 2%p 차이가 눈에 안 보인다), 거기까지만 싣고
   * 받는 쪽은 `stageFromSceneLevel()`로 되돌린다 — 역산 정밀도가 ±5%로 흐려진다.
   */
  v: z.union([
    z.literal(-3),
    z.literal(-2),
    z.literal(-1),
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  /** mood: l=loss, p=profit, e=even */
  m: z.enum(["l", "p", "e"]),
});

export type ShareSnapshot = z.infer<typeof shareSnapshotSchema>;

/**
 * 50단계(`g`)를 싣던 옛 링크. **이미 나가 있는 링크가 404가 되면 안 되므로** 읽기만
 * 지원하고, 읽는 즉시 레벨로 접어 새 모양으로 돌려준다. 새로 만드는 링크에는 안 쓴다.
 *
 * 필드 이름을 `g`에서 `v`로 바꾼 건 값 범위가 겹치기 때문이다 — 둘 다 `g`면 `g: 0`이
 * 옛 링크의 "대손실"인지 새 링크의 "본전"인지 구분할 수가 없다.
 */
const legacySnapshotSchema = z.object({
  n: z.string().min(1).max(40),
  s: z.number().int().nonnegative(),
  g: z.number().int().min(0).max(STAGE_COUNT - 1),
  m: z.enum(["l", "p", "e"]),
});

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

/**
 * 종목명을 스키마가 받는 모양으로 다듬는다.
 *
 * **거르지 않고 다듬는다.** 스키마에 걸려 `encodeShareSnapshot`이 던지면 공유 버튼을
 * 감싼 async 핸들러가 그걸 삼켜서 **눌러도 아무 일이 없는 버튼**이 된다 — 이 앱에서
 * 제일 나쁜 실패 모양이고 실제로 한 번 겪었다(CLAUDE.md의 클립보드 문단 참고).
 * 이상한 글자가 섞인 종목명이 와도 공유는 되게 두고, 검증은 링크를 **읽는 쪽**에
 * 맡긴다 — 어차피 막고 싶은 건 손으로 지어낸 토큰이다.
 */
function sanitizeName(name: string): string {
  // 걸러낸 자리는 공백이 되므로 이어 붙은 공백은 하나로 접는다 —
  // 이모지 하나가 두 칸으로 세어져 이름 가운데가 휑하게 벌어지는 걸 막는다.
  const cleaned = name
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 &.,\-()/%+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 24).trim() || "종목";
}

export function encodeShareSnapshot(snapshot: ShareSnapshot): string {
  const safe = shareSnapshotSchema.parse({ ...snapshot, n: sanitizeName(snapshot.n) });

  return toBase64Url(JSON.stringify(safe));
}

/** 개미 단계를 그대로 받아 레벨로 접어 싣는다 — 호출부가 접는 걸 잊지 않도록. */
export function encodeShareSnapshotFromStage(
  snapshot: Omit<ShareSnapshot, "v"> & { stage: number },
): string {
  const { stage, ...rest } = snapshot;

  return encodeShareSnapshot({ ...rest, v: sceneLevelFromStage(stage) });
}

export function decodeShareSnapshot(token: string): ShareSnapshot | null {
  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }

  const current = shareSnapshotSchema.safeParse(payload);
  if (current.success) return current.data;

  const legacy = legacySnapshotSchema.safeParse(payload);
  if (!legacy.success) return null;

  const { g, ...rest } = legacy.data;

  return { ...rest, n: sanitizeName(rest.n), v: sceneLevelFromStage(g) };
}
