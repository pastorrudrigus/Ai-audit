/**
 * DLP (Data Loss Prevention) — detecção e anonimização reversível
 *
 * O motor combina padrões regex determinísticos (este arquivo) com um passo NER
 * opcional via LLM (ner.ts). A detecção pura fica em scanForPII/scanMessages;
 * a substituição por tokens reversíveis fica em tokenizePII/detokenize.
 *
 * Regra de segurança: entityMap NUNCA deve ser enviado ao provider nem persistido
 * em claro no banco. Ver packages/core/pipeline.ts para o fluxo completo.
 */

export const DLP_PATTERNS = {
  cpf: {
    regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
    label: "CPF",
    token: "CPF",
    severity: "high" as const,
  },
  cnpj: {
    regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
    label: "CNPJ",
    token: "CNPJ",
    severity: "high" as const,
  },
  credit_card: {
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    label: "Cartão de crédito",
    token: "CARTAO",
    severity: "critical" as const,
  },
  email: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: "Email",
    token: "EMAIL",
    severity: "medium" as const,
  },
  phone_br: {
    regex: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g,
    label: "Telefone BR",
    token: "TELEFONE",
    severity: "medium" as const,
  },
  api_key: {
    regex: /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})\b/g,
    label: "API Key/Secret",
    token: "APIKEY",
    severity: "critical" as const,
  },
  // Padrões jurídicos (Tutela)
  processo_cnj: {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (com ou sem pontuação)
    regex: /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g,
    label: "Nº de processo (CNJ)",
    token: "PROCESSO",
    severity: "high" as const,
  },
  oab: {
    regex: /OAB[\/\s-]?[A-Z]{2}\s?\d{3,6}/gi,
    label: "OAB",
    token: "OAB",
    severity: "high" as const,
  },
};

export type DLPPatternKey = keyof typeof DLP_PATTERNS;
export type DLPSeverity = "medium" | "high" | "critical";

export interface DLPMatch {
  type: string;
  label: string;
  match: string;
  severity: DLPSeverity;
  position: { start: number; end: number };
  /** Fonte da detecção: regex determinística ou NER via LLM. */
  source?: "regex" | "ner";
}

export interface EntityMapping {
  /** Token que substitui o valor original no texto enviado ao provider. */
  token: string;
  /** Valor original — jamais serializar em claro fora da memória do processo. */
  original: string;
  /** Tipo lógico (cpf, processo_cnj, PESSOA, etc.). */
  type: string;
}

export interface TokenizeResult {
  maskedText: string;
  entityMap: EntityMapping[];
}

/* ------------------------------------------------------------------ */
/* Detecção                                                           */
/* ------------------------------------------------------------------ */

export function scanForPII(
  text: string,
  enabledPatterns: string[] = Object.keys(DLP_PATTERNS)
): DLPMatch[] {
  const matches: DLPMatch[] = [];

  for (const patternKey of enabledPatterns) {
    const pattern = DLP_PATTERNS[patternKey as DLPPatternKey];
    if (!pattern) continue;

    // Regex recriada a cada scan — evita estado compartilhado de lastIndex
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: patternKey,
        label: pattern.label,
        match: match[0],
        severity: pattern.severity,
        position: { start: match.index, end: match.index + match[0].length },
        source: "regex",
      });
    }
  }

  return matches;
}

export function scanMessages(
  messages: Array<{ role: string; content: string }>,
  enabledPatterns?: string[]
): { hasViolation: boolean; matches: DLPMatch[]; severity: DLPSeverity } {
  const allMatches: DLPMatch[] = [];

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const matches = scanForPII(msg.content, enabledPatterns);
    allMatches.push(...matches);
  }

  const hasCritical = allMatches.some((m) => m.severity === "critical");
  const hasHigh = allMatches.some((m) => m.severity === "high");

  return {
    hasViolation: allMatches.length > 0,
    matches: allMatches,
    severity: hasCritical ? "critical" : hasHigh ? "high" : "medium",
  };
}

/* ------------------------------------------------------------------ */
/* Tokenização reversível                                             */
/* ------------------------------------------------------------------ */

/**
 * Rótulo do token para um tipo de detecção. Padrões conhecidos usam
 * DLP_PATTERNS[type].token; tipos NER (PESSOA, EMPRESA...) mantêm o nome
 * em maiúsculas.
 */
