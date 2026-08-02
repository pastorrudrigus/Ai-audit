/**
 * Provisiona uma banca de advocacia em produção — org, áreas, advogados,
 * providers, routing rules, políticas e orçamento em uma passada só.
 *
 * Uso:
 *   pnpm tsx scripts/provision-banca.ts scripts/exemplo-banca.json
 *
 * Env obrigatório:
 *   DATABASE_URL         — Neon (prod)
 *   ENCRYPTION_KEY       — 32 bytes hex (mesma do Vercel)
 *   OPENAI_API_KEY       — chave OpenAI que a banca vai usar (via Tutela)
 *   ANTHROPIC_API_KEY    — (opcional) chave Anthropic para fallback
 *
 * Após rodar:
 *   1. Copia o `DEMO_ORG_ID=<uuid>` que o script imprime → cole no Vercel env prod
 *   2. Convida os advogados pelo Clerk (email) — o middleware associa por email
 *      no primeiro login
 *   3. Redeploy do Vercel para pegar o novo DEMO_ORG_ID
 *
 * Idempotência: se já existir organization com o mesmo `slug`, o script para
 * e imprime o orgId existente sem sobrescrever nada.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createCipheriv, randomBytes } from "crypto";
import { createDb } from "../packages/db/index";
import * as schema from "../packages/db/schema";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// -------------------- Tipos --------------------

interface Config {
  banca: {
    name: string;
    slug: string;
  };
  areas: Array<{
    name: string;
    monthlyBudgetUsd: number;
    alertThresholdPct?: number;
  }>;
  advogados: Array<{
    email: string;
    name: string;
    role: "owner" | "manager" | "member";
    area: string; // deve casar com areas[].name
  }>;
  budget: {
    monthlyLimitUsd: number;
    isHardLimit: boolean;
  };
  policies?: {
    blockInjection?: boolean; // default false
    citationCheck?: "on_demand" | "always"; // default on_demand
  };
}

// -------------------- Helpers --------------------

const ALGORITHM = "aes-256-gcm";

function encrypt(plaintext: string): string {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) throw new Error("ENCRYPTION_KEY not set");
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// -------------------- Main --------------------

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Uso: pnpm tsx scripts/provision-banca.ts <config.json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const cfg: Config = JSON.parse(raw);

  console.log(`\n🏛  Provisionando: ${cfg.banca.name} (${cfg.banca.slug})\n`);

  assertEnv("DATABASE_URL");
  assertEnv("ENCRYPTION_KEY");
  const openaiKey = assertEnv("OPENAI_API_KEY");
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? null;

  const db = createDb(process.env.DATABASE_URL!);

  // 1. Idempotência
  const existing = await db.query.organizations.findFirst({
    where: (o, { eq }) => eq(o.slug, cfg.banca.slug),
  });
  if (existing) {
    console.log(`⚠️  Banca já existe: ${existing.id}`);
    console.log(`   Para re-provisionar, delete a organization primeiro (cuidado: cascade).\n`);
    console.log(`DEMO_ORG_ID=${existing.id}\n`);
    process.exit(0);
  }

  // 2. Organization
  const [org] = await db.insert(schema.organizations).values({
    name: cfg.banca.name,
    slug: cfg.banca.slug,
    settings: { vertical: "juridico" },
  }).returning();
  console.log(`✓ Banca: ${org.name} (${org.id})`);

  // 3. Departments
  const areaByName: Record<string, string> = {};
  for (const a of cfg.areas) {
    const [dep] = await db.insert(schema.departments).values({
      orgId: org.id,
      name: a.name,
      monthlyBudget: a.monthlyBudgetUsd.toFixed(2),
      budgetAlertThreshold: a.alertThresholdPct ?? 80,
    }).returning();
    areaByName[a.name] = dep.id;
    console.log(`  ✓ Área: ${dep.name} ($${a.monthlyBudgetUsd}/mês)`);
  }

  // 4. Advogados (users placeholder — Clerk associa no primeiro login por email)
  for (const adv of cfg.advogados) {
    const departmentId = areaByName[adv.area];
    if (!departmentId) {
      throw new Error(`Advogado ${adv.email} referencia área desconhecida: ${adv.area}`);
    }
    const [user] = await db.insert(schema.users).values({
      orgId: org.id,
      email: adv.email,
      name: adv.name,
      role: adv.role,
      departmentId,
      isActive: true,
    }).returning();
    console.log(`  ✓ Advogado: ${user.name} <${user.email}> (${adv.role} / ${adv.area})`);
  }

  // 5. Providers com keys REAIS cifradas
  const [openai] = await db.insert(schema.providers).values({
    orgId: org.id,
    name: "OpenAI",
    providerType: "openai",
    apiKeyEncrypted: encrypt(openaiKey),
    isActive: true,
  }).returning();
  console.log(`  ✓ Provider: OpenAI (chave cifrada)`);

  let anthropic: { id: string } | null = null;
  if (anthropicKey) {
    const [a] = await db.insert(schema.providers).values({
      orgId: org.id,
      name: "Anthropic",
      providerType: "anthropic",
      apiKeyEncrypted: encrypt(anthropicKey),
      isActive: true,
    }).returning();
    anthropic = a;
    console.log(`  ✓ Provider: Anthropic (chave cifrada)`);
  }

  // 6. Routing rules — simple → econômico, complex → avançado, fallback global
  await db.insert(schema.routingRules).values([
    {
      orgId: org.id,
      name: "Consultas curtas → modelo econômico",
      priority: 1,
      conditions: { taskComplexity: "simple", maxInputTokens: 3000 },
      targetProviderId: openai.id,
      targetModelId: "gpt-4o-mini",
      fallbackProviderId: anthropic?.id ?? openai.id,
      fallbackModelId: anthropic ? "claude-haiku-4-5-20251001" : "gpt-4o-mini",
      isActive: true,
    },
    {
      orgId: org.id,
      name: "Redações e recursos → modelo avançado",
      priority: 10,
      conditions: { taskComplexity: "complex" },
      targetProviderId: anthropic?.id ?? openai.id,
      targetModelId: anthropic ? "claude-sonnet-4-20250514" : "gpt-4o",
      fallbackProviderId: openai.id,
      fallbackModelId: "gpt-4o",
      isActive: true,
    },
    {
      orgId: org.id,
      name: "Fallback global",
      priority: 100,
      conditions: {},
      targetProviderId: openai.id,
      targetModelId: "gpt-4o-mini",
      isActive: true,
    },
  ]);
  console.log(`  ✓ Routing rules (3): simple → econômico, complex → avançado, fallback`);

  // 7. Policies
  await db.insert(schema.policies).values({
    orgId: org.id,
    name: "Anonimização reversível (Tutela)",
    type: "dlp",
    rules: {
      action: "anonymize",
      nerTypes: ["PESSOA", "EMPRESA", "ENDERECO", "VALOR"],
      blockInjection: cfg.policies?.blockInjection ?? false,
    },
    scope: { global: true },
    isActive: true,
  });
  console.log(`  ✓ Policy: DLP anonymize (blockInjection=${cfg.policies?.blockInjection ?? false})`);

  await db.insert(schema.policies).values({
    orgId: org.id,
    name: "Verificação de citações — sob demanda",
    type: "citation_check",
    rules: { mode: cfg.policies?.citationCheck ?? "on_demand" },
    scope: { global: true },
    isActive: true,
  });
  console.log(`  ✓ Policy: citation_check (${cfg.policies?.citationCheck ?? "on_demand"})`);

  // 8. Budget mensal consolidado
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await db.insert(schema.budgets).values({
    orgId: org.id,
    period,
    limitAmount: cfg.budget.monthlyLimitUsd.toFixed(2),
    spentGateway: "0",
    spentPlatforms: "0",
    isHardLimit: cfg.budget.isHardLimit,
  });
  console.log(`  ✓ Budget: $${cfg.budget.monthlyLimitUsd}/mês (hardLimit=${cfg.budget.isHardLimit})`);

  console.log(`\n✅ Banca provisionada com sucesso!\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Copie esta linha para o Vercel Environment (Production):`);
  console.log(``);
  console.log(`      DEMO_ORG_ID=${org.id}`);
  console.log(``);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Próximos passos:`);
  console.log(`    1. Vercel → Settings → Environment Variables → Production`);
  console.log(`       adiciona DEMO_ORG_ID acima; salva; força redeploy`);
  console.log(`    2. Clerk Dashboard → convida ${cfg.advogados.length} advogado(s) por email:`);
  for (const adv of cfg.advogados) {
    console.log(`         - ${adv.email}`);
  }
  console.log(`    3. Cada advogado abre o link, cria senha, faz login em /chat`);
  console.log(``);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Falha no provisionamento:", err);
    process.exit(1);
  });
