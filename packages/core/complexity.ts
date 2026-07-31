/**
 * Classificador de complexidade da tarefa — heurística v1.
 *
 * O objetivo é alimentar o roteador de modelos: pedidos simples (resumir,
 * explicar, listar) vão para o modelo econômico; redações longas (petição,
 * recurso, parecer) vão para o modelo avançado.
 *
 * A interface é intencionalmente estável para que a v2 possa trocar a heurística
 * por um classificador dedicado (LLM ou modelo próprio) sem mudar chamadores.
 */

export type TaskComplexity = "simple" | "complex";

/**
 * Palavras que indicam produção jurídica de fôlego. A comparação é
 * case-insensitive e usa borda para não pegar substrings acidentais.
 */
const COMPLEX_KEYWORDS = [
  "petição",
  "peticao",
  "recurso",
  "recorrer",
  "recorrida",
  "contestação",
  "contestacao",
  "parecer",
  "razões finais",
  "razoes finais",
  "contrarrazões",
  "contrarrazoes",
  "apelação",
  "apelacao",
  "agravo",
  "embargos",
  "fundamentar",
  "fundamentação",
  "fundamentacao",
  "redigir",
  "elaborar",
  "minutar",
  "impugnação",
  "impugnacao",
  "manifestação",
  "manifestacao",
  "acordo",
  "sentença",
  "sentenca",
];

const SIMPLE_KEYWORDS = [
  "resumir",
  "resumo",
  "resuma",
  "explicar",
  "explique",
  "explicação",
  "explicacao",
  "listar",
  "liste",
  "traduzir",
  "traduza",
  "definir",
  "defina",
  "o que é",
  "o que e",
];

/**
 * Limite (em caracteres) acima do qual um único pedido do usuário passa a ser
 * tratado como complexo mesmo sem keyword — textos longos geralmente exigem
 * mais contexto e raciocínio.
 */
const LONG_MESSAGE_THRESHOLD = 1_200;

/**
 * Limite (em caracteres) do total das mensagens do usuário para escalar como
 * complexo — cobre o caso "várias trocas grandes acumuladas".
 */
const LONG_CONVERSATION_THRESHOLD = 4_000;

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export function classifyComplexity(
  messages: Array<{ role: string; content: string }>
): TaskComplexity {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "simple";

  const lastUserMessage = userMessages[userMessages.length - 1].content ?? "";
  const totalUserChars = userMessages.reduce((s, m) => s + (m.content?.length ?? 0), 0);

  // Sinais explícitos de complexidade (palavra tem prioridade sobre tamanho)
  if (containsAnyKeyword(lastUserMessage, COMPLEX_KEYWORDS)) return "complex";

  // Sinais explícitos de simplicidade
  if (
    containsAnyKeyword(lastUserMessage, SIMPLE_KEYWORDS) &&
    lastUserMessage.length < LONG_MESSAGE_THRESHOLD
  ) {
    return "simple";
  }

  // Sem keyword: cai no tamanho
  if (lastUserMessage.length >= LONG_MESSAGE_THRESHOLD) return "complex";
  if (totalUserChars >= LONG_CONVERSATION_THRESHOLD) return "complex";

  return "simple";
}
