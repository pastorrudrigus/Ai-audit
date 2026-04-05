import { createDb } from "../index";
import { AI_TOOLS_CATALOG } from "./ai-tools-catalog";
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

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Seed AI Tools catalog
  console.log("Seeding AI tools catalog...");
  const toolIds: Record<string, string> = {};
  for (const tool of AI_TOOLS_CATALOG) {
    const [inserted] = await db.insert(schema.aiTools).values({
      name: tool.name,
      vendor: tool.vendor,
      category: tool.category,
      pricingModel: tool.pricingModel,
      plans: tool.plans,
      hasApi: tool.hasApi,
      hasSso: tool.hasSso,
      hasDpa: tool.hasDpa,
      dataResidency: tool.dataResidency ?? null,
      trainsOnData: tool.trainsOnData,
      websiteUrl: tool.websiteUrl,
      isVerified: (tool as { isVerified?: boolean }).isVerified ?? false,
      complianceNotes: (tool as { complianceNotes?: string }).complianceNotes ?? null,
    }).returning();
    toolIds[tool.name] = inserted.id;
  }

  // 2. Seed Models
  console.log("Seeding models...");
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

  // 3. Create Org
  console.log("Creating demo organization...");
  const [org] = await db.insert(schema.organizations).values({
    name: "Acme Corp",
    slug: "acme-corp",
    settings: {},
  }).returning();

  // 4. Departments
  const [engDept] = await db.insert(schema.departments).values({
    orgId: org.id, name: "Engineering", monthlyBudget: "3000", budgetAlertThreshold: 80,
  }).returning();
  const [mktDept] = await db.insert(schema.departments).values({
    orgId: org.id, name: "Marketing", monthlyBudget: "2000", budgetAlertThreshold: 80,
  }).returning();
  const [desDept] = await db.insert(schema.departments).values({
    orgId: org.id, name: "Design", monthlyBudget: "1000", budgetAlertThreshold: 80,
  }).returning();

  // 5. Users
  const [ownerUser] = await db.insert(schema.users).values({
    orgId: org.id, email: "alice@acmecorp.com", name: "Alice Johnson",
    role: "owner", departmentId: engDept.id, clerkId: "demo_clerk_owner",
  }).returning();
  const [adminUser] = await db.insert(schema.users).values({
    orgId: org.id, email: "bob@acmecorp.com", name: "Bob Smith",
    role: "admin", departmentId: engDept.id,
  }).returning();
  const [mktUser] = await db.insert(schema.users).values({
    orgId: org.id, email: "carol@acmecorp.com", name: "Carol White",
    role: "manager", departmentId: mktDept.id,
  }).returning();
  const [desUser] = await db.insert(schema.users).values({
    orgId: org.id, email: "david@acmecorp.com", name: "David Brown",
    role: "member", departmentId: desDept.id,
  }).returning();
  const [viewUser] = await db.insert(schema.users).values({
    orgId: org.id, email: "eve@acmecorp.com", name: "Eve Martinez",
    role: "viewer", departmentId: mktDept.id,
  }).returning();

  // 6. Providers
  const [openaiProvider] = await db.insert(schema.providers).values({
    orgId: org.id, name: "OpenAI Main", providerType: "openai",
    apiKeyEncrypted: "enc:demo_openai_key_encrypted", isActive: true,
  }).returning();
  const [anthropicProvider] = await db.insert(schema.providers).values({
    orgId: org.id, name: "Anthropic Main", providerType: "anthropic",
    apiKeyEncrypted: "enc:demo_anthropic_key_encrypted", isActive: true,
  }).returning();

  // 7. API Keys
  const [apiKey1] = await db.insert(schema.apiKeys).values({
    orgId: org.id, departmentId: engDept.id, createdBy: ownerUser.id,
    keyHash: "a".repeat(64),
    keyPrefix: "aig_sk_eng_",
    name: "Engineering Key",
  }).returning();

  // 8. Routing Rules
  const routingRulesData = [
    {
      name: "Engineering — Flagship", priority: 1,
      conditions: { departmentId: engDept.id, tier: "flagship" },
      targetProviderId: anthropicProvider.id, targetModelId: "claude-sonnet-4-20250514",
    },
    {
      name: "Marketing — Cost Optimized", priority: 2,
      conditions: { departmentId: mktDept.id },
      targetProviderId: openaiProvider.id, targetModelId: "gpt-4o-mini",
    },
    {
      name: "Default — GPT-4o", priority: 10,
      conditions: {},
      targetProviderId: openaiProvider.id, targetModelId: "gpt-4o",
    },
    {
      name: "Embeddings", priority: 3,
      conditions: { type: "embedding" },
      targetProviderId: openaiProvider.id, targetModelId: "text-embedding-3-small",
    },
    {
      name: "Fast — Mini", priority: 5,
      conditions: { tier: "fast" },
      targetProviderId: openaiProvider.id, targetModelId: "gpt-4o-mini",
    },
  ];
  for (const rule of routingRulesData) {
    await db.insert(schema.routingRules).values({ orgId: org.id, ...rule, isActive: true });
  }

  // 9. Policies
  await db.insert(schema.policies).values({
    orgId: org.id, name: "DLP — Block CPF/CNPJ", type: "dlp",
    rules: { action: "block", patterns: ["cpf", "cnpj", "credit_card", "api_key"] },
    scope: { global: true },
    isActive: true,
  });
  await db.insert(schema.policies).values({
    orgId: org.id, name: "Marketing — Mini Only", type: "model_access",
    rules: { allowedModels: ["gpt-4o-mini", "claude-haiku-4-5-20251001"] },
    scope: { departmentIds: [mktDept.id] },
    isActive: true,
  });

  // 10. Request Logs (50 entries over last 30 days)
  const models = ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "gemini-2.0-flash"];
  const providers = ["openai", "openai", "anthropic", "anthropic", "google"];
  const depts = [engDept.id, mktDept.id, desDept.id];
  const users = [ownerUser.id, adminUser.id, mktUser.id, desUser.id];
  const statuses: (typeof schema.requestStatusEnum.enumValues)[number][] = ["success", "success", "success", "success", "error", "blocked_dlp"];

  for (let i = 0; i < 50; i++) {
    const modelIdx = Math.floor(Math.random() * models.length);
    const inputTokens = Math.floor(randomBetween(100, 2000));
    const outputTokens = Math.floor(randomBetween(50, 1000));
    const costUsd = (inputTokens * 0.0000025 + outputTokens * 0.00001).toFixed(6);
    const daysBack = Math.floor(randomBetween(0, 30));
    const createdAt = daysAgo(daysBack);

    await db.insert(schema.requestLogs).values({
      orgId: org.id,
      userId: users[Math.floor(Math.random() * users.length)],
      apiKeyId: apiKey1.id,
      departmentId: depts[Math.floor(Math.random() * depts.length)],
      source: Math.random() > 0.5 ? "gateway" : "web_interface",
      providerType: providers[modelIdx],
      modelId: models[modelIdx],
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      latencyMs: Math.floor(randomBetween(200, 3000)),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt,
    });
  }

  // 11. Subscriptions
  const [chatgptSub] = await db.insert(schema.subscriptions).values({
    orgId: org.id, aiToolId: toolIds["ChatGPT"], departmentId: engDept.id,
    planName: "Team", costMonthly: "500.00", billingCycle: "monthly",
    totalSeats: 20, status: "active", paymentMethod: "corporate_card", cardLastFour: "4242",
    renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
  }).returning();
  const [cursorSub] = await db.insert(schema.subscriptions).values({
    orgId: org.id, aiToolId: toolIds["Cursor"], departmentId: engDept.id,
    planName: "Business", costMonthly: "600.00", billingCycle: "monthly",
    totalSeats: 15, status: "active", paymentMethod: "corporate_card", cardLastFour: "4242",
  }).returning();
  const [claudeSub] = await db.insert(schema.subscriptions).values({
    orgId: org.id, aiToolId: toolIds["Claude Pro"], departmentId: mktDept.id,
    planName: "Team", costMonthly: "200.00", billingCycle: "monthly",
    totalSeats: 8, status: "active", paymentMethod: "invoice",
  }).returning();
  const [midjSub] = await db.insert(schema.subscriptions).values({
    orgId: org.id, aiToolId: toolIds["Midjourney"], departmentId: desDept.id,
    planName: "Pro", costMonthly: "240.00", billingCycle: "monthly",
    totalSeats: 4, status: "active", paymentMethod: "reimbursement",
  }).returning();
  const [lovableSub] = await db.insert(schema.subscriptions).values({
    orgId: org.id, aiToolId: toolIds["Lovable"], departmentId: engDept.id,
    planName: "Scale", costMonthly: "300.00", billingCycle: "monthly",
    totalSeats: 3, status: "active", paymentMethod: "corporate_card", cardLastFour: "4242",
  }).returning();

  // 12. Subscription Seats (30 seats)
  const seatEmails = [
    "alice@acmecorp.com", "bob@acmecorp.com", "carol@acmecorp.com",
    "david@acmecorp.com", "eve@acmecorp.com",
    "frank@acmecorp.com", "grace@acmecorp.com", "henry@acmecorp.com",
    "iris@acmecorp.com", "jack@acmecorp.com",
  ];
  // ChatGPT seats: 20 (some inactive)
  for (let i = 0; i < 10; i++) {
    const isInactive = i >= 6;
    await db.insert(schema.subscriptionSeats).values({
      subscriptionId: chatgptSub.id, orgId: org.id,
      userEmail: seatEmails[i % seatEmails.length],
      userName: `User ${i + 1}`,
      status: isInactive ? "inactive" : "active",
      lastActiveAt: isInactive ? daysAgo(40) : daysAgo(Math.floor(randomBetween(0, 5))),
      source: "manual",
    });
  }
  // Cursor seats: some inactive
  for (let i = 0; i < 8; i++) {
    await db.insert(schema.subscriptionSeats).values({
      subscriptionId: cursorSub.id, orgId: org.id,
      userEmail: seatEmails[i % seatEmails.length],
      userName: `Dev ${i + 1}`,
      status: i >= 5 ? "inactive" : "active",
      lastActiveAt: i >= 5 ? daysAgo(45) : daysAgo(1),
      source: "manual",
    });
  }
  // Claude seats
  for (let i = 0; i < 8; i++) {
    await db.insert(schema.subscriptionSeats).values({
      subscriptionId: claudeSub.id, orgId: org.id,
      userEmail: seatEmails[i % seatEmails.length],
      userName: `Marketer ${i + 1}`,
      status: "active",
      lastActiveAt: daysAgo(Math.floor(randomBetween(0, 10))),
      source: "manual",
    });
  }
  // Midjourney seats
  for (let i = 0; i < 4; i++) {
    await db.insert(schema.subscriptionSeats).values({
      subscriptionId: midjSub.id, orgId: org.id,
      userEmail: seatEmails[i],
      status: "active",
      source: "manual",
    });
  }

  // 13. Billing Transactions
  const transactions = [
    { merchant: "OPENAI *CHATGPT", amount: "500.00", tool: "ChatGPT", classified: "auto_matched" as const },
    { merchant: "CURSOR.COM", amount: "600.00", tool: "Cursor", classified: "auto_matched" as const },
    { merchant: "ANTHROPIC AI", amount: "200.00", tool: "Claude Pro", classified: "auto_matched" as const },
    { merchant: "MIDJOURNEY INC", amount: "240.00", tool: "Midjourney", classified: "auto_matched" as const },
    { merchant: "LOVABLE DEV", amount: "300.00", tool: "Lovable", classified: "auto_matched" as const },
    { merchant: "AWS BEDROCK", amount: "150.00", tool: null, classified: "unclassified" as const },
    { merchant: "GITHUB COPILOT", amount: "190.00", tool: "GitHub Copilot", classified: "auto_matched" as const },
    { merchant: "NOTION AI ADDON", amount: "30.00", tool: "Notion AI", classified: "manually_confirmed" as const },
    { merchant: "RUNWAY ML", amount: "28.00", tool: "Runway", classified: "auto_matched" as const },
    { merchant: "COFFEE SHOP", amount: "12.50", tool: null, classified: "not_ai" as const },
  ];
  for (const tx of transactions) {
    await db.insert(schema.billingTransactions).values({
      orgId: org.id,
      source: "csv_import",
      transactionDate: daysAgo(Math.floor(randomBetween(1, 30))).toISOString().split("T")[0],
      merchantName: tx.merchant,
      matchedToolId: tx.tool && toolIds[tx.tool] ? toolIds[tx.tool] : null,
      amount: tx.amount,
      currency: "USD",
      cardLastFour: "4242",
      isRecurring: tx.tool !== null,
      classificationStatus: tx.classified,
    });
  }

  // 14. Optimization Insights
  await db.insert(schema.optimizationInsights).values({
    orgId: org.id, type: "idle_seats", severity: "warning",
    title: "4 assentos inativos no ChatGPT Team",
    description: "4 usuários não usam o ChatGPT há mais de 30 dias. Potencial economia removendo esses assentos.",
    estimatedSavingsMonthly: "100.00",
    relatedSubscriptionIds: [chatgptSub.id],
    actionLabel: "Ver assentos inativos",
    status: "open",
  });
  await db.insert(schema.optimizationInsights).values({
    orgId: org.id, type: "idle_seats", severity: "warning",
    title: "3 assentos inativos no Cursor Business",
    description: "3 devs não abriram o Cursor há mais de 30 dias. Considere revogar licenças.",
    estimatedSavingsMonthly: "120.00",
    relatedSubscriptionIds: [cursorSub.id],
    actionLabel: "Gerenciar assentos",
    status: "open",
  });
  await db.insert(schema.optimizationInsights).values({
    orgId: org.id, type: "idle_seats", severity: "info",
    title: "Lovable — utilização abaixo de 50%",
    description: "Apenas 1 de 3 assentos do Lovable foi usado no último mês.",
    estimatedSavingsMonthly: "200.00",
    relatedSubscriptionIds: [lovableSub.id],
    actionLabel: "Revisar uso",
    status: "open",
  });
  await db.insert(schema.optimizationInsights).values({
    orgId: org.id, type: "tool_overlap", severity: "warning",
    title: "Sobreposição: ChatGPT + Claude Pro na área de chat",
    description: "Engineering e Marketing usam ferramentas de chat diferentes. Consolidar em um único fornecedor pode simplificar a gestão.",
    estimatedSavingsMonthly: "200.00",
    relatedSubscriptionIds: [chatgptSub.id, claudeSub.id],
    actionLabel: "Ver análise",
    status: "open",
  });
  await db.insert(schema.optimizationInsights).values({
    orgId: org.id, type: "compliance_risk", severity: "critical",
    title: "Midjourney: sem DPA e treina com dados",
    description: "Midjourney não possui Data Processing Agreement (DPA) e treina modelos com conteúdo enviado. Risco para dados sensíveis.",
    estimatedSavingsMonthly: null,
    relatedSubscriptionIds: [midjSub.id],
    relatedToolIds: [toolIds["Midjourney"]],
    actionLabel: "Revisar política de uso",
    status: "open",
  });

  // 15. Conversations & Messages
  const convTitles = ["Resumo de relatório Q1", "Estratégia de marketing", "Revisão de código"];
  for (const title of convTitles) {
    const [conv] = await db.insert(schema.conversations).values({
      orgId: org.id, userId: ownerUser.id, title,
    }).returning();
    const msgCount = Math.floor(randomBetween(4, 8));
    for (let i = 0; i < msgCount; i++) {
      await db.insert(schema.messages).values({
        conversationId: conv.id,
        role: i % 2 === 0 ? "user" : "assistant",
        content: i % 2 === 0
          ? `Pergunta ${i + 1}: Como posso melhorar ${title.toLowerCase()}?`
          : `Resposta ${i + 1}: Aqui está uma análise detalhada sobre ${title.toLowerCase()}...`,
      });
    }
  }

  // 16. Alerts
  const alertsData = [
    { type: "budget_warning" as const, severity: "warning" as const, title: "Engineering próximo do limite", description: "Gasto de IA do Engineering atingiu 80% do budget mensal ($2.400 de $3.000)" },
    { type: "dlp_violation" as const, severity: "critical" as const, title: "DLP: CPF detectado e bloqueado", description: "Tentativa de envio de CPF para a API foi bloqueada pela política DLP" },
    { type: "idle_seats" as const, severity: "warning" as const, title: "Assentos inativos detectados", description: "7 assentos em ChatGPT e Cursor sem uso há 30+ dias" },
    { type: "compliance_risk" as const, severity: "critical" as const, title: "Ferramenta sem DPA em uso", description: "Midjourney usado pelo time de Design não possui DPA assinado" },
    { type: "tool_overlap" as const, severity: "info" as const, title: "Sobreposição de ferramentas de chat", description: "2 ferramentas de chat ativas (ChatGPT + Claude Pro) para equipes diferentes" },
  ];
  for (const alert of alertsData) {
    await db.insert(schema.alerts).values({
      orgId: org.id, ...alert,
      metadata: { source: "system" },
    });
  }

  // 17. Budgets
  const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  await db.insert(schema.budgets).values({
    orgId: org.id, departmentId: engDept.id,
    period, limitAmount: "3000.00",
    spentGateway: "1850.00", spentPlatforms: "1100.00",
  });
  await db.insert(schema.budgets).values({
    orgId: org.id, departmentId: mktDept.id,
    period, limitAmount: "2000.00",
    spentGateway: "320.00", spentPlatforms: "400.00",
  });
  await db.insert(schema.budgets).values({
    orgId: org.id, departmentId: desDept.id,
    period, limitAmount: "1000.00",
    spentGateway: "80.00", spentPlatforms: "240.00",
  });

  console.log("✅ Seed complete!");
  console.log(`Org ID: ${org.id}`);
  console.log(`Owner user: alice@acmecorp.com`);
}

seed().catch(console.error);
