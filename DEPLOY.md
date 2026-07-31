# Deploy do Tutela na Railway

Guia de 10 minutos para subir web + gateway em produção. Assume conta na
Railway e Postgres no Neon (grátis).

---

## 1. Crie o Postgres

- Vá em <https://console.neon.tech> → **New Project**.
- Copie a `DATABASE_URL` (formato `postgresql://user:pass@host/db?sslmode=require`).
- Rode as migrations e o seed do Tutela **antes do primeiro deploy**:
  ```bash
  # local, na raiz do repo
  pnpm install
  DATABASE_URL="postgres://…" pnpm --filter @aigate/db db:generate
  DATABASE_URL="postgres://…" pnpm --filter @aigate/db db:migrate
  DATABASE_URL="postgres://…" TUTELA_SEED=1 pnpm --filter @aigate/db db:seed
  ```
- Anote o `id` da organização criada (aparece nos logs do seed) — vai virar
  `DEMO_ORG_ID` do web.

## 2. Provisione o Clerk (auth do dashboard)

- <https://dashboard.clerk.com> → **Create application**.
- Copie `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
- Depois do primeiro login, atualize o `clerk_id` do sócio no banco:
  ```sql
  UPDATE users SET clerk_id = '<seu-clerk-user-id>'
   WHERE email = 'renata.almeida@almeidasocios.adv.br';
  ```

## 3. Gere as chaves de criptografia

```bash
# 32 bytes em hex — usado para AES-256-GCM (entityMap + chaves de provider)
openssl rand -hex 32
```

Guarde esse valor. Trocá-lo depois **invalida** todas as chaves de provider
que já estiverem no banco.

## 4. Suba na Railway

Duas alternativas:

### Opção A — via botão "New Project" (web)

1. <https://railway.app/new> → **Deploy from GitHub repo** →
   `pastorrudrigus/Ai-audit`.
2. Depois de conectado, **crie DOIS serviços a partir do mesmo repo**:
   - **tutela-web**
     - Root Directory: `apps/web`
     - Dockerfile Path: `apps/web/Dockerfile` (auto-detectado pelo
       `apps/web/railway.toml`)
   - **tutela-gateway**
     - Root Directory: `apps/gateway`
     - Dockerfile Path: `apps/gateway/Dockerfile`

### Opção B — via CLI

```bash
npm i -g @railway/cli
railway login
railway init            # cria o projeto
railway up --service tutela-web       --detach
railway up --service tutela-gateway   --detach
```

## 5. Variáveis de ambiente

Cole as envs abaixo em **Settings → Variables** de cada serviço.

### `tutela-web`

| Nome | Valor |
|---|---|
| `DATABASE_URL` | URL do Neon |
| `ENCRYPTION_KEY` | hex de 32 bytes gerado no passo 3 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | do Clerk |
| `CLERK_SECRET_KEY` | do Clerk |
| `DEMO_ORG_ID` | id da banca criada no seed |
| `NEXT_PUBLIC_APP_URL` | URL pública do web (Railway atribui automaticamente) |
| `DEMO_MODE` | `false` em prod real; `true` para demo sem chamar LLM |

### `tutela-gateway`

| Nome | Valor |
|---|---|
| `DATABASE_URL` | mesmo do web |
| `ENCRYPTION_KEY` | **exatamente o mesmo** do web (senão o entityMap não decifra) |
| `NEXT_PUBLIC_APP_URL` | URL pública do web (para CORS) |
| `TUTELA_NER_API_KEY` | chave OpenAI (ou compatível) para o NER |
| `TUTELA_NER_MODEL` | default: `gpt-4o-mini` |
| `TUTELA_VERIFY_API_KEY` | opcional; se ausente, cai para `TUTELA_NER_API_KEY` |
| `UPSTASH_REDIS_REST_URL` | opcional (habilita cache de verificação de citações) |
| `UPSTASH_REDIS_REST_TOKEN` | opcional |
| `TUTELA_RATE_LIMIT_MAX` | default `200` |
| `TUTELA_RATE_LIMIT_WINDOW` | default `1 minute` |

Precisa também popular pelo dashboard (`/keys`) uma **API key do provider**
(OpenAI/Anthropic) para a org, cifrada pelo próprio app.

## 6. Healthchecks

- `tutela-web`: `GET /` deve responder 200 (o middleware do Clerk redireciona
  para `/sign-in`, que é 200).
- `tutela-gateway`: `GET /health` deve responder `{ status: "ok" }`.

## 7. Onde ver o produto rodando

- Painel do Sócio: `<web-url>/painel`
- Portal do Advogado: `<web-url>/chat`
- Transparência de políticas: `<web-url>/policies/status`
- Documentação técnica: `<web-url>/tech`
- Demo pública (sem login): `<web-url>/demo`

## Custos aproximados no piloto

- Railway (2 serviços, plano Hobby): ~US$ 5/mês em créditos.
- Neon Postgres: grátis até 3 GB.
- Upstash Redis: grátis até 10k req/dia.
- OpenAI (NER + verificação): ≈ US$ 0,10 por 1k consultas com `gpt-4o-mini`.

Total: menos de US$ 10/mês para o piloto com bancas fundadoras.
