import type { QuoteList, Ticker } from "@yca/shared";
import type { FastifyInstance } from "fastify";

import { env } from "../env.js";
import type { MockMarket } from "../mock/market.js";

/**
 * SSE는 reply.raw.writeHead()로 헤더를 직접 쓰기 때문에 @fastify/cors가 붙여둔
 * 헤더가 통째로 날아간다. 같은 정책을 여기서 한 번 더 계산해 실어준다.
 */
function allowedOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  if (env.isDevelopment) return origin;

  return env.webOrigins.includes(origin) ? origin : undefined;
}

interface SearchQuery {
  q?: string;
}

interface QuoteQuery {
  symbols?: string;
}

function parseSymbols(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function marketRoutes(market: MockMarket) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: SearchQuery }>("/tickers", async (request) => {
      const tickers: Ticker[] = market.search(request.query.q ?? "");
      return { tickers };
    });

    app.get<{ Querystring: QuoteQuery }>("/quotes", async (request): Promise<QuoteList> => {
      return { quotes: market.getQuotes(parseSymbols(request.query.symbols)) };
    });

    /** 1초마다 시세를 밀어주는 SSE 스트림. 브라우저는 EventSource로 붙는다. */
    app.get<{ Querystring: QuoteQuery }>("/quotes/stream", (request, reply) => {
      const symbols = parseSymbols(request.query.symbols);

      const origin = allowedOrigin(request.headers.origin);

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // nginx 등 리버스 프록시가 SSE를 버퍼링하지 않도록.
        "X-Accel-Buffering": "no",
        ...(origin
          ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
          : {}),
      });

      const send = () => {
        const payload: QuoteList = { quotes: market.getQuotes(symbols) };
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      send();
      const unsubscribe = market.subscribe(send);

      request.raw.on("close", () => {
        unsubscribe();
        reply.raw.end();
      });
    });
  };
}
