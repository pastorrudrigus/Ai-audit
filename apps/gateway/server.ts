import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@aigate/db";
import { chatCompletionsRoute } from "./routes/v1/chat-completions";

async function start() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
  });

  const db = createDb(process.env.DATABASE_URL!);

  // Register routes
  await chatCompletionsRoute(fastify, db);

  // Health check
  fastify.get("/health", async () => ({ status: "ok", version: "1.0.0" }));

  const port = parseInt(process.env.GATEWAY_PORT ?? "3001", 10);
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`🚀 AIGate Gateway running on port ${port}`);
}

start().catch(console.error);
