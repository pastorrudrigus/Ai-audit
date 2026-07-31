/**
 * Seed do Tutela — banca fictícia para demos.
 *
 * Cria: 1 banca (org), 4 áreas jurídicas (departments), 6 advogados (users),
 * 2 providers (OpenAI + Anthropic), policies de DLP anonymize e citation_check,
 * as duas routing_rules default do Epic 3 (simple → econômico, complex → avançado),
 * ~40 request_logs plausíveis distribuídos por área, e 1 orçamento mensal.
 *
 * Uso: `TUTELA_SEED=1 npm run seed --workspace @aigate/db`
 * (o dispatcher em index.ts escolhe qual seed rodar).
 */

import { createDb } from "../index";
import { MODELS_PRICING } from "./models-pricing";
import * as schema from "../schema";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../../.env" });

const db = createDb(process.env.DATABASE_URL!);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log("🌱 Seeding Tutela demo (banca fictícia)...");

  // Modelos são globais — só popula se estiver vazio (mesma tabela do seed genérico)
  const existingModels = await db.query.models.findMany({ limit: 1 });
  if (existingModels.length === 0) {
    console.log("→ populando catálogo de modelos");
    for (const model of MODELS_PRICING) {
      await db.insert(schema.models).values({
        providerType: model.providerType,
        modelId: model.modelId,
        displayName: model.displayName,
        inputCostPer1mTokens: model.inputCostPer1mTokens,
        outputCostPer1mTokens: model.outputCostPer1mTokens,
        maxContextWindow: model.maxContextWindow,
        supportsVision: model.supportsVision,
        supportsTools: model.supportsTools,
        category: model.category,
      });
    }
  }

  // 1. Banca (organization)
  const [banca] = await db.insert(schema.organizations).values({
    name: "Almeida & Sócios Advocacia",
    slug: "almeida-socios",
    settings: { vertical: "juridico" },
  }).returning();
  console.log(`→ banca criada: ${banca.name}`);

  // 2. Áreas (departments) — cada uma com seu orçamento mensal
  const [trabalhista] = await db.insert(schema.departments).values({
    orgId: banca.id, name: "Trabalhista", monthlyBudget: "800.00", budgetAlertThreshold: 80,
  }).returning();
  const [civel] = await db.insert(schema.departments).values({
    orgId: banca.id, name: "Cível", monthlyBudget: "1200.00", budgetAlertThreshold: 80,
  }).returning();
  const [tributario] = await db.insert(schema.departments).values({
    orgId: banca.id, name: "Tributário", monthlyBudget: "1500.00", budgetAlertThreshold: 75,
  }).returning();
  const [contencioso] = await db.insert(schema.departments).values({
    orgId: banca.id, name: "Contencioso Estratégico", monthlyBudget: "2000.00", budgetAlertThreshold: 70,
  }).returning();

  // 3. Sócio-administrador + demais advogados (users)
  const [socio] = await db.insert(schema.users).values({
    orgId: banca.id,
    email: "renata.almeida@almeidasocios.adv.br",
    name: "Dra. Renata Almeida",
    role: "owner",
    departmentId: contencioso.id,
    isActive: true,
  }).returning();

  const advogados = await Promise.all([
    db.insert(schema.users).values({
      orgId: banca.id, email: "bruno.tavares@almeidasocios.adv.br",
      name: "Dr. Bruno Tavares", role: "manager", departmentId: trabalhista.id, isActive: true,
    }).returning(),
    db.insert(schema.users).values({
      orgId: banca.id, email: "clara.mendes@almeidasocios.adv.br",
      name: "Dra. Clara Mendes", role: "member", departmentId: trabalhista.id, isActive: true,
    }).returning(),
    db.insert(schema.users).values({
      orgId: banca.id, email: "diogo.rocha@almeidasocios.adv.br",
      name: "Dr. Diogo Rocha", role: "manager", departmentId: civel.id, isActive: true,
    }).returning(),
    db.insert(schema.users).values({
      orgId: banca.id, email: "elisa.figueiredo@almeidasocios.adv.br",
      name: "Dra. Elisa Figueiredo", role: "manager", departmentId: tributario.id, isActive: true,
    }).returning(),
    db.insert(schema.users).values({
      orgId: banca.id, email: "fabio.leal@almeidasocios.adv.br",
      name: "Dr. Fábio Leal", role: "member", departmentId: contencioso.id, isActive: true,
    }).returning(),
  ]);
  const advogadoIds = [socio.id, ...advogados.flat().map((u) => u.id)];

  // 4. Providers (OpenAI + Anthropic) — chave é placeholder cifrada no formato do encrypt()
  // No modo DEMO_MODE o gateway não chama o provider real; a chave só precisa existir.
  const placeholder = "0".repeat(24) + ":" + "0".repeat(32) + ":" + "0".repeat(32);
  const [openai] = await db.insert(schema.providers).values({
    orgId: banca.id, name: "OpenAI (demo)", providerType: "openai",
    apiKeyEncrypted: placeholder, isActive: true,
  }).returning();
  const [anthropic] = await db.insert(schema.providers).values({
    orgId: banca.id, name: "Anthropic (demo)", providerType: "anthropic",
    apiKeyEncrypted: placeholder, isActive: true,
  }).returning();

  // 5. Routing rules — as DUAS regras default do Epic 3
  //    A regra "simple" tem prioridade menor (avaliada antes); a regra curinga
  //    "complex" pega tudo que sobra.
  await db.insert(schema.routingRules).values([
    {
      orgId: banca.id, name: "Consultas curtas → modelo econômico",
      priority: 1,
      conditions: { taskComplexity: "simple", maxInputTokens: 3000 },
      targetProviderId: openai.id, targetModelId: "gpt-4o-mini",
      fallbackProviderId: anthropic.id, fallbackModelId: "claude-haiku-4-5-20251001",
      isActive: true,
    },
    {
      orgId: banca.id, name: "Redações e recursos → modelo avançado",
      priority: 10,
      conditions: { taskComplexity: "complex" },
      targetProviderId: anthropic.id, targetModelId: "claude-sonnet-4-20250514",
      fallbackProviderId: openai.id, fallbackModelId: "gpt-4o",
      isActive: true,
    },
    {
      orgId: banca.id, name: "Fallback global",
      priority: 100,
      conditions: {},
      targetProviderId: openai.id, targetModelId: "gpt-4o-mini",
      isActive: true,
    },
  ]);

  // 6. Policies — DLP anonymize (default do Tutela) + citation_check on_demand
  await db.insert(schema.policies).values({
    orgId: banca.id,
    name: "Anonimização reversível (Tutela)",
    type: "dlp",
    rules: {
      action: "anonymize",
      // undefined em `patterns` = todos os padrões, inclusive processo_cnj e oab
      nerTypes: ["PESSOA", "EMPRESA", "ENDERECO", "VALOR"],
    },
    scope: { global: true },
    isActive: true,
  });
  await db.insert(schema.policies).values({
    orgId: banca.id,
    name: "Verificação de citações — sob demanda",
    type: "citation_check",
    rules: { mode: "on_demand" },
    scope: { global: true },
    isActive: true,
  });

  // 7. Orçamento consolidado da banca no mês corrente
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await db.insert(schema.budgets).values({
    orgId: banca.id,
    period,
    limitAmount: "5500.00",
    spentGateway: "0",
    spentPlatforms: "0",
    isHardLimit: false,
  });

  // 8. Request logs (~40) distribuídos pelas áreas nos últimos 30 dias
  const departmentIds = [trabalhista.id, civel.id, tributario.id, contencioso.id];
  const modelPool = [
    { modelId: "gpt-4o-mini", providerType: "openai", ic: 0.15, oc: 0.60 },
    { modelId: "claude-haiku-4-5-20251001", providerType: "anthropic", ic: 0.80, oc: 4.00 },
    { modelId: "claude-sonnet-4-20250514", providerType: "anthropic", ic: 3.00, oc: 15.00 },
    { modelId: "gpt-4o", providerType: "openai", ic: 2.50, oc: 10.00 },
  ];

  for (let i = 0; i < 40; i++) {
    const model = pick(modelPool);
    const inputTokens = Math.floor(rand(200, 4000));
    const outputTokens = Math.floor(rand(80, 1500));
    const costUsd = (
      (inputTokens / 1_000_000) * model.ic + (outputTokens / 1_000_000) * model.oc
    ).toFixed(6);
    const status = Math.random() < 0.05 ? "blocked_dlp" : "success";
    const anonymizedTypes: Record<string, number> = {};
    if (status === "success") {
      const types = ["cpf", "PESSOA", "processo_cnj", "cnpj", "EMPRESA", "oab"];
      const nTypes = Math.floor(rand(1, 4));
      for (let t = 0; t < nTypes; t++) {
        const key = pick(types);
        anonymizedTypes[key] = (anonymizedTypes[key] ?? 0) + Math.floor(rand(1, 3));
      }
    }
    const totalAnonymized = Object.values(anonymizedTypes).reduce((s, n) => s + n, 0);

    await db.insert(schema.requestLogs).values({
      orgId: banca.id,
      userId: pick(advogadoIds),
      departmentId: pick(departmentIds),
      source: Math.random() > 0.3 ? "web_interface" : "gateway",
      providerType: model.providerType,
      modelId: model.modelId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      latencyMs: Math.floor(rand(400, 4500)),
      status,
      blockedReason: status === "blocked_dlp" ? "DLP violation: cartão_de_crédito detected" : null,
      dlpFlags: status === "success" && totalAnonymized > 0
        ? {
            action: "anonymize",
            nerStatus: "ok",
            totalCount: totalAnonymized,
            byType: anonymizedTypes,
            severity: "high",
          }
        : null,
      createdAt: daysAgo(Math.floor(rand(0, 30))),
    });
  }

  // 9. Alguns logs de citation_check (para o painel do sócio já mostrar métrica)
  for (let i = 0; i < 8; i++) {
    const total = Math.floor(rand(2, 8));
    const nao_encontrada = Math.floor(rand(0, Math.min(total, 3)));
    const confirmada = total - nao_encontrada;
    await db.insert(schema.requestLogs).values({
      orgId: banca.id,
      userId: pick(advogadoIds),
      departmentId: pick(departmentIds),
      source: "gateway",
      providerType: "internal",
      modelId: "citation_check",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: "0",
      latencyMs: Math.floor(rand(800, 3500)),
      status: "success",
      metadata: {
        kind: "citation_check",
        total,
        confirmada,
        divergente: 0,
        nao_encontrada,
        erro: 0,
      },
      createdAt: daysAgo(Math.floor(rand(0, 20))),
    });
  }

  console.log("✅ Seed do Tutela concluído.");
  console.log(`   Banca: ${banca.name}  (slug: ${banca.slug})`);
  console.log(`   Áreas: Trabalhista, Cível, Tributário, Contencioso Estratégico`);
  console.log(`   Sócio: ${socio.email}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
