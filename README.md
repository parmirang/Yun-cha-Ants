# 영차Ants (Yung-chaAnts)

> 내 주식, 몇 시간 더 일하면 본전일까?

평가손익을 내 시급으로 나눠 `HH:MM:SS`로 보여주는 모바일 웹.
손익 상태는 픽셀아트 개미의 상태(50단계)로 표현된다.

- 연봉 → 시급 환산 (월 209시간 기준)
- 종목 검색 → 평단가·수량 입력
- 실시간 시세로 "얼마나 더 일해야 하는지" 카운트
- 개미를 탭해 물타기 / 불타기
- 시급은 빼고 **시간만** 담은 링크 공유 (OG 카드 자동 생성)

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
- API: http://localhost:4300

휴대폰 실기기로 볼 때는 같은 와이파이에서 `http://<맥의 LAN IP>:3000` 으로 접속하고,
`apps/web/.env.local`의 `NEXT_PUBLIC_API_URL`도 같은 IP로 바꾼다.
개발 모드 API는 모든 오리진을 허용하므로 별도 설정은 필요 없다.

## 워크스페이스

| 경로 | 패키지 | 내용 |
| --- | --- | --- |
| `apps/web` | `@yca/web` | Next.js 15 App Router, React 19, Tailwind v4 |
| `apps/api` | `@yca/api` | Fastify 5, 목 시세 엔진, SSE 스트림 |
| `packages/shared` | `@yca/shared` | 시급·손익·단계 계산과 zod 스키마 |

## API

| 엔드포인트 | 설명 |
| --- | --- |
| `GET /health` | 헬스체크 |
| `GET /tickers?q=` | 종목 검색 (목 데이터 20종목) |
| `GET /quotes?symbols=a,b` | 현재 시세 |
| `GET /quotes/stream?symbols=a,b` | 1초 간격 SSE 시세 스트림 |

**시세는 아직 목 데이터다.** 랜덤워크로 생성되며 실제 시장과 무관하다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | shared 빌드 후 전체 개발 서버 실행 |
| `pnpm dev:web` / `pnpm dev:api` | 개별 실행 |
| `pnpm typecheck` | 전 패키지 타입 검사 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm clean` | 빌드 산출물과 node_modules 삭제 |

개발 규칙과 도메인 결정 사항은 [CLAUDE.md](CLAUDE.md) 참고.

## 목업

서버 없이 파일 하나로 도는 목업을 굽는다.

```bash
pnpm --filter @yca/web mockup
# → apps/web/mockup/dist/yungcha-ants.html
```

실제 컴포넌트와 계산 로직을 그대로 번들하고, 서버가 필요한 세 지점만 브라우저용
구현으로 바꿔 끼운다. 브라우저에서 바로 열거나 그대로 남에게 보내면 된다.
