"use client";

import Link from "next/link";

import { track } from "@/lib/analytics";

/**
 * 공유 화면 맨 아래에 붙는 **단 하나의** 버튼.
 *
 * 공유 링크를 받고 들어온 사람이 앱으로 넘어가는 지점 — 공유가 실제로 새 유저를
 * 데려오는지 보려고 클릭을 남긴다. 그 한 줄 때문에 서버 컴포넌트인 공유 화면에서
 * 이 버튼만 클라이언트로 떼어냈다.
 *
 * 문구는 **"다시 계산해보기"**다. 받은 사람이 보고 있는 건 남의 손익이니,
 * 여기서 할 일은 앱 구경이 아니라 내 평단을 넣어 같은 계산을 돌리는 것이다.
 */
export function ShareCta() {
  return (
    <Link
      className="btn-primary mt-auto w-full text-center"
      href="/"
      onClick={() => track("share_cta_click")}
    >
      다시 계산해보기
    </Link>
  );
}
