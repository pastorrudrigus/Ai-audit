import type { createDb } from "@aigate/db";
import type {
  PipelineContext,
  PipelineResult,
  ChatCompletionRequest,
  OpenAIMessage,
} from "./types";
import { AppError } from "./types";
import {
  scanForPII,
  scanMessages,
  tokenizePII,
  summarizeMatches,
  type DLPMatch,
  type EntityMapping,
} from "./dlp";
import { detectNamedEntities } from "./ner";
import { calculateCost, estimateMessagesTokens, estimateCost } from "./cost";
import { classifyComplexity } from "./complexity";

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
  getProviderKey: (
    providerId: string
  ) => Promise<{ apiKey: string; baseUrl: string | null; providerType: string }>;
  /**
   * Cifra o entityMap serializado antes de devolver ao cliente. Recebe uma
   * string JSON e retorna o texto cifrado (AES-256-GCM). Se omitido, o
   * entityMap é descartado — modo mais seguro por default.
   */
  encryptEntityMap?: (json: string) => string;
}

interface DlpPolicyRules {
  action?: "block" | "warn" | "anonymize" | "mask";
  patterns?: string[];
  nerTypes?: string[];
}

interface RoutingConditions {
  taskComplexity?: "simple" | "complex";
  maxInputTokens?: number;
  departmentIds?: string[];
}

/**
 * Avalia as conditions de uma routing_rule contra o contexto da requisição.
 * Condição ausente = casa. Regra sem conditions = curinga (sempre casa).
 */
function matchesRoutingConditions(
  conditions: unknown,
  ctx: {
    departmentId?: string;
    complexity: "simple" | "complex";
    inputTokens: number;
  }
): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  const c = conditions as RoutingConditions;

  if (c.taskComplexity && c.taskComplexity !== ctx.complexity) return false;
  if (typeof c.maxInputTokens === "number" && ctx.inputTokens > c.maxInputTokens) return false;
  if (c.departmentIds && c.departmentIds.length > 0) {
    if (!ctx.departmentId || !c.departmentIds.includes(ctx.departmentId)) return false;
  }
  return true;
}

/**
 * Substitui os conteúdos das mensagens do usuário/system pelo texto tokenizado.
 * Mensagens do assistente ficam intactas (não vieram do usuário).
 */