function tokenLabelFor(type: string): string {
  const known = DLP_PATTERNS[type as DLPPatternKey];
  if (known) return known.token;
  return type.toUpperCase();
}

/**
 * Substitui os trechos detectados por tokens reversíveis do formato ⟨TIPO_N⟩.
 *
 * Consistência referencial: o mesmo valor literal recebe o mesmo token em todas
 * as ocorrências — isso preserva o raciocínio do LLM ("o autor" continua sendo
 * a mesma pessoa ao longo do texto).
 *
 * As substituições são aplicadas em ordem de comprimento decrescente para evitar
 * que o token de um match menor sobrescreva o meio de um match maior (ex.: um
 * telefone de 11 dígitos contido dentro de um CNPJ).
 *
 * @param text Texto original.
 * @param matches Matches vindos de scanForPII e/ou do NER (packages/core/ner.ts).
 */
export function tokenizePII(text: string, matches: DLPMatch[]): TokenizeResult {
  if (matches.length === 0) return { maskedText: text, entityMap: [] };

  // Consistência: mesmo (type, valor original) → mesmo token
  const tokenByKey = new Map<string, string>();
  const counterByType = new Map<string, number>();
  const entityMap: EntityMapping[] = [];

  for (const m of matches) {
    const key = `${m.type}::${m.match}`;
    if (tokenByKey.has(key)) continue;
    const label = tokenLabelFor(m.type);
    const n = (counterByType.get(label) ?? 0) + 1;
    counterByType.set(label, n);
    const token = `⟨${label}_${n}⟩`;
    tokenByKey.set(key, token);
    entityMap.push({ token, original: m.match, type: m.type });
  }

  // Deduplicar por posição e ordenar por comprimento desc.
  const dedup = new Map<string, DLPMatch>();
  for (const m of matches) {
    const posKey = `${m.position.start}:${m.position.end}`;
    if (!dedup.has(posKey)) dedup.set(posKey, m);
  }
  // Substituições da direita para a esquerda para preservar índices.
  const byPositionDesc = [...dedup.values()].sort(
    (a, b) => b.position.start - a.position.start
  );

  let result = text;
  for (const m of byPositionDesc) {
    const key = `${m.type}::${m.match}`;
    const token = tokenByKey.get(key)!;
    result =
      result.slice(0, m.position.start) + token + result.slice(m.position.end);
  }

  return { maskedText: result, entityMap };
}

/**
 * Reverte a tokenização em um texto (tipicamente a resposta do LLM).
 * Ordena por token mais longo primeiro para evitar prefixos ambíguos
 * (⟨CPF_10⟩ vs ⟨CPF_1⟩).
 */
export function detokenize(text: string, entityMap: EntityMapping[]): string {
  if (!entityMap.length) return text;
  const sorted = [...entityMap].sort((a, b) => b.token.length - a.token.length);
  let result = text;
  for (const m of sorted) {
    // split/join não interpreta metacaracteres — seguro para os tokens ⟨...⟩
    result = result.split(m.token).join(m.original);
  }
  return result;
}

/**
 * Agrega matches em contagens por tipo — usado para popular request_logs.dlpFlags
 * sem vazar valores originais.
 */
export function summarizeMatches(matches: DLPMatch[]): {
  totalCount: number;
  bySource: { regex: number; ner: number };
  byType: Record<string, number>;
  severity: DLPSeverity;
} {
  const byType: Record<string, number> = {};
  let regexCount = 0;
  let nerCount = 0;
  for (const m of matches) {
    byType[m.type] = (byType[m.type] ?? 0) + 1;
    if (m.source === "ner") nerCount += 1;
    else regexCount += 1;
  }
  const hasCritical = matches.some((m) => m.severity === "critical");
  const hasHigh = matches.some((m) => m.severity === "high");
  return {
    totalCount: matches.length,
    bySource: { regex: regexCount, ner: nerCount },
    byType,
    severity: hasCritical ? "critical" : hasHigh ? "high" : "medium",
  };
}

/**
 * @deprecated Usar tokenizePII (reversível). Mantido para retrocompat de callers
 * antigos; será removido após a virada completa do Tutela.
 */
export function maskPII(text: string, matches: DLPMatch[]): string {
  const sorted = [...matches].sort((a, b) => b.position.start - a.position.start);
  let result = text;
  for (const m of sorted) {
    result =
      result.slice(0, m.position.start) +
      `[${m.label} REDACTED]` +
      result.slice(m.position.end);
  }
  return result;
}
