# Segurança e proteção de dados — Tutela

Este documento resume, em uma página, **o que é armazenado, o que é cifrado
e o que nunca sai da infraestrutura**. É intencionalmente curto: ele existe
para virar anexo comercial da carta de intenção com bancas piloto, e para
que qualquer sócio consiga auditar o produto em uma leitura de café.

Última revisão: 2026-07.

---

## O que a plataforma faz com o texto do advogado

Quando o advogado envia uma consulta pelo Portal, o texto passa por um
pipeline determinístico (`packages/core/pipeline.ts`) antes de sair para
qualquer modelo externo:

1. **Autenticação** — Bearer `aig_sk_...`. A chave é comparada por hash
   SHA-256; a chave em claro nunca é gravada.
2. **Política de acesso** — se a área do advogado tem restrição de modelo,
   a consulta é barrada antes do envio.
3. **Anonimização (DLP)** — regex de PII (CPF, CNPJ, cartão, e-mail,
   telefone, OAB, número CNJ) + NER via LLM barato (nomes de pessoas,
   empresas, endereços, valores). O texto que sai da nossa rede tem os
   dados sensíveis substituídos por tokens reversíveis (`⟨CPF_1⟩`).
4. **Roteamento** — a regra ativa escolhe o provedor e o modelo, com
   fallback automático se o primário falhar.
5. **Orçamento** — se a área tem limite mensal duro configurado e o
   consumo estimado ultrapassa, a consulta é barrada (HTTP 402).
6. **Encaminhamento** — o texto tokenizado vai para o provedor. O
   provedor **nunca** recebe o mapa token→valor.
7. **Log** — request_logs guarda contagens agregadas (`totalCount` por
   tipo, severidade, status) e o custo. **Nunca** o texto original nem
   os valores detectados.

## O que fica armazenado no banco

Postgres (Neon) — schemas em `packages/db/schema/`.

| Categoria | Armazenado? | Forma |
|---|---|---|
| Texto do prompt do usuário | Não em `request_logs`. Sim em `messages` (chat web) para permitir revisitar a conversa. | Plaintext (necessário para exibir a conversa no Portal). |
| Valores tarjados (CPFs, nomes) originais | **Nunca** em nenhuma coluna. | — |
| Contagens de tarjas por tipo | Sim em `request_logs.dlpFlags` | JSON agregado: `{ totalCount, byType, severity }`. |
| Chave do gateway (`aig_sk_`) | Só o hash SHA-256 (`api_keys.key_hash`). | Chave em claro é exibida uma única vez, na criação. |
| Chave do provedor de LLM | Sim em `providers.api_key_encrypted`. | **AES-256-GCM**, formato `iv:authTag:ciphertext`. Descriptografada em memória apenas no momento do forward. |
| Mapa token→valor original | **Nunca** persistido. | Retornado ao cliente cifrado com AES-256-GCM, no campo `tutela.entity_map`. A decifração acontece no servidor Next (endpoint `/api/chat/reveal`) usando a mesma `ENCRYPTION_KEY`. |
| Verificação de citações | Sim em `request_logs.metadata` (agregado: `total`, `confirmada`, `divergente`, `nao_encontrada`). | Sem os textos das citações. |
| Cache de verificação | Redis (Upstash), TTL 7 dias, chave = hash SHA-256 da referência normalizada. | Apenas o resultado (status/observação/fonte), nunca dados do escritório. |

## O que nunca sai da nossa rede

- **`ENCRYPTION_KEY`** (32 bytes hex) — vive só em variável de ambiente do
  container. Trocá-la invalida todas as chaves de provider gravadas.
- **`CLERK_SECRET_KEY`** — auth do dashboard.
- **Chaves de provedor decifradas** — existem só em memória do processo,
  durante o forward de uma única requisição.

## Isolamento multi-tenant

- Toda tabela de dados carrega `org_id` com FK `on delete cascade`.
- Toda query filtra por `org_id`. O `org_id` **nunca** vem do cliente: no
  dashboard é derivado da sessão Clerk; no gateway é derivado da chave.
- Catálogos globais (`ai_tools`, `models`) intencionalmente não têm
  `org_id` — são somente-leitura para as organizações.

## Rate limit

- `@fastify/rate-limit` no gateway, com bucket por hash da API key (não
  guarda a chave). Default: 200 req/min por chave. Configurável via
  `TUTELA_RATE_LIMIT_MAX` e `TUTELA_RATE_LIMIT_WINDOW`.

## Segurança do NER (o passo que envolve um LLM externo)

- O NER usa um modelo barato configurado em `TUTELA_NER_MODEL` (default:
  `gpt-4o-mini`).
- O texto enviado ao NER **já passou pelo passo regex** — CPF, CNPJ,
  processo etc. viram tokens antes de o NER ver. O NER só recebe texto com
  esses trechos já mascarados, minimizando a exposição.
- Falha ou timeout do NER (3–5s) **nunca** derruba a consulta do advogado:
  o pipeline segue com o que a regex conseguiu e o `dlpFlags.nerStatus`
  registra `"skipped"` ou `"failed"` para auditoria.

## Verificação de citações (o passo que consulta a web)

- A busca web via LLM (com `web_search_preview`) recebe **apenas a
  citação** (`REsp 1234567/SP`, `art. 5º da CF/88`, etc.) e o trecho
  original onde ela apareceu. Nunca a peça inteira.
- O resultado é cacheado 7 dias por hash da referência — a mesma súmula
  citada centenas de vezes é resolvida uma vez.

## O que este documento **não** cobre

- BackUps do banco e política de retenção — depende do plano do Neon.
- Auditoria de acesso ao dashboard (quem viu o quê) — futura.
- Certificações formais (ISO 27001, SOC 2) — a estrutura já facilita, mas
  não substitui uma auditoria externa.

## Contato

Vulnerabilidades: reportar em `security@tutela.legal` (a criar). Enquanto
isso, use o canal com o time de produto.
