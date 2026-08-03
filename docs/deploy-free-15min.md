# Tutela — deploy grátis em 15 min

**Custo:** R$ 0/mês. Zero cartão de crédito.
**O que roda:** UI completa, tarjas, reveal, anexos com extração e DLP, painel do sócio, verificação de citações (sem cache).
**O que fica off:** LLM real (respostas são mock), download do original dos anexos (extração + tarjas funcionam).
**Para ligar LLM depois:** deposita $5 na OpenAI e troca `DEMO_MODE=true` → `false`.

---

## Antes de começar

Ter em uma aba só:
- GitHub (fork ou acesso ao repo `pastorrudrigus/Ai-audit`)
- Gerador de segredo qualquer para `ENCRYPTION_KEY` — 32 bytes hex.
  No terminal: `openssl rand -hex 32`
  Ou cola isto **temporariamente** e troca depois:
  `0000000000000000000000000000000000000000000000000000000000000001`

---

## Passo 1 — Clerk (2 min)

1. Abre https://clerk.com → **Sign up** com Google
2. **Create Application**:
   - Name: `Tutela`
   - Sign-in options: só **Email + password** (desabilita o resto para simplificar)
3. Já dentro da aplicação, no menu esquerdo → **API Keys**
4. Copia os dois valores (deixa a aba aberta):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
   - `CLERK_SECRET_KEY=sk_test_...`

---

## Passo 2 — Neon (3 min)

1. Abre https://neon.tech → **Sign up** com GitHub
2. **Create a project**:
   - Name: `tutela`
   - Postgres version: default
   - Region: `us-east-2` (Ohio) ou `sa-east-1` se disponível
3. Copia a **Connection string** da aba Dashboard (formato `postgres://user:pass@host/db`)
4. No menu esquerdo → **SQL Editor**
5. Cola **o arquivo inteiro** `scripts/free-deploy-bootstrap.sql` do repo → **Run**
6. A última linha do output mostra:
   ```
   DEMO_ORG_ID=aaaaaaaa-0000-0000-0000-000000000001
   ```
   Guarda esse valor.

---

## Passo 3 — Vercel (5 min)

1. Abre https://vercel.com → **Sign up** com GitHub
2. **Add New → Project** → seleciona o repo `Ai-audit`
3. **Framework Preset**: Next.js (autodetecta)
4. **Root Directory**: `apps/web`
5. **Build Command**: `cd ../.. && pnpm build --filter @aigate/web`
6. **Install Command**: `cd ../.. && pnpm install`
7. Em **Environment Variables**, cola:

   ```
   DATABASE_URL=<sua connection string do Neon>
   CLERK_SECRET_KEY=<do Clerk>
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<do Clerk>
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat
   ENCRYPTION_KEY=<seus 32 bytes hex>
   DEMO_ORG_ID=aaaaaaaa-0000-0000-0000-000000000001
   DEMO_MODE=true
   ```

8. **Deploy**. Espera ~2 min.

---

## Passo 4 — Testar (2 min)

1. Vercel mostra a URL, tipo `tutela-xxx.vercel.app`
2. Abre → você é redirecionado para `/sign-in`
3. **Sign up** com um email seu, cria senha, clica no link de confirmação no email
4. Depois do login você cai em `/chat`
5. Escreve: `Analise o caso do CPF 123.456.789-09` → **Enter**
6. Você vai ver:
   - Sua mensagem com `⟨CPF_1⟩` no lugar do CPF (tarja funcionando)
   - Resposta mock ("Esta é uma resposta demonstrativa para...")
   - Badge "1 dado tarjado"
7. Clica no clipe → sobe qualquer PDF → vê o texto sendo extraído

**Se apareceu tudo isso, o deploy está funcional.**

---

## Ativar LLM real (opcional, +$5)

1. https://platform.openai.com → **Sign up** → **Billing** → deposita $5
2. **API Keys** → **Create new secret key** → copia `sk-...`
3. No Neon SQL Editor, roda:
   ```sql
   -- Substitui a chave placeholder pela real (sem criptografia — para o MVP grátis)
   -- Em prod real use o script provision-banca.ts que cifra com AES-256-GCM
   UPDATE providers
   SET api_key_encrypted = 'demo:no-op:sk-COLE-SUA-KEY-AQUI'
   WHERE org_id = 'aaaaaaaa-0000-0000-0000-000000000001';
   ```
   ⚠️ Chave em claro no banco é aceitável apenas para o modo demo/piloto.
4. No Vercel → **Settings → Environment Variables** → muda `DEMO_MODE=true` para `DEMO_MODE=false` → **Redeploy**

Agora as respostas vêm da OpenAI de verdade. Você paga só o que consumir; $5 costuma durar semanas em uso leve.

---

## O que fazer depois

- Domínio custom (`tutela.suabanca.com.br`): registra Cloudflare → aponta CNAME para Vercel. Free.
- Anexo com download original: cria bucket em R2, coloca 4 env vars, redeploy. Free até 10 GB.
- Alertas de erro: cria projeto Sentry, coloca `SENTRY_DSN` no Vercel, redeploy. Free 5k eventos/mês.
- Multi-banca (2ª cliente): aí sim precisa do plano pago do Clerk ($25/mês).

---

## Se der problema

**"Postgres connection error"** no Vercel: revisa a `DATABASE_URL`. Neon usa `?sslmode=require`, mantém isso na string.

**Clerk redireciona em loop**: as 4 env vars `NEXT_PUBLIC_CLERK_*` precisam bater com as rotas do projeto. Confere que existem `/sign-in`, `/sign-up`, `/chat` no app.

**"No provider configured"**: rodou o SQL? A linha do provider foi inserida? No SQL Editor: `SELECT * FROM providers;` — precisa ter 1 linha.

**Anexo falha silenciosamente**: normal se PDF for scaneado (imagem). Testa com um PDF de texto (qualquer contrato baixado do Google).
