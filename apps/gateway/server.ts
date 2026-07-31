import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createHash } from "crypto";
import { createDb } from "@aigate/db";
import { chatCompletionsRoute } from "./routes/v1/chat-completions";
import { verifyRoute } from "./routes/v1/verify";

async function start() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
  });

  // Rate limit por chave (200 req/min por default) — a chave carrega o orgId,
  // então o efeito prático é rate limit por banca. Store em memória: o piloto
  // roda em uma réplica; migrar para o store distribuído (ioredis) quando
  // houver múltiplas instâncias.
  await fastify.register(rateLimit, {
    max: parseInt(process.env.TUTELA_RATE_LIMIT_MAX ?? "200", 10),
    timeWindow: process.env.TUTELA_RATE_LIMIT_WINDOW ?? "1 minute",
    // Bucket key: hash do Bearer para não guardar a chave em plain text.
    // Sem Bearer, cai num bucket "anon" compartilhado (também limitado).
    keyGenerator: (req) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) return "anon";
      return createHash("sha256").update(auth.slice(7)).digest("hex").slice(0, 16);
    },
    skipOnError: true,
    allowList: (req) => req.url === "/health" || req.method === "OPTIONS",
    errorResponseBuilder: (_req, ctx) => ({
      error: "Rate limit exceeded",
      message: `Máximo de ${ctx.max} requisições por ${ctx.after}. Tente novamente em ${Math.ceil(ctx.ttl / 1000)}s.`,
      retryAfter: Math.ceil(ctx.ttl / 1000),
    }),
  });

  const db = createDb(process.env.DATABASE_URL!);

  // Register routes
  await chatCompletionsRoute(fastify, db);
  await verifyRoute(fastify, db);

  // Health check
  fastify.get("/health", async () => ({ status: "ok", version: "1.0.0" }));

  const port = parseInt(process.env.GATEWAY_PORT ?? "3001", 10);
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`🚀 Tutela Gateway running on port ${port}`);
}

start().catch(console.error);