function applyTokenization(
  messages: OpenAIMessage[],
  perMessageMasked: Map<number, string>
): OpenAIMessage[] {
  return messages.map((m, i) =>
    perMessageMasked.has(i) ? { ...m, content: perMessageMasked.get(i)! } : m
  );
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

    // Step 2: DLP scan + anonimização reversível
    const dlpPolicy = policies.find((p) => p.type === "dlp");
    let request = ctx.request;
    let entityMap: EntityMapping[] = [];
    let dlpFlags: unknown = null;
    let anonymizedCount = 0;
    let nerStatus: "ok" | "skipped" | "failed" | "not_run" = "not_run";

    if (dlpPolicy) {
      const rules = (dlpPolicy.rules as DlpPolicyRules) ?? {};
      const patterns = rules.patterns; // undefined = todos os padrões
      const action = rules.action ?? "warn";

      // Ação block: mantém o comportamento antigo (bloqueia se detectar qualquer coisa).
      if (action === "block") {
        const dlpResult = scanMessages(request.messages, patterns);
        if (dlpResult.hasViolation) {
          const summary = summarizeMatches(dlpResult.matches);
          return {
            success: false,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            latencyMs: Date.now() - ctx.startTime,
            status: "blocked_dlp",
            blockedReason: `DLP violation: ${Object.keys(summary.byType).join(", ")} detected`,
            dlpFlags: { action, ...summary, nerStatus: "not_run" as const },
            error: new AppError("DLP_VIOLATION", "Content blocked by DLP policy", 403),
          };
        }
      } else {
        // anonymize | warn | mask: tokeniza (reversível) as mensagens do usuário e system
        const perMessageMatches = new Map<number, DLPMatch[]>();
        request.messages.forEach((m, i) => {
          if (m.role !== "user" && m.role !== "system") return;
          const found = scanForPII(m.content, patterns);
          if (found.length > 0) perMessageMatches.set(i, found);
        });

        const perMessageMasked = new Map<number, string>();
        const allEntities: EntityMapping[] = [];
        let regexCount = 0;
        let nerCount = 0;
        const byType: Record<string, number> = {};

        for (let i = 0; i < request.messages.length; i++) {
          const msg = request.messages[i];
          if (msg.role !== "user" && msg.role !== "system") continue;

          const regexMatches = perMessageMatches.get(i) ?? [];
          regexCount += regexMatches.length;
          for (const m of regexMatches) {
            byType[m.type] = (byType[m.type] ?? 0) + 1;
          }

          // 1º: aplica regex → texto parcialmente tokenizado
          const regexPass = tokenizePII(msg.content, regexMatches);
          let messageMasked = regexPass.maskedText;
          const messageEntities: EntityMapping[] = [...regexPass.entityMap];

          // 2º: NER opcional apenas para anonymize, rodando sobre o texto já tokenizado
          // (evita o LLM re-detectar o que a regex pegou).
          if (action === "anonymize") {
            const nerTypes = rules.nerTypes ?? ["PESSOA", "EMPRESA", "ENDERECO", "VALOR"];
            if (nerTypes.length > 0) {
              const ner = await detectNamedEntities(messageMasked, { types: nerTypes });

              // status agregado: qualquer failed sobrescreve; senão pega o primeiro observado
              if (nerStatus === "not_run") nerStatus = ner.status;
              else if (ner.status === "failed") nerStatus = "failed";

              if (ner.matches.length > 0) {
                const nerPass = tokenizePII(messageMasked, ner.matches);
                messageMasked = nerPass.maskedText;
                messageEntities.push(...nerPass.entityMap);
                nerCount += ner.matches.length;
                for (const m of ner.matches) {
                  byType[m.type] = (byType[m.type] ?? 0) + 1;
                }
              }
            }
          }

          perMessageMasked.set(i, messageMasked);
          allEntities.push(...messageEntities);
        }

        if (perMessageMasked.size > 0) {
          request = {
            ...request,
            messages: applyTokenization(request.messages, perMessageMasked),
          };
        }

        // Deduplica entityMap por token (mesmo token pode ter sido gerado
        // em mensagens diferentes com valores idênticos).
        const dedup = new Map<string, EntityMapping>();
        for (const e of allEntities) if (!dedup.has(e.token)) dedup.set(e.token, e);
        entityMap = [...dedup.values()];
        anonymizedCount = entityMap.length;

        const total = regexCount + nerCount;
        const hasCritical = Object.keys(byType).some(
          (k) => k === "credit_card" || k === "api_key"
        );
        const hasHigh = total > 0 && !hasCritical;
        dlpFlags = {
          action,
          nerStatus: action === "anonymize" ? nerStatus : ("not_run" as const),
          totalCount: total,
          bySource: { regex: regexCount, ner: nerCount },
          byType,
          severity: hasCritical ? "critical" : hasHigh ? "high" : "medium",
        };
      }
    }

    // Step 3: Route resolution — avalia conditions de verdade
    const routingRules = await db.query.routingRules.findMany({
      where: (r, { eq, and }) =>
        and(eq(r.orgId, ctx.orgId), eq(r.isActive, true)),
      orderBy: (r, { asc }) => [asc(r.priority)],
    });

    const inputTokensEstimate = estimateMessagesTokens(request.messages);
    const complexity = classifyComplexity(request.messages);

    let targetProviderId = ctx.resolvedProviderId;
    let targetModelId = ctx.resolvedModelId ?? request.model;
    let fallbackProviderId: string | null = null;
    let fallbackModelId: string | null = null;

    if (!targetProviderId && routingRules.length > 0) {
      const matched = routingRules.find((r) =>
        matchesRoutingConditions(r.conditions, {
          departmentId: ctx.departmentId,
          complexity,
          inputTokens: inputTokensEstimate,
        })
      );
      if (matched) {
        targetProviderId = matched.targetProviderId;
        targetModelId = matched.targetModelId;
        fallbackProviderId = matched.fallbackProviderId ?? null;
        fallbackModelId = matched.fallbackModelId ?? null;
      }
    }

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
    const estimatedCost = estimateCost(targetModelId, inputTokensEstimate);

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

    // Step 5: Forward — com fallback do schema (target → fallback)
    // targetProviderId está garantidamente atribuído (branch acima
    // teria lançado NO_PROVIDER caso contrário), mas o TS não infere.
    const resolvedTargetProviderId = targetProviderId!;
    const targets: Array<{ providerId: string; modelId: string }> = [
      { providerId: resolvedTargetProviderId, modelId: targetModelId },
    ];
    if (fallbackProviderId && fallbackModelId) {
      targets.push({ providerId: fallbackProviderId, modelId: fallbackModelId });
    }

    let lastError: unknown = null;
    let forwardResult: {
      response: unknown;
      inputTokens: number;
      outputTokens: number;
      usedProviderType: string;
      usedModelId: string;
    } | null = null;

    for (const tgt of targets) {
      try {
        const providerInfo = await config.getProviderKey(tgt.providerId);
        const { response, inputTokens, outputTokens } = await config.forwardRequest(
          providerInfo.providerType,
          tgt.modelId,
          providerInfo.apiKey,
          providerInfo.baseUrl,
          { ...request, model: tgt.modelId }
        );
        forwardResult = {
          response,
          inputTokens,
          outputTokens,
          usedProviderType: providerInfo.providerType,
          usedModelId: tgt.modelId,
        };
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!forwardResult) {
      throw lastError instanceof Error
        ? lastError
        : new AppError("FORWARD_FAILED", "Provider request failed", 502);
    }

    ctx.resolvedProviderType = forwardResult.usedProviderType;
    ctx.resolvedModelId = forwardResult.usedModelId;

    const latencyMs = Date.now() - ctx.startTime;
    const costUsd = calculateCost(
      forwardResult.usedModelId,
      forwardResult.inputTokens,
      forwardResult.outputTokens
    );

    // Cifra o entityMap (nunca vai em claro para o cliente)
    let entityMapEncrypted: string | undefined;
    if (entityMap.length > 0 && config.encryptEntityMap) {
      try {
        entityMapEncrypted = config.encryptEntityMap(JSON.stringify(entityMap));
      } catch {
        // Falha ao cifrar: descarta em vez de vazar em claro
        entityMapEncrypted = undefined;
      }
    }

    return {
      success: true,
      response: forwardResult.response as import("./types").ChatCompletionResponse,
      inputTokens: forwardResult.inputTokens,
      outputTokens: forwardResult.outputTokens,
      costUsd,
      latencyMs,
      status: "success",
      dlpFlags: dlpFlags ?? undefined,
      entityMapEncrypted,
      anonymizedCount: anonymizedCount || undefined,
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
