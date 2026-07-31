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
  TokenAllocator,
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

/**
 * Payload cifrado com AES-256-GCM e entregue ao cliente como `tutela.entity_map`.
 * Endpoints de reveal precisam checar `orgId` (e opcionalmente `userId`) contra
 * a sessão antes de devolver os valores originais. `v` reserva espaço para
 * evoluir o formato sem quebrar clientes antigos.
 */
export interface EntityMapEnvelope {
  v: 1;
  orgId: string;
  userId?: string;
  entities: EntityMapping[];
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
        // anonymize | warn | mask: tokeniza (reversível) as mensagens do
        // usuário e system usando UM ÚNICO alocador para toda a request.
        // Isso impede colisões entre mensagens (⟨PESSOA_1⟩ significar João
        // numa mensagem e Maria em outra) e corrompimento na restauração.
        const allocator = new TokenAllocator();

        const perMessageMatches = new Map<number, DLPMatch[]>();
        request.messages.forEach((m, i) => {
          if (m.role !== "user" && m.role !== "system") return;
          const found = scanForPII(m.content, patterns);
          if (found.length > 0) perMessageMatches.set(i, found);
        });

        const perMessageMasked = new Map<number, string>();
        let regexCount = 0;
        let nerCount = 0;
        let nerSkippedAsAlreadyProcessed = 0;
        const byType: Record<string, number> = {};

        // Padrão de token pré-existente — indica mensagem que já passou pelo
        // pipeline em um turno anterior. NER re-analisá-la é puro desperdício
        // (o histórico é reenviado a cada turno do chat).
        const TOKEN_RE = /⟨[A-Z_]+_\d+⟩/;

        for (let i = 0; i < request.messages.length; i++) {
          const msg = request.messages[i];
          if (msg.role !== "user" && msg.role !== "system") continue;

          const regexMatches = perMessageMatches.get(i) ?? [];
          regexCount += regexMatches.length;
          for (const m of regexMatches) {
            byType[m.type] = (byType[m.type] ?? 0) + 1;
          }

          const wasAlreadyProcessed = TOKEN_RE.test(msg.content);

          // 1º: regex sobre o texto original → texto parcialmente tokenizado
          const regexPass = tokenizePII(msg.content, regexMatches, allocator);
          let messageMasked = regexPass.maskedText;

          // 2º: NER opcional. Pula em duas condições:
          //   a) action != anonymize (warn/mask não precisam de NER);
          //   b) a mensagem já vinha pré-tokenizada de turno anterior — nesse
          //      caso o NER foi rodado antes e a repetição só quema custo.
          if (action === "anonymize" && !wasAlreadyProcessed) {
            const nerTypes = rules.nerTypes ?? ["PESSOA", "EMPRESA", "ENDERECO", "VALOR"];
            if (nerTypes.length > 0) {
              const ner = await detectNamedEntities(messageMasked, { types: nerTypes });

              if (nerStatus === "not_run") nerStatus = ner.status;
              else if (ner.status === "failed") nerStatus = "failed";

              if (ner.matches.length > 0) {
                const nerPass = tokenizePII(messageMasked, ner.matches, allocator);
                messageMasked = nerPass.maskedText;
                nerCount += ner.matches.length;
                for (const m of ner.matches) {
                  byType[m.type] = (byType[m.type] ?? 0) + 1;
                }
              }
            }
          } else if (wasAlreadyProcessed) {
            nerSkippedAsAlreadyProcessed += 1;
          }

          perMessageMasked.set(i, messageMasked);
        }

        if (perMessageMasked.size > 0) {
          request = {
            ...request,
            messages: applyTokenization(request.messages, perMessageMasked),
          };
        }

        // O mapa completo vem do alocador — não precisa dedup manual porque
        // TokenAllocator.allocate já garante um token por (type, valor).
        entityMap = allocator.getEntityMap();
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
          nerSkippedAsAlreadyProcessed,
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

    // Cifra o entityMap (nunca vai em claro para o cliente). O envelope
    // carrega orgId (e userId, se conhecido) para amarrar o blob ao tenant
    // dono. Endpoints de reveal (/api/chat/reveal, /reveal-map) rejeitam
    // qualquer blob cuja sessão não bata com esses campos — sem isso, um
    // login válido de outra banca conseguiria decifrar um blob que vazasse.
    let entityMapEncrypted: string | undefined;
    if (entityMap.length > 0 && config.encryptEntityMap) {
      try {
        const envelope: EntityMapEnvelope = {
          v: 1,
          orgId: ctx.orgId,
          userId: ctx.userId,
          entities: entityMap,
        };
        entityMapEncrypted = config.encryptEntityMap(JSON.stringify(envelope));
      } catch {
        // Falha ao cifrar → descarta em vez de vazar em claro.
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
