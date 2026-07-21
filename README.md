# Yung-chaAnts

Next.js 웹 + Fastify API + 공유 스키마로 구성된 pnpm 워크스페이스 모노레포.

## 요구 사항

- Node.js 20 이상 (`.nvmrc`: 24)
- pnpm 10

## 시작하기

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

- 웹: http://localhost:3000
- API: http://localhost:4300 (`GET /health`)

첫 화면에 API 헬스체크 결과가 표시되면 web → api → 공유 스키마 배선이 정상이다.

## 워크스페이스

| 경로 | 패키지 | 내용 |
| --- | --- | --- |
| `apps/web` | `@yca/web` | Next.js 15 App Router, React 19, Tailwind v4 |
| `apps/api` | `@yca/api` | Fastify 5, TypeScript ESM |
| `packages/shared` | `@yca/shared` | 웹/API가 공유하는 zod 스키마와 타입 |

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | shared 빌드 후 전체 개발 서버 실행 |
| `pnpm dev:web` / `pnpm dev:api` | 개별 실행 |
| `pnpm typecheck` | 전 패키지 타입 검사 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm clean` | 빌드 산출물과 node_modules 삭제 |

자세한 개발 규칙은 [CLAUDE.md](CLAUDE.md) 참고.
