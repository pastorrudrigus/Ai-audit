/**
 * POST /v1/verify — verificação de citações jurídicas.
 *
 * Contrato:
 *   Request:  { "text": "…" }  (a peça ou a resposta do LLM)
 *              — ou —
 *              { "citations": [{ referencia, tipoCitacao, trecho }] }
 *   Response: { citations: [...], summary: {...}, latencyMs: N }
 *
 * Auth: mesmo Bearer aig_sk_... do /v1/chat/completions.
 * Uso: chamado pelo Portal do Advogado ao clicar "Verificar antes do protocolo".
 * Cada chamada é auditada em request_logs com metadata.kind = "citation_check".
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import {
  extractCitations,
  verifyCitations,
  createWebSearchSource,
  type Citation,
  type CitationSource,
} from "@aigate/verify";
import type { createDb } from "@aigate/db";
import { apiKeys, requestLogs } from "@aigate/db";
import { authenticateRequest } from "../../utils/auth";

const bodySchema = z.union([
  z.object({
    text: z.string().min(1),
    citations: z.undefined().optional(),
  }),
  z.object({
    text: z.string().optional(),
    citations: z
      .array(
        z.object({
          referencia: z.string().min(1),
          tipoCitacao: z.enum(["jurisprudencia", "legislacao"]),
          trecho: z.string().min(1),
        })
      )
      .min(1),
  }),
]);

/**
 * Constrói o Redis Upstash uma vez por instância do gateway. Sem env, cai
 * para undefined — a verificação continua funcionando, só sem cache.
 */
function buildRedis(): Redis | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  return new Redis({ url, token });
}

export async function verifyRoute(
  fastify: FastifyInstance,
  db: ReturnType<typeof createDb>
) {
  // Upstash Redis satisfaz o RedisLike do @aigate/verify (mesmos métodos get/set),
  // mas seus tipos genéricos são mais estritos — cast controlado é seguro aqui.
  const redis = buildRedis() as unknown as import("@aigate/verify").RedisLike | undefined;
  const sources: CitationSource[] = [createWebSearchSource()];

  fastify.post("/v1/verify", async (request, reply) => {
    const startTime = Date.now();

    const auth = await authenticateRequest(request, reply, db);
    if (!auth) return; // reply já foi enviada

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid request",
        details: parseResult.error.flatten(),
      });
    }

    // Extração — se o cliente já mandou citações prontas, pula o LLM extrator
    let citations: Citation[];
    if ("citations" in parseResult.data && parseResult.data.citations) {
      citations = parseResult.data.citations;
    } else if (parseResult.data.text) {
      citations = await extractCitations(parseResult.data.text);
    } else {
      return reply.status(400).send({ error: "Provide 'text' or 'citations'" });
    }

    if (citations.length === 0) {
      const latencyMs = Date.now() - startTime;
      // Log mínimo — mesmo sem citação, o pedido consumiu recursos
      await db.insert(requestLogs).values({
        orgId: auth.orgId,
        apiKeyId: auth.id,
        departmentId: auth.departmentId,
        projectId: auth.projectId,
        source: "gateway",
        providerType: "internal",
        modelId: "citation_check",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: "0",
        latencyMs,
        status: "success",
        metadata: { kind: "citation_check", total: 0 },
      });
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, auth.id));

      return reply.send({
        citations: [],
        summary: { total: 0, confirmada: 0, divergente: 0, nao_encontrada: 0, erro: 0 },
        latencyMs,
      });
    }

    const verifyResult = await verifyCitations(citations, { sources, redis });

    await db.insert(requestLogs).values({
      orgId: auth.orgId,
      apiKeyId: auth.id,
      departmentId: auth.departmentId,
      projectId: auth.projectId,
      source: "gateway",
      providerType: "internal",
      modelId: "citation_check",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: "0",
      latencyMs: verifyResult.latencyMs,
      status: "success",
      // metadata.kind identifica o log; guardamos só os agregados (sem os trechos)
      metadata: {
        kind: "citation_check",
        ...verifyResult.summary,
        fromCacheCount: verifyResult.citations.filter((c) => c.fromCache).length,
      },
    });

    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, auth.id));

    return reply.send({
      citations: verifyResult.citations,
      summary: verifyResult.summary,
      latencyMs: verifyResult.latencyMs,
    });
  });
}
