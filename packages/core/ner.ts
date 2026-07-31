/**
 * NER (Named Entity Recognition) via LLM — o que a regex não pega.
 *
 * A regex captura padrões estruturados (CPF, CNPJ, processo CNJ, OAB, email).
 * O NER cobre entidades livres: nomes de pessoas, empresas, endereços e valores
 * monetários redigidos em português corrente.
 *
 * Contrato: nunca derruba a request do advogado. Falha do modelo, timeout ou
 * JSON inválido → retorna [] com status "skipped" ou "failed". O pipeline
 * segue apenas com o que a regex conseguiu.
 */

import type { DLPMatch } from "./dlp";

const DEFAULT_NER_TYPES = ["PESSOA", "EMPRESA", "ENDERECO", "VALOR"] as const;
export type NERType = (typeof DEFAULT_NER_TYPES)[number] | string;

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MODEL = "gpt-4o-mini";

export interface NERResult {
  matches: DLPMatch[];
  status: "ok" | "skipped" | "failed";
  reason?: string;
}

interface NERCallOptions {
  types?: NERType[];
  timeoutMs?: number;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

interface RawEntity {
  texto: string;
  tipo: string;
}

/**
 * Constrói o prompt do NER. O modelo recebe uma instrução dura para devolver
 * APENAS um JSON no formato esperado. A validação (substring exata) roda em
 * seguida e descarta tudo que não bater.
 */
function buildPrompt(text: string, types: NERType[]): {
  system: string;
  user: string;
} {
  const typeList = types.join("|");
  const system = [
    "Você é um extrator de entidades nomeadas em textos jurídicos em português.",
    `Extraia SOMENTE entidades dos tipos: ${typeList}.`,
    "Regras estritas:",
    "1. Responda APENAS com JSON válido, sem prosa, sem markdown, sem cercas de código.",
    "2. Formato exato: {\"entidades\":[{\"texto\":\"...\",\"tipo\":\"...\"}]}.",
    "3. O campo 'texto' deve ser uma substring LITERAL do texto de entrada — copie exatamente, respeitando maiúsculas, acentos e pontuação.",
    "4. Não invente, não normalize, não abrevie. Se não houver entidades, responda {\"entidades\":[]}.",
    "5. Ignore CPF, CNPJ, número de processo, OAB, email, telefone — esses são tratados por regex à parte.",
  ].join("\n");
  const user = `Texto:\n"""${text}"""`;
  return { system, user };
}

/**
 * Faz uma chamada mínima e barata à API OpenAI-compatible do NER. Não usa nosso
 * próprio gateway (evita recursão: o NER é parte do pipeline do gateway).
 */
async function callNERModel(
  text: string,
  types: NERType[],
  opts: Required<Pick<NERCallOptions, "model" | "timeoutMs">> & {
    apiKey: string;
    baseUrl: string;
  }
): Promise<RawEntity[]> {
  const { system, user } = buildPrompt(text, types);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(`${opts.baseUrl}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { entidades?: RawEntity[] };
    return Array.isArray(parsed.entidades) ? parsed.entidades : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Encontra todas as posições onde `needle` ocorre em `haystack`. Usado para
 * expandir uma entidade retornada pelo NER em um ou mais DLPMatch — o modelo
 * pode citar "João da Silva" uma vez, mas o texto pode conter várias.
 */
function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const positions: number[] = [];
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    positions.push(idx);
    idx += needle.length;
  }
  return positions;
}

/**
 * Extrai entidades nomeadas via LLM.
 *
 * @param text Texto (idealmente já com padrões regex tokenizados, para evitar
 *             que o NER re-detecte o que a regex pegou).
 * @param options Configuração da chamada. Se apiKey/baseUrl não vierem, tenta
 *                ler das envs padrão (TUTELA_NER_API_KEY, TUTELA_NER_BASE_URL).
 * @returns matches + status. status="skipped" quando não há configuração; nunca
 *          lança.
 */
export async function detectNamedEntities(
  text: string,
  options: NERCallOptions = {}
): Promise<NERResult> {
  const types = options.types && options.types.length > 0
    ? options.types
    : (DEFAULT_NER_TYPES as readonly string[]).slice();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = options.model ?? process.env.TUTELA_NER_MODEL ?? DEFAULT_MODEL;
  const apiKey = options.apiKey ?? process.env.TUTELA_NER_API_KEY;
  const baseUrl =
    options.baseUrl ?? process.env.TUTELA_NER_BASE_URL ?? "https://api.openai.com";

  if (!apiKey) {
    return { matches: [], status: "skipped", reason: "TUTELA_NER_API_KEY not set" };
  }

  if (!text.trim()) {
    return { matches: [], status: "ok" };
  }

  let raw: RawEntity[];
  try {
    raw = await callNERModel(text, types, { model, timeoutMs, apiKey, baseUrl });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    return { matches: [], status: "failed", reason };
  }

  // Validação: substring exata + tipo dentro do conjunto pedido
  const allowed = new Set(types.map((t) => t.toUpperCase()));
  const matches: DLPMatch[] = [];

  for (const ent of raw) {
    if (!ent || typeof ent.texto !== "string" || typeof ent.tipo !== "string") continue;
    const tipo = ent.tipo.toUpperCase();
    if (!allowed.has(tipo)) continue;
    // Descarta tokens já existentes (⟨...⟩) que o modelo possa ter copiado
    if (/^⟨.+⟩$/.test(ent.texto)) continue;

    const positions = findAllOccurrences(text, ent.texto);
    for (const start of positions) {
      matches.push({
        type: tipo,
        label: tipo,
        match: ent.texto,
        severity: "high",
        position: { start, end: start + ent.texto.length },
        source: "ner",
      });
    }
  }

  return { matches, status: "ok" };
}
