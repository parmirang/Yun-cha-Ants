# Yung-chaAnts

pnpm 워크스페이스 모노레포. 웹(Next.js) + API(Fastify) + 둘이 공유하는 계약(zod 스키마).

> 도메인/제품 요구사항은 아직 정해지지 않았다. 스캐폴딩만 있는 상태이며,
> 첫 기능이 정해지면 이 문서 맨 아래 "도메인" 절을 채운다.

## 구조

```
apps/web        Next.js 15 (App Router, React 19, Tailwind v4) — 포트 3000
apps/api        Fastify 5 (TypeScript, ESM) — 포트 4300
packages/shared @yca/shared — web/api가 공유하는 zod 스키마와 타입
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

**공유 계약은 `packages/shared`에 둔다.** API 응답 모양은 zod 스키마로 정의하고,
API는 그 타입을 반환 타입으로, 웹은 `schema.parse()`로 응답을 검증한다.
타입을 양쪽에 따로 적어두지 않는다 — 한쪽만 고치면 조용히 어긋난다.
참고 구현: [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts) →
[apps/api/src/routes/health.ts](apps/api/src/routes/health.ts) →
[apps/web/src/components/api-health.tsx](apps/web/src/components/api-health.tsx).

**shared는 ESM + NodeNext로 빌드된다.** `packages/shared` 안의 상대 임포트는
반드시 `.js` 확장자를 붙인다 (`./schemas.js`). 확장자를 빼면 빌드는 통과하지만
런타임/번들러에서 모듈을 못 찾는다. api 소스도 동일하다.

**포트는 3000(web) / 4300(api).** 이 머신에는 다른 개발 서버가 3100·3300·4000~4102·4202를
이미 점유하고 있어서 4300을 골랐다. 바꿀 때는 `apps/api/src/env.ts`,
`apps/web/src/lib/api.ts`, 두 `.env.example`을 함께 고친다.

**환경변수는 `.env.example`에 반영한다.** 새 변수를 읽기 시작하면 예시 파일에도 추가한다.
API는 `apps/api/src/env.ts` 한 곳에서만 `process.env`를 읽는다.

**tsconfig는 루트 `tsconfig.base.json`을 상속한다.** `strict`에 더해
`noUncheckedIndexedAccess`, `noUnusedLocals`가 켜져 있다. 개별 패키지에서 끄지 않는다.

## 아직 없는 것

데이터베이스, 인증, 테스트 러너, 린터, CI. 필요해지는 시점에 추가하고
결정 사항을 이 문서에 적는다.

## 도메인

(미정)
