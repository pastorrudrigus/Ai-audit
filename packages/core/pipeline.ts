import type { createDb } from "@aigate/db";
import type { PipelineContext, PipelineResult, ChatCompletionRequest } from "./types";
import { AppError } from "./types";
import { scanMessages } from "./dlp";
import { calculateCost, estimateMessagesTokens, estimateCost } from "./cost";

type Db = ReturnType<typeof createDb>;

export interface PipelineConfig {
  db: Db;
  forwardRequest: (
    providerType: string,
    modelId: string,
    apiKey: string,
    baseUrl: string | null,
    request: ChatCompletionRequest
  ) => Promise<{ response: unknown; inputTokens: number; outputTokens: number }>;
  getProviderKey: (providerId: string) => Promise<{ apiKey: string; baseUrl: string | null; providerType: string }>;
}

export async function runPipeline(
  ctx: PipelineContext,
  config: PipelineConfig
): Promise<PipelineResult> {
  const { db } = config;

  try {
    // Step 1: Policy check
    const policies = await db.query.policies.findMany({
      where: (p, { eq, and }) =>
        and(eq(p.orgId, ctx.orgId), eq(p.isActive, true)),
    });

    for (const policy of policies) {
      if (policy.type === "model_access") {
        const rules = policy.rules as { allowedModels?: string[] };
        const scope = policy.scope as { departmentIds?: string[] };

        if (
          ctx.departmentId &&
          scope.departmentIds?.includes(ctx.departmentId) &&
          rules.allowedModels &&
          !rules.allowedModels.includes(ctx.request.model)
        ) {
          return {
            success: false,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            latencyMs: Date.now() - ctx.startTime,
            status: "blocked_policy",
            blockedReason: `Model ${ctx.request.model} not allowed for your department`,
            error: new AppError("POLICY_VIOLATION", "Model access denied", 403),
          };
        }
      }
    }

    // Step 2: DLP scan
    const dlpPolicy = policies.find((p) => p.type === "dlp");
    if (dlpPolicy) {
      const rules = dlpPolicy.rules as { action?: string; patterns?: string[] };
      const dlpResult = scanMessages(ctx.request.messages, rules.patterns);

      if (dlpResult.hasViolation) {
        if (rules.action === "block") {
          return {
            success: false,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            latencyMs: Date.now() - ctx.startTime,
            status: "blocked_dlp",
            blockedReason: `DLP violation: ${dlpResult.matches.map((m) => m.label).join(", ")} detected`,
            dlpFlags: dlpResult.matches,
            error: new AppError("DLP_VIOLATION", "Content blocked by DLP policy", 403),
          };
        }
      }
    }

    // Step 3: Route resolution
    const routingRules = await db.query.routingRules.findMany({
      where: (r, { eq, and }) =>
        and(eq(r.orgId, ctx.orgId), eq(r.isActive, true)),
      orderBy: (r, { asc }) => [asc(r.priority)],
    });

    let targetProviderId = ctx.resolvedProviderId;
    let targetModelId = ctx.resolvedModelId ?? ctx.request.model;

    if (!targetProviderId && routingRules.length > 0) {
      const rule = routingRules[0]; // First matching rule
      targetProviderId = rule.targetProviderId;
      targetModelId = rule.targetModelId;
    }

    // Fallback: use first active provider
    if (!targetProviderId) {
      const provider = await db.query.providers.findFirst({
        where: (p, { eq, and }) =>
          and(eq(p.orgId, ctx.orgId), eq(p.isActive, true)),
      });
      if (!provider) {
        throw new AppError("NO_PROVIDER", "No provider configured", 503);
      }
      targetProviderId = provider.id;
    }

    // Step 4: Budget check
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const estimatedInputTokens = estimateMessagesTokens(ctx.request.messages);
    const estimatedCost = estimateCost(targetModelId, estimatedInputTokens);

    const budget = await db.query.budgets.findFirst({
      where: (b, { eq, and, isNull }) =>
        and(
          eq(b.orgId, ctx.orgId),
          eq(b.period, period),
          ctx.departmentId ? eq(b.departmentId, ctx.departmentId) : isNull(b.departmentId)
        ),
    });

    if (budget?.isHardLimit) {
      const totalSpent =
        Number(budget.spentGateway) + Number(budget.spentPlatforms);
      const limit = Number(budget.limitAmount);
      if (totalSpent + estimatedCost > limit) {
        return {
          success: false,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - ctx.startTime,
          status: "blocked_budget",
          blockedReason: "Monthly budget exceeded",
          error: new AppError("BUDGET_EXCEEDED", "Budget limit reached", 402),
        };
      }
    }

    // Step 5: Forward request
    const providerInfo = await config.getProviderKey(targetProviderId);
    const startForward = Date.now();

    const { response, inputTokens, outputTokens } = await config.forwardRequest(
      providerInfo.providerType,
      targetModelId,
      providerInfo.apiKey,
      providerInfo.baseUrl,
      { ...ctx.request, model: targetModelId }
    );

    const latencyMs = Date.now() - ctx.startTime;
    const costUsd = calculateCost(targetModelId, inputTokens, outputTokens);

    return {
      success: true,
      response: response as import("./types").ChatCompletionResponse,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs,
      status: "success",
    };
  } catch (err) {
    const latencyMs = Date.now() - ctx.startTime;
    if (err instanceof AppError) {
      return {
        success: false,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs,
        status: "error",
        blockedReason: err.message,
        error: err,
      };
    }
    const error = new AppError("INTERNAL_ERROR", "Internal server error", 500);
    return {
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs,
      status: "error",
      blockedReason: "Internal error",
      error,
    };
  }
}
