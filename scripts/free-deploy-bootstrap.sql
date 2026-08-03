-- ============================================================
-- Tutela — deploy grátis em 15 minutos
-- ============================================================
--
-- Cole ESTE ARQUIVO INTEIRO no Neon SQL Editor e clique Run.
-- Roda em ~5 segundos.
--
-- O que faz:
--   1. Cria todas as tabelas do schema
--   2. Insere UMA banca demo com uuid conhecido
--   3. Insere áreas, providers placeholder, policies e routing rules
--   4. Você NÃO precisa saber SQL — só copiar o output
--
-- Depois de rodar, copie:
--
--     DEMO_ORG_ID=aaaaaaaa-0000-0000-0000-000000000001
--
-- E cole nas env vars do Vercel. Redeploy e pronto.
-- ============================================================

-- ─── PASSO 1: SCHEMA ─────────────────────────────────────────
-- Idempotente. Rodar duas vezes não quebra.

DO $$ BEGIN
 CREATE TYPE "public"."pricing_model" AS ENUM('per_seat', 'per_credit', 'per_usage', 'flat', 'freemium');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."tool_category" AS ENUM('assistant', 'writer', 'coder', 'image', 'video', 'audio', 'search', 'note', 'meeting', 'design', 'data', 'automation', 'security', 'legal', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."attachment_status" AS ENUM('uploaded', 'attached', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."alert_type" AS ENUM('budget_threshold', 'anomaly_spend', 'dlp_violation', 'blocked_provider', 'shadow_tool');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."optimization_type" AS ENUM('use_gateway_instead', 'model_downgrade', 'consolidate_seats', 'unused_seats', 'cancel_shadow_it');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."policy_type" AS ENUM('dlp', 'model_access', 'budget_control', 'rate_limit', 'citation_check');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."provider_type" AS ENUM('openai', 'anthropic', 'google', 'cohere', 'azure_openai');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."request_source" AS ENUM('gateway', 'web_interface', 'platform_import');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."request_status" AS ENUM('success', 'error', 'blocked_policy', 'blocked_budget', 'blocked_dlp', 'blocked_injection');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."subscription_seat_status" AS ENUM('active', 'inactive', 'unused_30d', 'unused_60d');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'trialing', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'manager', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Tabelas principais (versão condensada — pega tudo que a app precisa
-- para funcionar em modo demo grátis; migrations completas ficam em
-- packages/db/migrations/0000_baseline.sql)

CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL UNIQUE,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"monthly_budget" numeric(10, 2),
	"budget_alert_threshold" integer DEFAULT 80,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"clerk_id" varchar(255) UNIQUE,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider_type" "provider_type" NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"target_provider_id" uuid NOT NULL,
	"target_model_id" varchar(255) NOT NULL,
	"fallback_provider_id" uuid,
	"fallback_model_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "policy_type" NOT NULL,
	"rules" jsonb NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"department_id" uuid,
	"period" varchar(7) NOT NULL,
	"limit_amount" numeric(10, 2) NOT NULL,
	"spent_gateway" numeric(10, 2) DEFAULT '0',
	"spent_platforms" numeric(10, 2) DEFAULT '0',
	"is_hard_limit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"department_id" uuid,
	"source" "request_source" NOT NULL,
	"provider_type" "provider_type" NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer,
	"status" "request_status" NOT NULL,
	"dlp_flags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"request_log_id" uuid,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"extracted_text" text DEFAULT '' NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"page_count" integer,
	"status" "attachment_status" DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"storage_bucket" varchar(100),
	"storage_key" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- FKs mínimas
DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "departments_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_dept_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "providers" ADD CONSTRAINT "providers_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_target_fk" FOREIGN KEY ("target_provider_id") REFERENCES "providers"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "policies" ADD CONSTRAINT "policies_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "budgets" ADD CONSTRAINT "budgets_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conv_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "conv_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "msg_conv_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "attachments" ADD CONSTRAINT "att_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "attachments" ADD CONSTRAINT "att_conv_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "request_logs" ADD CONSTRAINT "rl_org_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "request_logs_org_created_idx" ON "request_logs"("org_id","created_at");
CREATE INDEX IF NOT EXISTS "attachments_conv_idx" ON "attachments"("conversation_id");

-- ─── PASSO 2: DEMO DATA (banca fictícia) ─────────────────────
-- UUIDs fixos permitem colar o DEMO_ORG_ID no Vercel sem query extra.

INSERT INTO "organizations" (id, name, slug, settings)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Banca Demo', 'demo', '{"vertical":"juridico"}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "departments" (id, org_id, name, monthly_budget)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cível', 300.00),
  ('aaaaaaaa-0000-0000-0000-000000000102', 'aaaaaaaa-0000-0000-0000-000000000001', 'Trabalhista', 300.00),
  ('aaaaaaaa-0000-0000-0000-000000000103', 'aaaaaaaa-0000-0000-0000-000000000001', 'Contratos', 200.00)
ON CONFLICT (id) DO NOTHING;

-- Provider placeholder — chave falsa. DEMO_MODE=true no Vercel faz o
-- forwardRequest devolver resposta mock sem chamar a OpenAI de verdade.
INSERT INTO "providers" (id, org_id, name, provider_type, api_key_encrypted, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000201', 'aaaaaaaa-0000-0000-0000-000000000001', 'OpenAI (demo)', 'openai', 'demo:no-op:not-a-real-key', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "routing_rules" (id, org_id, name, priority, conditions, target_provider_id, target_model_id, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000301', 'aaaaaaaa-0000-0000-0000-000000000001', 'Fallback global', 100, '{}'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000201', 'gpt-4o-mini', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "policies" (id, org_id, name, type, rules, scope, is_active)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000401', 'aaaaaaaa-0000-0000-0000-000000000001', 'Anonimização reversível', 'dlp', '{"action":"anonymize","nerTypes":["PESSOA","EMPRESA","ENDERECO","VALOR"],"blockInjection":false}'::jsonb, '{"global":true}'::jsonb, true),
  ('aaaaaaaa-0000-0000-0000-000000000402', 'aaaaaaaa-0000-0000-0000-000000000001', 'Verificação de citações', 'citation_check', '{"mode":"on_demand"}'::jsonb, '{"global":true}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "budgets" (org_id, period, limit_amount, spent_gateway, spent_platforms, is_hard_limit)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', to_char(now(), 'YYYY-MM'), 1000.00, '0', '0', false)
ON CONFLICT DO NOTHING;

-- ─── OUTPUT ──────────────────────────────────────────────────
-- Copie a linha abaixo para o Vercel env prod:

SELECT 'DEMO_ORG_ID=aaaaaaaa-0000-0000-0000-000000000001' AS "▶ Cole isto no Vercel";
