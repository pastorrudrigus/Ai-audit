/**
 * Extração de citações jurídicas de um texto — via LLM em modo JSON estrito.
 *
 * A extração é intencionalmente conservadora: só retorna o que o modelo
 * consegue reproduzir literalmente a partir do texto (validado por substring).
 * Falha do modelo ou JSON inválido devolve lista vazia — a verificação nunca
 * inventa uma citação que o advogado não escreveu.
 */

import type { Citation, TipoCitacao } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8_000;

interface ExtractOptions {
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
  baseUrl?: string;
}

interface RawCitation {
  referencia: string;
  tipoCitacao: string;
  trecho: string;
}

function buildPrompt(text: string): { system: string; user: string } {
  const system = [
    "Você é um extrator de citações jurídicas em textos redigidos por advogados brasileiros.",
    "Extraia:",
    "- JURISPRUDÊNCIA: REsp, RR, AgRg, HC, RE, AgInt, súmulas (numeradas), OJs, acórdãos com nº CNJ.",
    "- LEGISLAÇÃO: dispositivos com número (art. 5º da CF/88, art. 927 do CPC, art. 6º da CLT, súmula X do STF, súmula vinculante Y).",
    "Regras estritas:",
    "1. Responda APENAS com JSON válido, sem prosa, sem markdown, sem cercas de código.",
    "2. Formato exato: {\"citacoes\":[{\"referencia\":\"...\",\"tipoCitacao\":\"jurisprudencia|legislacao\",\"trecho\":\"...\"}]}.",
    "3. O campo 'trecho' deve ser uma substring LITERAL do texto — copie exatamente, preservando pontuação.",
    "4. Não invente números. Se o texto disser \"em recente decisão do STJ\" sem número, IGNORE — não é citação verificável.",
    "5. Se não houver citações, responda {\"citacoes\":[]}.",
  ].join("\n");
  const user = `Texto:\n"""${text}"""`;
  return { system, user };
}

/**
 * Extrai citações jurídicas do texto.
 *
 * @param text Texto da resposta do LLM ou de uma peça carregada.
 * @param options Configuração do modelo. Se apiKey/baseUrl não vierem, tenta
 *                as envs TUTELA_VERIFY_API_KEY / TUTELA_VERIFY_BASE_URL, e cai
 *                para TUTELA_NER_API_KEY / TUTELA_NER_BASE_URL (mesmo provedor).
 * @returns Lista validada. Nunca lança — falha vira lista vazia.
 */
export async function extractCitations(
  text: string,
  options: ExtractOptions = {}
): Promise<Citation[]> {
  if (!text || !text.trim()) return [];

  const model = options.model ?? process.env.TUTELA_VERIFY_MODEL ?? DEFAULT_MODEL;
  const apiKey =
    options.apiKey ??
    process.env.TUTELA_VERIFY_API_KEY ??
    process.env.TUTELA_NER_API_KEY;
  const baseUrl =
    options.baseUrl ??
    process.env.TUTELA_VERIFY_BASE_URL ??
    process.env.TUTELA_NER_BASE_URL ??
    "https://api.openai.com";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { system, user } = buildPrompt(text);
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { citacoes?: RawCitation[] };
    if (!Array.isArray(parsed.citacoes)) return [];

    const validTypes: TipoCitacao[] = ["jurisprudencia", "legislacao"];
    const results: Citation[] = [];
    const seen = new Set<string>();

    for (const c of parsed.citacoes) {
      if (!c || typeof c.referencia !== "string" || typeof c.trecho !== "string") continue;
      const tipo = c.tipoCitacao?.toLowerCase() as TipoCitacao;
      if (!validTypes.includes(tipo)) continue;
      // Trecho deve ser substring literal — garantia mínima contra alucinação
      if (!text.includes(c.trecho)) continue;
      // Deduplica pela referência canônica normalizada
      const key = c.referencia.replace(/\s+/g, " ").trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        referencia: c.referencia.trim(),
        tipoCitacao: tipo,
        trecho: c.trecho,
      });
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normaliza a referência para uso como chave de cache. Removemos espaços
 * duplicados, colocamos em minúsculas e retiramos separadores comuns.
 */
export function normalizeCitationRef(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/[.,;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
