/**
 * CitationSource v1 — verificação por busca web via LLM com tool de search.
 *
 * O modelo recebe a citação e uma instrução dura para devolver JSON estrito
 * com status/observacao/fonte. A tool de search é opcional (nem todos os
 * provedores expõem — a OpenAI expõe `web_search_preview` em modelos
 * habilitados). Sem tool, o modelo cai no que sabe de memória e o resultado
 * é sinalizado com menor confiança.
 */

import type { Citation, CitationSource, VerifiedCitation, CitationStatus } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 15_000;

interface WebSourceOptions {
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
  baseUrl?: string;
  /** Se true, tenta habilitar a tool de web search do modelo. Default true. */
  enableWebSearch?: boolean;
}

function buildPrompt(citation: Citation): { system: string; user: string } {
  const system = [
    "Você é um verificador de citações jurídicas brasileiras.",
    "Sua tarefa: dado UMA citação, decidir se ela existe e se está correta.",
    "Use busca na web (jurisprudência de STJ, STF, TST, TRTs, TJs; Planalto para legislação) se disponível.",
    "Regras estritas:",
    "1. Responda APENAS com JSON válido, sem prosa, sem markdown, sem cercas de código.",
    "2. Formato exato: {\"status\":\"confirmada|divergente|nao_encontrada\",\"observacao\":\"...\",\"fonte\":\"...\"}.",
    "3. status=confirmada: a citação existe E o trecho corresponde ao que ela diz.",
    "4. status=divergente: existe algo com esse número, mas o conteúdo/tese não bate.",
    "5. status=nao_encontrada: não localizei essa referência em fonte oficial.",
    "6. observacao: uma frase curta explicando (máx. 200 caracteres).",
    "7. fonte: URL da fonte consultada, ou nome do repositório oficial (ex.: 'STJ jurisprudência').",
    "8. Na dúvida entre confirmada e divergente, prefira divergente.",
    "9. Na dúvida entre divergente e nao_encontrada, prefira nao_encontrada.",
  ].join("\n");
  const user = [
    `Referência: ${citation.referencia}`,
    `Tipo: ${citation.tipoCitacao}`,
    `Trecho onde apareceu: "${citation.trecho}"`,
  ].join("\n");
  return { system, user };
}

const VALID_STATUS: CitationStatus[] = ["confirmada", "divergente", "nao_encontrada"];

export function createWebSearchSource(options: WebSourceOptions = {}): CitationSource {
  const model = options.model ?? process.env.TUTELA_VERIFY_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const enableWebSearch = options.enableWebSearch ?? true;

  return {
    name: "web_search",
    supports: ["jurisprudencia", "legislacao"],
    async verify(citation) {
      const apiKey =
        options.apiKey ??
        process.env.TUTELA_VERIFY_API_KEY ??
        process.env.TUTELA_NER_API_KEY;
      const baseUrl =
        options.baseUrl ??
        process.env.TUTELA_VERIFY_BASE_URL ??
        process.env.TUTELA_NER_BASE_URL ??
        "https://api.openai.com";

      if (!apiKey) {
        return {
          status: "erro",
          observacao: "Verificação indisponível: TUTELA_VERIFY_API_KEY não configurada.",
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const { system, user } = buildPrompt(citation);

        // A tool web_search_preview é aceita pelos modelos OpenAI habilitados;
        // outros modelos ignoram o campo tools sem quebrar.
        const body: Record<string, unknown> = {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        };
        if (enableWebSearch) {
          body.tools = [{ type: "web_search_preview" }];
        }

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return {
            status: "erro",
            observacao: `Erro do verificador (HTTP ${res.status}): ${detail.slice(0, 120)}`,
          };
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as {
          status?: string;
          observacao?: string;
          fonte?: string;
        };
        const status = (parsed.status ?? "").toLowerCase() as CitationStatus;
        if (!VALID_STATUS.includes(status)) {
          return {
            status: "erro",
            observacao: "Resposta do verificador em formato inesperado.",
          };
        }
        return {
          status,
          observacao: (parsed.observacao ?? "").slice(0, 400),
          fonte: parsed.fonte ?? undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        return {
          status: "erro",
          observacao: `Falha na verificação: ${msg.slice(0, 200)}`,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  } satisfies CitationSource & {
    verify: (c: Citation) => Promise<Omit<VerifiedCitation, "referencia" | "tipoCitacao" | "trecho">>;
  };
}
