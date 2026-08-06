import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { BRAND, SHARE_TAGLINE } from "@/lib/share-copy";

import "./globals.css";

/*
 * GA4 측정 ID는 **비밀이 아니다** — gtag 스크립트 태그로 페이지 소스에 그대로 드러나서
 * 환경변수로 숨겨봐야 의미가 없다. 그래서 코드에 박아둔다. Vercel 환경변수를 안 건드려도
 * 배포하면 바로 켜지고, 값을 바꾸려면 여기만 고치면 된다.
 * NEXT_PUBLIC_GA_ID를 넣으면 그쪽이 이긴다 (다른 속성으로 시험해볼 때).
 */
const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-RXGLBBZ0TY";

/*
 * 개발 모드에서는 안 싣는다 — pnpm dev로 화면 만지며 누른 게 실제 통계에 섞이면
 * 온보딩 전환율이 통째로 거짓말이 된다. 이벤트도 gtag가 없어 같이 조용해진다
 * (apps/web/src/lib/analytics.ts).
 */
const gaEnabled = process.env.NODE_ENV === "production";

/*
 * gtag를 직접 깐다 (@next/third-parties의 GoogleAnalytics를 안 쓴다).
 *
 * **공유 링크 주소가 통째로 GA에 쌓이기 때문이다.** GA4는 페이지뷰에 현재 주소를
 * 자동으로 싣는데, 그 주소가 `/s/eyJuIjoi...`라 토큰이 그대로 딸려 간다 — base64일
 * 뿐이라 누구든 풀면 종목명·시간·단계가 나온다. 재무 정보는 기기 밖으로 안 나간다는
 * 규칙(analytics.ts)을 파라미터에서는 지키면서 주소로 흘리는 셈이라, config에
 * **토큰을 뗀 주소**를 직접 넣어 보낸다. 대문에서 들어온 사람 수는 그대로 잡히고,
 * 어느 링크였는지만 안 남는다.
 *
 * 링크에서 대문으로 넘어오면 referrer에도 같은 주소가 실리므로 그쪽도 같이 뗀다.
 */
const gaInitScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
(function () {
  function mask(url) {
    try {
      var parsed = new URL(url);
      if (parsed.pathname.indexOf('/s/') === 0) parsed.pathname = '/s';
      return parsed.toString();
    } catch (error) {
      return '';
    }
  }
  var params = { page_location: mask(location.href) || location.origin };
  var referrer = mask(document.referrer);
  if (referrer) params.page_referrer = referrer;
  gtag('config', '${gaId}', params);
})();
`;

/*
 * OG 카드(og:image)는 **절대 주소로 실려야** 카카오톡·X가 그림을 가져간다.
 * 안 적어두면 Next가 배포마다 바뀌는 주소나 localhost로 채워 넣어 미리보기가 빈다.
 * Vercel이 넣어주는 프로덕션 도메인을 기본으로 쓰고, 커스텀 도메인을 붙였거나
 * 다른 곳에 올릴 때만 NEXT_PUBLIC_SITE_URL로 덮는다.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: BRAND,
  description: SHARE_TAGLINE,
  openGraph: {
    type: "website",
    siteName: BRAND,
    locale: "ko_KR",
    title: BRAND,
    description: SHARE_TAGLINE,
  },
  // 카드를 크게 펼쳐 보여준다 (기본값은 글자 옆 썸네일 크기다).
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 모바일 웹에서 입력 필드 포커스 시 확대되는 걸 막는다.
  maximumScale: 1,
  themeColor: "#14100c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
        {gaEnabled && (
          <>
            <Script id="ga-init" dangerouslySetInnerHTML={{ __html: gaInitScript }} />
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          </>
        )}
      </body>
    </html>
  );
}
