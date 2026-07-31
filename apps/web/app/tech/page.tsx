import Link from "next/link";
import {
  Database,
  Layers,
  ShieldCheck,
  GitBranch,
  Workflow,
  Sparkles,
  KeyRound,
  Settings2,
  Table2,
  ListTree,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* STACK                                                               */
/* ------------------------------------------------------------------ */

const stack = [
  {
    layer: "Monorepo",
    items: [
      { name: "Turborepo", version: "2.x", why: "Build cache e orquestração das 4 workspaces (web, gateway, db, core)." },
      { name: "npm workspaces", version: "—", why: "Resolução de dependências entre pacotes internos (workspace:*)." },
      { name: "TypeScript", version: "5.4", why: "strict mode em todos os pacotes; tipos compartilhados via @aigate/core." },
    ],
  },
  {
    layer: "Frontend (apps/web)",
    items: [
      { name: "Next.js", version: "14.2.4", why: "App Router com route groups (auth), (app), (chat). output: standalone para Docker." },
      { name: "React", version: "18.3", why: "Server Components por padrão; Client Components apenas onde há estado." },
      { name: "Tailwind CSS", version: "3.4", why: "Sistema de design utilitário; tokens de cor via CSS variables." },
      { name: "shadcn/ui + Radix", version: "—", why: "Primitivos acessíveis (dialog, select, tabs, tooltip, dropdown)." },
      { name: "Recharts", version: "2.12", why: "AreaChart de spend trend (gateway vs plataformas, 30 dias)." },
      { name: "lucide-react", version: "0.390", why: "Ícones." },
      { name: "sonner", version: "1.5", why: "Toasts de feedback em ações de mutação." },
      { name: "papaparse", version: "5.4", why: "Parse do CSV de faturamento no browser antes do upload." },
    ],
  },
  {
    layer: "Gateway (apps/gateway)",
    items: [
      { name: "Fastify", version: "4.27", why: "HTTP server do proxy OpenAI-compatible. Baixo overhead por request." },
      { name: "@fastify/cors", version: "9.0", why: "CORS para clientes SDK externos." },
      { name: "@fastify/rate-limit", version: "9.1", why: "Rate limit por API key na borda." },
      { name: "Node.js", version: "22", why: "Runtime; crypto nativo para AES-256-GCM e SHA-256." },
      { name: "tsx", version: "4.11", why: "Dev server com watch sem etapa de build." },
    ],
  },
  {
    layer: "Dados",
    items: [
      { name: "PostgreSQL (Neon)", version: "16", why: "Banco serverless com branching. Conexão HTTP, sem pool persistente." },
      { name: "Drizzle ORM", version: "0.30", why: "Schema-as-code tipado, query builder relacional, migrations." },
      { name: "@neondatabase/serverless", version: "0.9", why: "Driver HTTP compatível com edge/serverless." },
      { name: "Upstash Redis", version: "1.31", why: "Contadores de rate limit e cache de budget do mês corrente." },
    ],
  },
  {
    layer: "Auth e segurança",
    items: [
      { name: "Clerk", version: "5.2", why: "Auth do dashboard (sessão, orgs, middleware). Não cobre o gateway." },
      { name: "SHA-256", version: "nativo", why: "Hash das API keys do gateway. A chave em claro nunca é persistida." },
      { name: "AES-256-GCM", version: "nativo", why: "Criptografia das API keys de provider em repouso." },
      { name: "DLP engine", version: "próprio", why: "6 padrões de regex para PII e segredos, aplicados antes do forward." },
    ],
  },
  {
    layer: "Lógica compartilhada (packages/core)",
    items: [
      { name: "zod", version: "3.23", why: "Validação de payload nas rotas do gateway e nas API routes." },
      { name: "fuse.js", version: "7.0", why: "Fuzzy match de merchant do extrato → ferramenta do catálogo." },
    ],
  },
  {
    layer: "Deploy",
    items: [
      { name: "Railway", version: "—", why: "2 serviços (web + gateway) a partir do mesmo repo, com healthchecks." },
      { name: "Docker", version: "multi-stage", why: "deps → builder → runner. Imagem final só com standalone/dist." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* BANCO DE DADOS                                                      */
/* ------------------------------------------------------------------ */

type Col = { n: string; t: string; note?: string };
type Tbl = { name: string; group: string; desc: string; cols: Col[]; extra?: string };

const tables: Tbl[] = [
  {
    name: "organizations",
    group: "Tenancy",
    desc: "Raiz do multi-tenant. Toda tabela de dados carrega org_id apontando para cá.",
    cols: [
      { n: "id", t: "uuid PK", note: "defaultRandom" },
      { n: "name", t: "varchar(255)" },
      { n: "slug", t: "varchar(100) UNIQUE" },
      { n: "settings", t: "jsonb", note: "default {}" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "users",
    group: "Tenancy",
    desc: "Usuário da organização. clerk_id liga à sessão do dashboard; pode ser nulo para usuários importados.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations", note: "on delete cascade" },
      { n: "clerk_id", t: "varchar(255) UNIQUE", note: "nullable" },
      { n: "email", t: "varchar(255)" },
      { n: "name", t: "varchar(255)" },
      { n: "role", t: "enum user_role", note: "default member" },
      { n: "department_id", t: "uuid FK → departments", note: "on delete set null" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "created_at / last_login_at", t: "timestamp" },
    ],
  },
  {
    name: "departments",
    group: "Tenancy",
    desc: "Unidade de rateio de custo. Orçamento mensal e limiar de alerta vivem aqui.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "name", t: "varchar(255)" },
      { n: "monthly_budget", t: "decimal(10,2)", note: "nullable = sem teto" },
      { n: "budget_alert_threshold", t: "integer", note: "default 80 (%)" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "projects",
    group: "Tenancy",
    desc: "Subdivisão opcional dentro de um departamento, para atribuir chaves e orçamento mais granulares.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "department_id", t: "uuid FK → departments", note: "nullable" },
      { n: "name", t: "varchar(255)" },
      { n: "monthly_budget", t: "decimal(10,2)", note: "nullable" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "api_keys",
    group: "Gateway",
    desc: "Credencial de acesso ao gateway. Só o hash é persistido — a chave em claro aparece uma única vez, na criação.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "project_id", t: "uuid FK → projects", note: "nullable" },
      { n: "department_id", t: "uuid FK → departments", note: "nullable, define o budget aplicável" },
      { n: "created_by", t: "uuid FK → users" },
      { n: "key_hash", t: "varchar(64) UNIQUE", note: "SHA-256 hex" },
      { n: "key_prefix", t: "varchar(20)", note: "ex: aig_sk_a1b2 — para exibir na UI" },
      { n: "name", t: "varchar(255)" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "last_used_at / expires_at", t: "timestamp", note: "nullable" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "providers",
    group: "Gateway",
    desc: "Conta do provedor de LLM da organização. A chave do provider é gravada criptografada.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "name", t: "varchar(255)" },
      { n: "provider_type", t: "enum provider_type" },
      { n: "api_key_encrypted", t: "varchar(2048)", note: "AES-256-GCM (iv:authTag:ciphertext)" },
      { n: "base_url", t: "varchar(512)", note: "nullable — para Azure/proxies" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "models",
    group: "Gateway",
    desc: "Catálogo global de modelos com preço por 1M tokens. Fonte de verdade do cálculo de custo. Não tem org_id.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "provider_type", t: "varchar(50)" },
      { n: "model_id", t: "varchar(255)", note: "ex: gpt-4o, claude-sonnet-4" },
      { n: "display_name", t: "varchar(255)" },
      { n: "input_cost_per_1m_tokens", t: "decimal(10,6)" },
      { n: "output_cost_per_1m_tokens", t: "decimal(10,6)" },
      { n: "max_context_window", t: "integer" },
      { n: "supports_vision / supports_tools", t: "boolean" },
      { n: "category", t: "enum model_category" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "updated_at", t: "timestamp" },
    ],
  },
  {
    name: "routing_rules",
    group: "Gateway",
    desc: "Define para qual provider/modelo uma requisição é encaminhada. Avaliadas por priority ascendente.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "name", t: "varchar(255)" },
      { n: "priority", t: "integer", note: "menor = avaliado antes" },
      { n: "conditions", t: "jsonb", note: "ex: { departmentId, requestedModel, maxTokens }" },
      { n: "target_provider_id", t: "uuid FK → providers" },
      { n: "target_model_id", t: "varchar(255)" },
      { n: "fallback_provider_id", t: "uuid FK → providers", note: "nullable" },
      { n: "fallback_model_id", t: "varchar(255)", note: "nullable" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "policies",
    group: "Governança",
    desc: "Regra de controle aplicada no pipeline. O comportamento vem do par (type, rules) e o alcance de scope.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "name", t: "varchar(255)" },
      { n: "type", t: "enum policy_type" },
      { n: "rules", t: "jsonb", note: "dlp: { action, patterns[] } · model_access: { allowedModels[] }" },
      { n: "scope", t: "jsonb", note: "ex: { departmentIds: [...] } — vazio = org inteira" },
      { n: "is_active", t: "boolean", note: "default true" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "request_logs",
    group: "Governança",
    desc: "Uma linha por requisição, do gateway ou do chat web. Base de todo o cálculo de gasto e latência.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "user_id / api_key_id / department_id / project_id", t: "uuid FK", note: "nullable, on delete set null" },
      { n: "source", t: "enum request_source", note: "gateway | web_interface" },
      { n: "provider_type", t: "varchar(50)" },
      { n: "model_id", t: "varchar(255)" },
      { n: "input_tokens / output_tokens / total_tokens", t: "integer" },
      { n: "cost_usd", t: "decimal(10,6)", note: "6 casas — requisições individuais custam frações de centavo" },
      { n: "latency_ms", t: "integer" },
      { n: "status", t: "enum request_status" },
      { n: "blocked_reason", t: "varchar(512)", note: "nullable" },
      { n: "dlp_flags", t: "jsonb", note: "nullable — matches do scan, sem o valor original" },
      { n: "metadata", t: "jsonb", note: "nullable" },
      { n: "created_at", t: "timestamp" },
    ],
    extra: "Índice composto (org_id, created_at) — toda consulta do dashboard filtra por org e janela de tempo.",
  },
  {
    name: "conversations",
    group: "Chat",
    desc: "Thread do chat web. Isolada por org e por usuário.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "user_id", t: "uuid FK → users", note: "on delete cascade" },
      { n: "title", t: "varchar(255)" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "messages",
    group: "Chat",
    desc: "Mensagem de uma conversa. request_log_id liga a mensagem do assistente ao custo que ela gerou.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "conversation_id", t: "uuid FK → conversations", note: "on delete cascade" },
      { n: "request_log_id", t: "uuid FK → request_logs", note: "nullable — dá rastreio de custo por mensagem" },
      { n: "role", t: "enum message_role" },
      { n: "content", t: "text" },
      { n: "attachments", t: "jsonb", note: "nullable" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "budgets",
    group: "Custo",
    desc: "Teto de gasto por período. Separa gasto de gateway (variável, 6 casas) de gasto de plataformas (fixo, 2 casas).",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "department_id / project_id", t: "uuid FK", note: "nullable — nulos nos dois = budget da org" },
      { n: "period", t: "varchar(7)", note: "formato YYYY-MM" },
      { n: "limit_amount", t: "decimal(10,2)" },
      { n: "spent_gateway", t: "decimal(10,6)", note: "default 0" },
      { n: "spent_platforms", t: "decimal(10,2)", note: "default 0" },
      { n: "alert_sent", t: "boolean", note: "evita alerta repetido no mesmo período" },
      { n: "is_hard_limit", t: "boolean", note: "true = bloqueia requisição; false = só alerta" },
      { n: "created_at", t: "timestamp" },
    ],
    extra: "UNIQUE (org_id, department_id, project_id, period) — um único budget por escopo por mês.",
  },
  {
    name: "alerts",
    group: "Custo",
    desc: "Notificação gerada pelo sistema (budget, anomalia, DLP, compliance).",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "type", t: "enum alert_type" },
      { n: "severity", t: "enum alert_severity" },
      { n: "title", t: "varchar(255)" },
      { n: "description", t: "text" },
      { n: "metadata", t: "jsonb", note: "default {}" },
      { n: "is_read", t: "boolean", note: "default false" },
      { n: "created_at", t: "timestamp" },
    ],
    extra: "Índice composto (org_id, created_at).",
  },
  {
    name: "ai_tools",
    group: "Plataformas",
    desc: "Catálogo global de ferramentas de IA (ChatGPT, Cursor, Midjourney...). Sem org_id: é compartilhado entre todos os tenants.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "name / vendor", t: "varchar(255)" },
      { n: "category", t: "enum tool_category" },
      { n: "pricing_model", t: "enum pricing_model" },
      { n: "plans", t: "jsonb", note: "default [] — [{ name, price, seats }]" },
      { n: "has_api / has_sso / has_dpa", t: "boolean", note: "insumos do detector de compliance" },
      { n: "data_residency", t: "jsonb", note: "nullable" },
      { n: "trains_on_data", t: "varchar(50)", note: "yes | no | unknown (default unknown)" },
      { n: "compliance_notes", t: "text", note: "nullable" },
      { n: "alternative_tool_ids", t: "jsonb", note: "nullable — sugestões de consolidação" },
      { n: "website_url / logo_url", t: "varchar(512)" },
      { n: "is_verified", t: "boolean", note: "default false" },
      { n: "updated_at", t: "timestamp" },
    ],
  },
  {
    name: "subscriptions",
    group: "Plataformas",
    desc: "Assinatura contratada pela organização de uma ferramenta do catálogo. É a ponte entre o catálogo global e o tenant.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "ai_tool_id", t: "uuid FK → ai_tools" },
      { n: "department_id", t: "uuid FK → departments", note: "nullable" },
      { n: "plan_name", t: "varchar(255)" },
      { n: "cost_monthly", t: "decimal(10,2)", note: "sempre normalizado para custo mensal" },
      { n: "billing_cycle", t: "enum billing_cycle", note: "default monthly" },
      { n: "annual_cost", t: "decimal(10,2)", note: "nullable" },
      { n: "total_seats", t: "integer", note: "nullable — base do cálculo de utilização" },
      { n: "currency", t: "varchar(3)", note: "default USD" },
      { n: "payment_method", t: "enum payment_method", note: "default unknown" },
      { n: "card_last_four", t: "varchar(4)", note: "nullable — usado para casar com o extrato" },
      { n: "status", t: "enum subscription_status", note: "default active" },
      { n: "renewal_date", t: "date", note: "nullable" },
      { n: "owner_user_id", t: "uuid FK → users", note: "nullable" },
      { n: "notes", t: "text", note: "nullable" },
      { n: "source", t: "enum subscription_source", note: "default manual" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "subscription_seats",
    group: "Plataformas",
    desc: "Assento individual de uma assinatura. user_id é opcional: assentos importados do faturamento só têm o email.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "subscription_id", t: "uuid FK → subscriptions", note: "on delete cascade" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "user_id", t: "uuid FK → users", note: "nullable — assento pode existir sem usuário interno" },
      { n: "user_email", t: "varchar(255)" },
      { n: "user_name", t: "varchar(255)", note: "nullable" },
      { n: "status", t: "enum seat_status", note: "default active" },
      { n: "last_active_at", t: "timestamp", note: "nullable — insumo do detector de assento ocioso" },
      { n: "source", t: "enum seat_source", note: "default manual" },
      { n: "created_at / updated_at", t: "timestamp" },
    ],
  },
  {
    name: "billing_transactions",
    group: "Plataformas",
    desc: "Linha do extrato do cartão corporativo. Alimenta a descoberta de shadow AI — ferramentas pagas sem cadastro.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "subscription_id", t: "uuid FK → subscriptions", note: "nullable — preenchido ao confirmar o match" },
      { n: "source", t: "enum transaction_source" },
      { n: "transaction_date", t: "date" },
      { n: "merchant_name", t: "varchar(512)", note: "string bruta do extrato" },
      { n: "matched_tool_id", t: "uuid FK → ai_tools", note: "nullable — resultado do fuzzy match" },
      { n: "amount", t: "decimal(10,2)" },
      { n: "currency", t: "varchar(3)", note: "default USD" },
      { n: "card_last_four", t: "varchar(4)", note: "nullable" },
      { n: "is_recurring", t: "boolean", note: "nullable" },
      { n: "classification_status", t: "enum classification_status", note: "default unclassified" },
      { n: "raw_data", t: "jsonb", note: "nullable — linha original do CSV" },
      { n: "created_at", t: "timestamp" },
    ],
  },
  {
    name: "optimization_insights",
    group: "Otimização",
    desc: "Recomendação gerada pelo motor de otimização, com economia estimada e ciclo de vida próprio.",
    cols: [
      { n: "id", t: "uuid PK" },
      { n: "org_id", t: "uuid FK → organizations" },
      { n: "type", t: "enum insight_type" },
      { n: "severity", t: "enum insight_severity" },
      { n: "title", t: "varchar(255)" },
      { n: "description", t: "text" },
      { n: "estimated_savings_monthly", t: "decimal(10,2)", note: "nullable — compliance_risk não tem economia direta" },
      { n: "related_subscription_ids", t: "jsonb", note: "default []" },
      { n: "related_tool_ids", t: "jsonb", note: "nullable" },
      { n: "action_label", t: "varchar(100)", note: "nullable — CTA exibido no card" },
      { n: "status", t: "enum insight_status", note: "default open" },
      { n: "resolved_at", t: "timestamp", note: "nullable" },
      { n: "created_at", t: "timestamp" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* ENUMS                                                               */
/* ------------------------------------------------------------------ */

const enums = [
  { name: "user_role", values: ["owner", "admin", "manager", "member", "viewer"] },
  { name: "provider_type", values: ["openai", "anthropic", "google", "bedrock", "azure_openai"] },
  { name: "model_category", values: ["flagship", "balanced", "fast", "embedding"] },
  { name: "policy_type", values: ["dlp", "model_access", "rate_limit", "budget", "content"] },
  { name: "request_source", values: ["gateway", "web_interface"] },
  { name: "request_status", values: ["success", "error", "blocked_policy", "blocked_budget", "blocked_dlp"] },
  { name: "message_role", values: ["user", "assistant", "system"] },
  { name: "alert_type", values: ["budget_warning", "budget_exceeded", "anomaly", "dlp_violation", "provider_error", "idle_seats", "compliance_risk", "tool_overlap"] },
  { name: "alert_severity", values: ["info", "warning", "critical"] },
  { name: "tool_category", values: ["ide", "code_gen", "app_builder", "chat", "image_gen", "agent", "writing", "data", "design", "video", "audio"] },
  { name: "pricing_model", values: ["per_seat", "per_credit", "per_usage", "flat", "freemium"] },
  { name: "billing_cycle", values: ["monthly", "annual", "quarterly"] },
  { name: "subscription_status", values: ["active", "paused", "cancelled", "trial", "pending_review"] },
  { name: "payment_method", values: ["corporate_card", "invoice", "reimbursement", "unknown"] },
  { name: "subscription_source", values: ["manual", "billing_import", "api_sync"] },
  { name: "seat_status", values: ["active", "inactive", "invited", "unknown"] },
  { name: "seat_source", values: ["manual", "sso_detected", "billing_import"] },
  { name: "transaction_source", values: ["csv_import", "brex_api", "ramp_api", "stripe_api", "manual"] },
  { name: "classification_status", values: ["auto_matched", "manually_confirmed", "unclassified", "not_ai"] },
  { name: "insight_type", values: ["idle_seats", "plan_downgrade", "tool_overlap", "compliance_risk", "consolidation", "cost_anomaly"] },
  { name: "insight_severity", values: ["info", "warning", "critical"] },
  { name: "insight_status", values: ["open", "acknowledged", "resolved", "dismissed"] },
];

/* ------------------------------------------------------------------ */
/* PIPELINE                                                            */
/* ------------------------------------------------------------------ */

const pipeline = [
  {
    step: "1",
    name: "AUTH",
    where: "apps/gateway/routes/v1/chat-completions.ts",
    rules: [
      "Header Authorization: Bearer aig_sk_... é obrigatório.",
      "A chave recebida é passada por SHA-256 e comparada com api_keys.key_hash. Nenhuma comparação usa texto em claro.",
      "A chave precisa estar is_active = true e não expirada (expires_at nulo ou no futuro).",
      "org_id, department_id e project_id da requisição vêm da chave — o cliente não os informa.",
      "last_used_at é atualizado a cada uso.",
    ],
  },
  {
    step: "2",
    name: "POLICY",
    where: "packages/core/pipeline.ts",
    rules: [
      "Carrega todas as policies ativas da org.",
      "Para type = model_access: se o department_id da chave está em scope.departmentIds e o modelo pedido não está em rules.allowedModels, a requisição é barrada.",
      "Bloqueio retorna HTTP 403 com status blocked_policy e é gravado em request_logs.",
      "Policy sem departamento em scope não se aplica à requisição.",
    ],
  },
  {
    step: "3",
    name: "DLP",
    where: "packages/core/dlp.ts",
    rules: [
      "Apenas mensagens com role = user são escaneadas — output do modelo e system prompt ficam de fora.",
      "Os padrões testados vêm de rules.patterns da policy; se ausente, todos os 6 são aplicados.",
      "Severidade agregada: critical se houver qualquer match critical; senão high; senão medium.",
      "Se rules.action = block, a requisição é barrada com status blocked_dlp (HTTP 403).",
      "Se rules.action = mask, os trechos são substituídos por [LABEL REDACTED] e a requisição segue.",
      "dlp_flags grava tipo, label, severidade e posição — nunca o valor detectado.",
    ],
  },
  {
    step: "4",
    name: "ROUTE",
    where: "packages/core/pipeline.ts",
    rules: [
      "Regras de roteamento são ordenadas por priority ascendente; a primeira que casa define o destino.",
      "Sem regra aplicável, cai no primeiro provider ativo da org.",
      "Sem nenhum provider ativo: HTTP 503 NO_PROVIDER.",
      "O modelo pedido pelo cliente pode ser substituído pelo target_model_id da regra — é assim que se força downgrade de custo por departamento.",
    ],
  },
  {
    step: "5",
    name: "BUDGET",
    where: "packages/core/pipeline.ts",
    rules: [
      "Período corrente no formato YYYY-MM.",
      "Busca o budget do departamento da chave; se a chave não tem departamento, usa o budget da org (department_id IS NULL).",
      "Gasto total = spent_gateway + spent_platforms — assinaturas fixas consomem o mesmo teto que o consumo por token.",
      "O custo é estimado antes da chamada (≈4 caracteres por token) e somado ao gasto atual.",
      "Só bloqueia se is_hard_limit = true e a estimativa ultrapassar o limite. Retorna HTTP 402, status blocked_budget.",
      "Com is_hard_limit = false a requisição passa e o estouro vira alerta.",
    ],
  },
  {
    step: "6",
    name: "FORWARD",
    where: "apps/gateway/providers/",
    rules: [
      "A chave do provider é descriptografada em memória (AES-256-GCM) imediatamente antes da chamada.",
      "openai-adapter: repassa o payload direto, formato já compatível.",
      "anthropic-adapter: traduz OpenAI → Messages API (system extraído das mensagens) e a resposta de volta ao formato OpenAI.",
      "Com DEMO_MODE=true nenhum provider real é chamado — a resposta é sintética e o custo é calculado igual.",
    ],
  },
  {
    step: "7",
    name: "LOG",
    where: "apps/gateway/routes/v1/chat-completions.ts",
    rules: [
      "Toda requisição gera uma linha em request_logs — inclusive as bloqueadas, com tokens e custo zerados.",
      "Custo real = (input_tokens ÷ 1M × preço_entrada) + (output_tokens ÷ 1M × preço_saída), a partir da tabela models.",
      "latency_ms mede o pipeline inteiro, não só o tempo do provider.",
      "budgets.spent_gateway é incrementado com o custo real da requisição.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* REGRAS DE NEGÓCIO                                                   */
/* ------------------------------------------------------------------ */

const dlpPatterns = [
  { key: "cpf", label: "CPF", severity: "high", regex: "\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}", ex: "123.456.789-09" },
  { key: "cnpj", label: "CNPJ", severity: "high", regex: "\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}", ex: "12.345.678/0001-90" },
  { key: "credit_card", label: "Cartão de crédito", severity: "critical", regex: "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b", ex: "4111 1111 1111 1111" },
  { key: "api_key", label: "API Key/Secret", severity: "critical", regex: "\\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})\\b", ex: "sk-proj-abc123…" },
  { key: "email", label: "Email", severity: "medium", regex: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b", ex: "user@empresa.com" },
  { key: "phone_br", label: "Telefone BR", severity: "medium", regex: "\\(?\\d{2}\\)?\\s?\\d{4,5}-?\\d{4}", ex: "(11) 99999-9999" },
];

const detectors = [
  {
    type: "idle_seats",
    title: "Assentos ociosos",
    trigger: "Assento com status = inactive, ou com last_active_at anterior a 30 dias.",
    severity: "warning se ≥ 5 assentos ociosos; caso contrário info.",
    savings: "(cost_monthly ÷ total_seats) × nº de assentos ociosos",
    note: "Assento sem last_active_at não conta como ocioso — ausência de dado não é evidência de desuso.",
  },
  {
    type: "tool_overlap",
    title: "Sobreposição de ferramentas",
    trigger: "Duas ou mais assinaturas ativas cujas ferramentas compartilham a mesma tool_category.",
    severity: "sempre warning",
    savings: "30% da soma do custo mensal das assinaturas sobrepostas (estimativa de consolidação)",
    note: "Agrupa por categoria do catálogo, não por nome — Cursor e Copilot caem juntos em ide.",
  },
  {
    type: "compliance_risk",
    title: "Risco de compliance",
    trigger: "Ferramenta ativa sem DPA, ou que treina com dados do usuário, ou sem SSO.",
    severity: "critical se treina com dados ou não tem DPA; warning se apenas falta SSO.",
    savings: "não se aplica — é risco, não desperdício",
    note: "Falta de SSO sozinha nunca escala para critical.",
  },
  {
    type: "plan_downgrade",
    title: "Plano superdimensionado",
    trigger: "Utilização (assentos ativos ÷ total_seats) abaixo de 50%.",
    severity: "warning abaixo de 30%; info entre 30% e 50%.",
    savings: "(cost_monthly ÷ total_seats) × assentos não utilizados",
    note: "Assinatura sem total_seats definido é ignorada — não há como calcular utilização.",
  },
];

const billingRules = [
  "O CSV é parseado no browser (papaparse) e pré-visualizado antes de qualquer escrita no banco.",
  "O nome do merchant é normalizado antes do match: remove asteriscos, sufixos de domínio (.COM, .AI, .IO, .DEV, .NET, .ML) e espaços duplicados.",
  "O índice de busca (Fuse.js, threshold 0.4) é montado sobre três variantes de cada ferramenta: nome, vendor e nome+vendor.",
  "A confiança é 1 − score do Fuse. Abaixo de 0.5 o match é descartado e a transação fica unclassified.",
  "Match aceito grava matched_tool_id com classification_status = auto_matched — ainda pendente de confirmação humana.",
  "Confirmação do usuário move para manually_confirmed e vincula a transação a uma subscription.",
  "Transação que o usuário marca como não relacionada a IA vira not_ai e é excluída dos totais.",
];

const costRules = [
  "Preço vem sempre da tabela models, nunca de constante no código de aplicação.",
  "Custo real = (input_tokens ÷ 1.000.000 × input_cost_per_1m_tokens) + (output_tokens ÷ 1.000.000 × output_cost_per_1m_tokens).",
  "Estimativa pré-chamada usa ≈4 caracteres por token, e só considera tokens de entrada.",
  "cost_usd usa decimal(10,6): uma requisição pode custar frações de centavo e o arredondamento precoce distorceria o agregado mensal.",
  "Custo de assinatura usa decimal(10,2) e é sempre normalizado para valor mensal, mesmo em ciclo anual.",
  "O gasto total exibido no dashboard é a soma dos dois: consumo por token do gateway + assinaturas de plataformas.",
];

const securityRules = [
  {
    title: "API keys do gateway",
    body: "Geradas com prefixo aig_sk_ e persistidas apenas como SHA-256 hex (64 chars). A chave em claro é retornada uma única vez, na criação. Perdê-la exige revogar e emitir outra.",
  },
  {
    title: "Chaves de provider",
    body: "Criptografadas com AES-256-GCM antes de ir ao banco, no formato iv:authTag:ciphertext. A chave de criptografia vem de ENCRYPTION_KEY (32 bytes) e nunca é persistida. A descriptografia acontece em memória, só no momento do forward.",
  },
  {
    title: "Isolamento multi-tenant",
    body: "Toda tabela de dados carrega org_id com FK on delete cascade, e todas as queries filtram por ele. O org_id nunca vem do cliente: no dashboard é derivado da sessão Clerk, no gateway é derivado da API key.",
  },
  {
    title: "Catálogos globais",
    body: "ai_tools e models são intencionalmente compartilhados entre tenants e não têm org_id. São somente-leitura para as organizações.",
  },
  {
    title: "Dados sensíveis no log",
    body: "dlp_flags grava tipo, label, severidade e posição do match — nunca o conteúdo detectado. O log de uma requisição bloqueada por CPF não contém o CPF.",
  },
  {
    title: "Auth do dashboard",
    body: "Clerk via middleware. Toda rota fora das públicas (/sign-in, /sign-up, /demo, /tech, /api/health) exige sessão.",
  },
];

const envVars = [
  { key: "DATABASE_URL", scope: "web + gateway", desc: "Connection string do Postgres/Neon." },
  { key: "ENCRYPTION_KEY", scope: "web + gateway", desc: "32 bytes em hex. Criptografa as chaves de provider. Trocar invalida todas as chaves já gravadas." },
  { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", scope: "web", desc: "Chave pública do Clerk." },
  { key: "CLERK_SECRET_KEY", scope: "web", desc: "Chave secreta do Clerk." },
  { key: "UPSTASH_REDIS_REST_URL", scope: "gateway", desc: "Endpoint do Redis para rate limit e cache." },
  { key: "UPSTASH_REDIS_REST_TOKEN", scope: "gateway", desc: "Token do Upstash." },
  { key: "GATEWAY_URL", scope: "web", desc: "URL pública do gateway, usada pelo chat web." },
  { key: "DEMO_MODE", scope: "web + gateway", desc: "true = respostas sintéticas, sem chamar provider real. O custo continua sendo calculado e logado." },
  { key: "PORT", scope: "gateway", desc: "Porta HTTP do Fastify (padrão 3001)." },
];

const monorepo = `aigate/
├── apps/
│   ├── web/                 Next.js 14 — dashboard, chat, onboarding
│   │   ├── app/
│   │   │   ├── (app)/       rotas protegidas: dashboard, platforms, keys,
│   │   │   │                logs, policies, optimizations, alerts,
│   │   │   │                departments, models, gateway, settings
│   │   │   ├── (chat)/      interface de chat
│   │   │   ├── api/         route handlers (server-side, filtram por org_id)
│   │   │   ├── demo/        showcase de funcionalidades
│   │   │   └── tech/        esta página
│   │   ├── components/ui/   shadcn/ui
│   │   ├── lib/             db singleton, encryption, utils
│   │   └── Dockerfile       multi-stage → standalone
│   └── gateway/             Fastify — proxy OpenAI-compatible
│       ├── routes/v1/       POST /v1/chat/completions
│       ├── providers/       openai-adapter, anthropic-adapter
│       ├── utils/           encryption, hash, geração de chave
│       └── Dockerfile       multi-stage → dist
├── packages/
│   ├── db/                  Drizzle: schema (19 tabelas), relations, seed
│   └── core/                pipeline, dlp, cost, billing-matcher,
│                            optimization-engine, types
└── turbo.json`;

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const severityStyle: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  warning: "bg-amber-100 text-amber-700",
  medium: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
};

const groupStyle: Record<string, string> = {
  Tenancy: "bg-slate-100 text-slate-700",
  Gateway: "bg-blue-100 text-blue-700",
  "Governança": "bg-violet-100 text-violet-700",
  Chat: "bg-cyan-100 text-cyan-700",
  Custo: "bg-emerald-100 text-emerald-700",
  Plataformas: "bg-indigo-100 text-indigo-700",
  "Otimização": "bg-amber-100 text-amber-700",
};

const sections = [
  { id: "stack", label: "Stack" },
  { id: "monorepo", label: "Monorepo" },
  { id: "pipeline", label: "Pipeline" },
  { id: "banco", label: "Banco de dados" },
  { id: "enums", label: "Enums" },
  { id: "regras", label: "Regras de negócio" },
  { id: "seguranca", label: "Segurança" },
  { id: "env", label: "Variáveis" },
];

function SectionTitle({
  icon: Icon,
  id,
  title,
  subtitle,
}: {
  icon: typeof Database;
  id: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div id={id} className="scroll-mt-20 mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export const metadata = {
  title: "AIGate — Stack, banco e regras de negócio",
  description:
    "Documentação técnica: stack completa, schema do banco e regras de negócio da plataforma.",
};

export default function TechPage() {
  const totalCols = tables.reduce((n, t) => n + t.cols.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
            <Link href="/demo" className="hover:text-white transition-colors">
              Demo
            </Link>
            <span>/</span>
            <span className="text-white">Documentação técnica</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">Stack, banco e regras de negócio</h1>
          <p className="text-slate-300 max-w-2xl">
            Tudo que o AIGate usa e todas as regras que ele aplica: cada dependência com a razão de
            estar aqui, as {tables.length} tabelas do schema com seus {totalCols} campos, e as
            decisões de negócio codificadas no pipeline, no motor de otimização e na conciliação de
            faturamento.
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3 py-1.5"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        <section>
          <SectionTitle
            icon={Layers}
            id="stack"
            title="Stack técnica"
            subtitle="Cada dependência com a razão de estar no projeto — não só o nome."
          />
          <div className="space-y-4">
            {stack.map((group) => (
              <div key={group.layer} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="font-semibold text-sm text-slate-900">{group.layer}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <div
                      key={item.name}
                      className="px-5 py-3 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4"
                    >
                      <div className="md:w-56 shrink-0 flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-900">{item.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{item.version}</span>
                      </div>
                      <p className="text-sm text-slate-600">{item.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={GitBranch}
            id="monorepo"
            title="Estrutura do monorepo"
            subtitle="Duas aplicações e dois pacotes compartilhados. A lógica de negócio vive em packages/core, fora das apps."
          />
          <div className="bg-slate-900 rounded-xl p-5 overflow-x-auto">
            <pre className="text-xs text-slate-300 font-mono leading-relaxed">{monorepo}</pre>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900 mb-1">Por que core é um pacote separado</p>
              <p className="text-sm text-slate-600">
                O pipeline, o DLP e o cálculo de custo rodam tanto no gateway (Fastify) quanto no
                chat web (route handler do Next). Duplicar essa lógica significaria duas
                interpretações possíveis de &quot;quanto custou&quot; e de &quot;isso é PII&quot;.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900 mb-1">Por que dois serviços e não um</p>
              <p className="text-sm text-slate-600">
                O gateway atende SDKs em alto volume e escala por throughput; o dashboard escala por
                número de usuários. Separados, um pico de tráfego de API não derruba o painel — e o
                gateway não carrega o bundle do Next.
              </p>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle
            icon={Workflow}
            id="pipeline"
            title="Pipeline de requisição"
            subtitle="Toda chamada — do gateway ou do chat web — passa pelos mesmos 7 estágios, sempre nesta ordem."
          />
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {pipeline.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold bg-slate-900 text-white rounded px-2.5 py-1">
                  {p.name}
                </span>
                {i < pipeline.length - 1 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {pipeline.map((p) => (
              <div key={p.name} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-xs font-mono text-slate-400">{p.step}</span>
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  <span className="text-xs font-mono text-slate-400 ml-auto hidden md:block">
                    {p.where}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {p.rules.map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-slate-300 shrink-0">·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={Database}
            id="banco"
            title={`Banco de dados — ${tables.length} tabelas`}
            subtitle="PostgreSQL com Drizzle. Toda tabela de dados carrega org_id; ai_tools e models são catálogos globais compartilhados."
          />
          <div className="space-y-4">
            {tables.map((t) => (
              <div key={t.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Table2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-sm font-semibold text-slate-900">{t.name}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${groupStyle[t.group]}`}>
                      {t.group}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1.5">{t.desc}</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {t.cols.map((c) => (
                    <div
                      key={c.n}
                      className="px-5 py-2 flex flex-col md:flex-row md:items-baseline gap-0.5 md:gap-3"
                    >
                      <span className="font-mono text-xs text-slate-800 md:w-72 shrink-0">{c.n}</span>
                      <span className="font-mono text-xs text-blue-600 md:w-52 shrink-0">{c.t}</span>
                      {c.note && <span className="text-xs text-slate-500">{c.note}</span>}
                    </div>
                  ))}
                </div>
                {t.extra && (
                  <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-800">{t.extra}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={ListTree}
            id="enums"
            title={`Enums — ${enums.length} tipos`}
            subtitle="Estados válidos são restringidos no banco, não só na aplicação. Um valor fora da lista é erro de INSERT."
          />
          <div className="grid md:grid-cols-2 gap-3">
            {enums.map((e) => (
              <div key={e.name} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="font-mono text-xs font-semibold text-slate-900 mb-2">{e.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {e.values.map((v) => (
                    <span key={v} className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={Sparkles}
            id="regras"
            title="Regras de negócio"
            subtitle="Os limiares, fórmulas e critérios que o sistema aplica sozinho."
          />

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="font-semibold text-sm text-slate-900">DLP — padrões detectados</p>
              <p className="text-xs text-slate-500 mt-0.5">
                packages/core/dlp.ts · aplicado apenas a mensagens do usuário, antes do forward
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {dlpPatterns.map((p) => (
                <div key={p.key} className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-xs text-slate-500">{p.key}</span>
                    <span className="text-sm font-medium text-slate-900">{p.label}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${severityStyle[p.severity]}`}>
                      {p.severity}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto font-mono">{p.ex}</span>
                  </div>
                  <code className="text-xs font-mono text-violet-700 bg-violet-50 rounded px-2 py-1 inline-block break-all">
                    {p.regex}
                  </code>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-600">
                Severidade agregada da requisição: <strong>critical</strong> se houver qualquer match
                critical, senão <strong>high</strong> se houver algum high, senão{" "}
                <strong>medium</strong>. A ação (block ou mask) vem de rules.action da policy.
              </p>
            </div>
          </div>

          <div className="mb-5">
            <p className="font-semibold text-sm text-slate-900 mb-1">Motor de otimização</p>
            <p className="text-xs text-slate-500 mb-3">
              packages/core/optimization-engine.ts · 4 detectores rodam em paralelo sobre as
              assinaturas ativas da org
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {detectors.map((d) => (
                <div key={d.type} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="font-mono text-xs bg-slate-900 text-white rounded px-2 py-0.5">
                      {d.type}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{d.title}</span>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Dispara quando
                      </dt>
                      <dd className="text-slate-700">{d.trigger}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Severidade
                      </dt>
                      <dd className="text-slate-700">{d.severity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Economia estimada
                      </dt>
                      <dd className="text-slate-700 font-mono text-xs">{d.savings}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{d.note}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 mt-3">
              <p className="text-sm font-semibold text-slate-900 mb-2">Ciclo de vida de um insight</p>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                {["open", "acknowledged", "resolved"].map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    <span className="font-mono bg-slate-100 text-slate-700 rounded px-2 py-1">{s}</span>
                    {i < 2 && <span className="text-slate-300">→</span>}
                  </span>
                ))}
                <span className="text-slate-300 mx-1">ou</span>
                <span className="font-mono bg-slate-100 text-slate-500 rounded px-2 py-1">dismissed</span>
              </div>
              <p className="text-xs text-slate-600">
                Insights são regravados a cada execução com onConflictDoNothing — um insight já
                dispensado não reaparece. resolved_at só é preenchido na transição para resolved.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="font-semibold text-sm text-slate-900">
                Conciliação de faturamento — descoberta de shadow AI
              </p>
              <p className="text-xs text-slate-500 mt-0.5">packages/core/billing-matcher.ts</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {billingRules.map((r, i) => (
                <li key={i} className="px-5 py-2.5 text-sm text-slate-600 flex gap-3">
                  <span className="font-mono text-xs text-slate-300 shrink-0 mt-0.5">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="font-semibold text-sm text-slate-900">Cálculo de custo</p>
              <p className="text-xs text-slate-500 mt-0.5">packages/core/cost.ts</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {costRules.map((r, i) => (
                <li key={i} className="px-5 py-2.5 text-sm text-slate-600 flex gap-2">
                  <span className="text-slate-300 shrink-0">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <SectionTitle
            icon={ShieldCheck}
            id="seguranca"
            title="Segurança e isolamento"
            subtitle="Onde os segredos ficam, em que forma, e como um tenant é impedido de ver o outro."
          />
          <div className="grid md:grid-cols-2 gap-3">
            {securityRules.map((s) => (
              <div key={s.title} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                </div>
                <p className="text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            icon={Settings2}
            id="env"
            title="Variáveis de ambiente"
            subtitle="O que cada serviço precisa para subir."
          />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {envVars.map((e) => (
                <div
                  key={e.key}
                  className="px-5 py-3 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4"
                >
                  <span className="font-mono text-xs text-slate-900 md:w-80 shrink-0 break-all">
                    {e.key}
                  </span>
                  <span className="text-xs text-slate-400 md:w-28 shrink-0">{e.scope}</span>
                  <span className="text-sm text-slate-600">{e.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Ver funcionalidades
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <Database className="w-4 h-4" />
            Acessar o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
