"use client";

import type { Ticker } from "@yca/shared";
import { useState } from "react";

/**
 * 종목 로고.
 *
 * 네이버 금융이 종목코드로 서빙하는 로고(SVG)를 시도하고, 없는 종목(신규 상장·스팩·
 * 리츠 등은 404가 온다)이나 로딩 실패면 **색 타일에 이름 첫 글자**로 떨어진다.
 * 화면 곳곳에 `<img>`를 흩뿌리지 말고 이 컴포넌트 하나를 거쳐 그린다 — 소스를 바꾸거나
 * 로고를 끄더라도 여기만 고치면 된다.
 *
 * 네이버 URL은 **비공식**이라 언제든 막힐 수 있다. 그래서 실패는 예외가 아니라
 * 정상 경로다 — `onError`가 뜨면 조용히 타일로 내려간다.
 *
 * 단일 HTML 목업은 오프라인/외부 차단 환경일 수 있어 로고가 안 뜰 수 있는데,
 * 그때도 같은 타일로 떨어지므로 화면은 깨지지 않는다.
 *
 * 색은 종목코드 해시라 같은 종목은 언제나 같은 색이다. 난수를 쓰면 서버와
 * 클라이언트가 다른 색을 내서 하이드레이션이 어긋난다.
 */

/** 네이버 금융 종목 로고 (종목코드 6자리 기준). 없는 종목은 404. */
function naverLogoUrl(symbol: string): string {
  return `https://ssl.pstatic.net/imgstock/fn/real/logo/stock/Stock${symbol}.svg`;
}

/**
 * 문자열 → 0~359.
 *
 * 마지막에 137을 곱하는 게 핵심이다. 종목코드는 전부 여섯 자리 숫자라 해시값이
 * 가깝게 모이고, 그대로 색상환에 얹으면 목록이 죄다 비슷한 초록으로 나온다.
 * 137은 360과 서로소여서 값이 1만 달라도 색이 137° 건너뛴다.
 */
function hue(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + (char.codePointAt(0) ?? 0)) % 3_600;

  return (value * 137) % 360;
}

/**
 * 타일에 넣을 글자. 라틴 이름(NAVER, SK하이닉스, POSCO홀딩스)은 두 글자까지 살리고,
 * 한글 이름은 첫 글자만 쓴다 — 한글은 두 글자를 넣으면 36px 타일에서 뭉갠다.
 */
function initial(name: string): string {
  const latin = /^[A-Za-z]{1,2}/.exec(name)?.[0];

  return latin ? latin.toUpperCase() : name.slice(0, 1);
}

export function TickerLogo({ ticker, className }: { ticker: Ticker; className?: string }) {
  const h = hue(ticker.symbol);
  const [failed, setFailed] = useState(false);

  // 로고는 종목코드 6자리에만 있다. 그 외(혹시 섞여 들어온 표준코드)는 바로 타일로.
  const showLogo = !failed && /^\d{6}$/.test(ticker.symbol);

  return (
    <span
      className={`relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold ${className ?? ""}`}
      style={{
        background: `hsl(${h}, 42%, 24%)`,
        color: `hsl(${h}, 62%, 74%)`,
      }}
      aria-hidden
    >
      {/* 타일은 항상 깔아둔다 — 로고가 실패하면 위 이미지만 사라지고 이게 드러난다. */}
      {initial(ticker.name)}

      {showLogo && (
        // 로고는 대개 어두운 잉크라 흰 바탕을 깔아야 앱 배경에서 보인다.
        <img
          src={naverLogoUrl(ticker.symbol)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full bg-white p-1 object-contain"
        />
      )}
    </span>
  );
}
