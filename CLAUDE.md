# Yung-chaAnts (영차Ants)

내가 산 주식의 평가손익을 **내 시급으로 환산해서 "몇 시간 더 일해야 본전인지"** 보여주는
모바일 웹. 손익 상태는 픽셀아트 엔트(나무 정령)의 상태로 표현된다.

pnpm 워크스페이스 모노레포. 웹(Next.js) + API(Fastify) + 둘이 공유하는 계약(zod 스키마).

## 도메인

핵심 흐름은 **연봉 → 시급 → 손익 → 시간**이다.

1. 연봉을 입력하면 시급이 나온다 (월 소정근로시간 209시간 기준, 세전).
2. 종목을 검색해 평단가와 보유 수량을 입력한다.
3. `(현재가 − 평단가) × 수량`을 시급으로 나눠 `HH:MM:SS`를 만든다.
   - 손실 → "만큼 더 벌어야 해.."
   - 수익 → "만큼 안 일해도 돼!"
4. 시세는 1초마다 SSE로 들어오고 카운터는 실시간으로 움직인다.

계산은 전부 [packages/shared/src/status.ts](packages/shared/src/status.ts)에 있다.
화면은 이 함수의 결과만 그린다 — 컴포넌트 안에서 손익을 다시 계산하지 않는다.

### 엔트 50단계

수익률을 50단계로 나눈다. **25단계가 본전이고 한 단계는 수익률 2%p**
(표현 범위 -50% ~ +48%, 바깥은 clamp). 단계가 오를수록 잎이 마른 갈색 →
무성한 초록으로 연속 보간된다. 버킷이 아니라 보간이라 계단이 안 보인다.

### 색 규칙

국내 시장 관행을 따른다 — **수익은 빨강(`--up`), 손실은 파랑(`--down`)**.
발자국·카운터·평가손익 모두 이 규칙을 공유하며, `data-mood` 속성이
`--mood-color`를 바꾸는 방식으로 한 곳에서 결정된다
([globals.css](apps/web/src/app/globals.css)).

### 공유

연봉과 시급은 **절대 공유되지 않는다.** 링크에 실리는 건 종목명·시간·단계·손익여부뿐이고,
서버에 저장하지 않고 URL 자체에 base64url로 인코딩한다
([packages/shared/src/share.ts](packages/shared/src/share.ts) → `/s/[snapshot]`).
새 필드를 추가할 때 시급·연봉·금액이 새어나가지 않는지 반드시 확인할 것.

### 물타기 / 불타기

엔트를 탭하면 추가 매수 시트가 열린다. 계산은 `averageIn()` 하나이고
현재가가 평단보다 낮으면 "물타기", 높으면 "불타기"로 라벨만 바뀐다.

## 구조

```
apps/web        Next.js 15 (App Router, React 19, Tailwind v4) — 포트 3000
apps/api        Fastify 5 (TypeScript, ESM) — 포트 4300
packages/shared @yca/shared — web/api가 공유하는 zod 스키마와 계산 로직
```

패키지 이름은 `@yca/*` 스코프를 쓴다 (`@yca/web`, `@yca/api`, `@yca/shared`).

## 명령어

루트에서 실행한다.

```bash
pnpm install       # 의존성 설치
pnpm dev           # shared 빌드 후 web+api+shared watch 동시 실행
pnpm dev:web       # 웹만
pnpm dev:api       # API만
pnpm typecheck     # 전 패키지 tsc --noEmit
pnpm build         # shared → apps 순서로 프로덕션 빌드
```

`pnpm dev*` / `pnpm typecheck` / `pnpm build`는 모두 **먼저 `@yca/shared`를 빌드**한다.
shared는 `dist/`를 배포하므로 빌드 전에는 web/api가 임포트를 해소하지 못한다.

## 규칙

**시세는 아직 목 데이터다.** [apps/api/src/mock/](apps/api/src/mock/)의 랜덤워크가
1초마다 가격을 만든다. 실제 시세를 붙일 때는 `MockMarket`과 같은 모양
(`search` / `getQuotes` / `subscribe`)의 구현체로 갈아끼우면 라우트와 웹은 그대로 둔다.

**공유 계약은 `packages/shared`에 둔다.** API 응답 모양은 zod 스키마로 정의하고,
API는 그 타입을 반환 타입으로, 웹은 `schema.parse()`로 응답을 검증한다.
타입을 양쪽에 따로 적어두지 않는다 — 한쪽만 고치면 조용히 어긋난다.

**shared는 ESM + NodeNext로 빌드된다.** `packages/shared` 안의 상대 임포트는
반드시 `.js` 확장자를 붙인다 (`./status.js`). 확장자를 빼면 빌드는 통과하지만
런타임/번들러에서 모듈을 못 찾는다. api 소스도 동일하다.

**SVG 색은 `hsl()`에 정수만 넣는다.** OG 이미지를 굽는 resvg는 소수점 hue를
거부하고 fill을 **검정으로 떨군다** (브라우저는 멀쩡히 그려서 눈치채기 어렵다).
`entPalette()`의 `hsl()` 헬퍼가 반올림을 담당하니 우회하지 말 것.

**SSE 라우트는 CORS 헤더를 직접 실어야 한다.** `reply.raw.writeHead()`가
`@fastify/cors`가 붙인 헤더를 통째로 덮어쓴다. `/quotes/stream`의
`allowedOrigin()`이 그래서 존재한다 — 지우면 브라우저에서 시세가 안 들어온다.

**개발 모드에서는 CORS를 열어둔다.** 실기기로 LAN IP 접속해 테스트해야 하기 때문이다.
배포 시에는 `WEB_ORIGIN`(쉼표 구분)에 적힌 오리진만 허용된다.

**포트는 3000(web) / 4300(api).** 이 머신에는 다른 개발 서버가 3100·3300·4000~4102·4202를
이미 점유하고 있어서 4300을 골랐다. 바꿀 때는 `apps/api/src/env.ts`,
`apps/web/src/lib/api.ts`, 두 `.env.example`을 함께 고친다.

**연봉·보유종목은 localStorage에만 둔다.** 서버로 보내지 않는다
([apps/web/src/lib/storage.ts](apps/web/src/lib/storage.ts)).

**tsconfig는 루트 `tsconfig.base.json`을 상속한다.** `strict`에 더해
`noUncheckedIndexedAccess`, `noUnusedLocals`가 켜져 있다. 개별 패키지에서 끄지 않는다.

## 아직 없는 것

실제 시세 연동, 다종목 보유, 데이터베이스, 인증, 테스트 러너, 린터, CI,
네이티브 앱(모바일 웹 다음 단계). 필요해지는 시점에 추가하고 결정 사항을 여기 적는다.
