import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { AppError, runPipeline } from "@aigate/core";
import type { PipelineContext } from "@aigate/core";
import { apiKeys, requestLogs, providers } from "@aigate/db";
import { hashApiKey, decrypt } from "../../utils/encryption";
import { forwardToOpenAI } from "../../providers/openai-adapter";
import { forwardToAnthropic } from "../../providers/anthropic-adapter";
import type { createDb } from "@aigate/db";

const chatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  stream: z.boolean().optional().default(false),
});

export async function chatCompletionsRoute(
  fastify: FastifyInstance,
  db: ReturnType<typeof createDb>
) {
  fastify.post("/v1/chat/completions", async (request, reply) => {
    const startTime = Date.now();

    // Auth
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing API key" });
    }

    const rawKey = authHeader.slice(7);
    const keyHash = hashApiKey(rawKey);

    const apiKey = await db.query.apiKeys.findFirst({
      where: (k, { eq, and }) =>
        and(eq(k.keyHash, keyHash), eq(k.isActive, true)),
    });

    if (!apiKey) {
      return reply.status(401).send({ error: "Invalid API key" });
    }

    // Validate request
    const parseResult = chatRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid request",
        details: parseResult.error.flatten(),
      });
    }

    const ctx: PipelineContext = {
      requestId: crypto.randomUUID(),
      orgId: apiKey.orgId,
      apiKeyId: apiKey.id,
      departmentId: apiKey.departmentId ?? undefined,
      projectId: apiKey.projectId ?? undefined,
      source: "gateway",
      request: parseResult.data,
      startTime,
    };

    const result = await runPipeline(ctx, {
      db,
      getProviderKey: async (providerId) => {
        const provider = await db.query.providers.findFirst({
          where: (p, { eq }) => eq(p.id, providerId),
        });
        if (!provider) throw new AppError("PROVIDER_NOT_FOUND", "Provider not found", 404);

        let apiKeyDecrypted = provider.apiKeyEncrypted;
        if (!apiKeyDecrypted.startsWith("enc:")) {
          try {
            apiKeyDecrypted = decrypt(apiKeyDecrypted);
          } catch {
            // Use as-is for demo
          }
        } else {
          apiKeyDecrypted = apiKeyDecrypted.replace("enc:", "");
        }

        return {
          apiKey: apiKeyDecrypted,
          baseUrl: provider.baseUrl ?? null,
          providerType: provider.providerType,
        };
      },
      forwardRequest: async (providerType, modelId, apiKeyStr, baseUrl, req) => {
        if (providerType === "anthropic") {
          return forwardToAnthropic(modelId, apiKeyStr, baseUrl, req);
        }
        return forwardToOpenAI(modelId, apiKeyStr, baseUrl, req);
      },
    });

    // Log the request
    await db.insert(requestLogs).values({
      orgId: ctx.orgId,
      userId: ctx.userId ?? null,
      apiKeyId: ctx.apiKeyId ?? null,
      departmentId: ctx.departmentId ?? null,
      projectId: ctx.projectId ?? null,
      source: "gateway",
      providerType: ctx.resolvedProviderType ?? "openai",
      modelId: ctx.resolvedModelId ?? ctx.request.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      costUsd: result.costUsd.toFixed(6),
      latencyMs: result.latencyMs,
      status: result.status,
      blockedReason: result.blockedReason ?? null,
      dlpFlags: result.dlpFlags ?? null,
    });

    // Update last_used_at for the API key
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    if (!result.success) {
      const statusCode = result.error?.status ?? 500;
      return reply.status(statusCode).send({ error: result.error?.message ?? "Error" });
    }

    return reply.send(result.response);
  });
}
