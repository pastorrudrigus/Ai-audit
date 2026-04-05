# AIGate — Plataforma Unificada de IA Corporativa

Gateway + Gestão de Plataformas + Interface Web + Dashboard Unificado.

## Stack

- **Monorepo:** Turborepo
- **Frontend/Dashboard:** Next.js 14+ (App Router) + TypeScript
- **UI:** shadcn/ui + Tailwind CSS + Recharts
- **Gateway/Proxy:** Fastify (Node.js) — OpenAI-compatible
- **Banco:** PostgreSQL via Drizzle ORM (Neon)
- **Auth:** Clerk
- **Cache/Rate Limit:** Redis (Upstash)
- **Deploy:** Railway

## Estrutura

```
aigate/
├── apps/
│   ├── web/        # Next.js — dashboard + chat
│   └── gateway/    # Fastify — API proxy
└── packages/
    ├── db/         # Schema Drizzle + seed
    └── core/       # DLP, pipeline, billing-matcher, optimization-engine
```

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Migrations e seed
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Rodar em desenvolvimento
npm run dev
```

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `UPSTASH_REDIS_REST_URL` | Redis URL (Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `ENCRYPTION_KEY` | 32 bytes hex para AES-256-GCM |
| `GATEWAY_PORT` | Porta do gateway (default: 3001) |
| `DEMO_ORG_ID` | ID da org demo para desenvolvimento |
| `DEMO_MODE` | `true` para respostas mock sem chamar providers |

## Gateway — uso

```python
import openai

client = openai.OpenAI(
    base_url="https://gw.aigate.com/v1",
    api_key="aig_sk_your_key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Features

- **API Gateway**: proxy OpenAI-compatible com auth, DLP, budget check, routing
- **Gestão de Plataformas**: cadastro de assinaturas, assentos, import CSV de billing
- **Chat Web**: interface de chat com transparência de custo por mensagem
- **Dashboard Unificado**: KPIs, tendência de gasto, breakdown por departamento
- **Otimizações**: detecção de assentos inativos, sobreposição de ferramentas, riscos de compliance
- **DLP**: detecção e bloqueio de CPF, CNPJ, cartão de crédito, API keys
