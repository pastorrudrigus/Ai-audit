/**
 * Detector de prompt injection.
 *
 * Diferente do DLP (que tarja PII e é reversível), o injection detector só
 * FLAGA: encontra tentativas conhecidas de sequestrar o LLM ("ignore previous
 * instructions", "reveal original names", chat-template markers) e devolve os
 * matches. Nada é substituído no texto — bloquear ou não é decisão de policy
 * (default = warn, porque falsos positivos são reais: peça jurídica pode dizer
 * "desconsidere o precedente anterior" e não é ataque).
 *
 * Roda sobre o conteúdo COMPOSTO (texto digitado + texto extraído de anexo),
 * então PDF adversarial cai aqui também.
 *
 * Categorias:
 *   instruction_override — "ignore previous instructions", "disregard rules"
 *   persona_hijack       — "you are now a", "act as", "pretend to be"
 *   template_injection   — "system:", "<|im_start|>", markers de chat template
 *   prompt_exfiltration  — "print your system prompt", "repeat the text above"
 *   tutela_reveal        — específico: "revele os nomes originais", "desanoniminize"
 *   jailbreak_signal     — DAN, developer mode, AIM
 */

export type InjectionCategory =
  | "instruction_override"
  | "persona_hijack"
  | "template_injection"
  | "prompt_exfiltration"
  | "tutela_reveal"
  | "jailbreak_signal";

export type InjectionSeverity = "low" | "medium" | "high" | "critical";

export interface InjectionMatch {
  category: InjectionCategory;
  match: string;
  severity: InjectionSeverity;
  position: { start: number; end: number };
}

interface InjectionPattern {
  category: InjectionCategory;
  regex: RegExp;
  severity: InjectionSeverity;
}

/**
 * Regex bilíngue (PT-BR + EN). Compiladas com `i` para casar variações de
 * caixa. Não usam `\b` em torno de português porque acentos/hífens quebram
 * word-boundary; em vez disso, dependem do início/fim de frase natural.
 */
const PATTERNS: InjectionPattern[] = [
  // instruction_override — permitem qualificadores encadeados ("all previous",
  // "as instruções anteriores", "the above")
  {
    category: "instruction_override",
    regex: /ignor(?:e|a|em|ando)\s+(?:(?:all|any|the|todas?|toda|previous|prior|prévias?|anteriores?|above)\s+){0,3}(?:instruc(?:tion|tions|ções|ção)|rules?|regras?|constraints?|restri(?:ção|ções))/i,
    severity: "high",
  },
  {
    category: "instruction_override",
    regex: /disregard\s+(?:(?:all|the|previous|prior|above)\s+){0,3}(?:instruc(?:tion|tions)|rules?|constraints?)/i,
    severity: "high",
  },
  {
    category: "instruction_override",
    regex: /(?:desconsidere|esqueça|ignore)\s+(?:(?:as|os|a|o|todas?|todos?)\s+)?(?:instru(?:ç|c)(?:ão|ões|oes)|regras?|orienta(?:ç|c)(?:ão|ões|oes))(?:\s+(?:anteriores?|prévias?|acima))?/i,
    severity: "high",
  },
  {
    category: "instruction_override",
    regex: /override\s+(the\s+)?(system|previous|prior|default)\s+(prompt|instructions?|rules?)/i,
    severity: "high",
  },

  // persona_hijack
  {
    category: "persona_hijack",
    regex: /you\s+are\s+now\s+(a|an|the)\s+\w+/i,
    severity: "medium",
  },
  {
    category: "persona_hijack",
    regex: /act\s+as\s+(if\s+you|a|an|the)\s+/i,
    severity: "medium",
  },
  {
    category: "persona_hijack",
    regex: /(você|voce)\s+(é|e|agora\s+é)\s+(um|uma)\s+\w+\s+(sem|que\s+não|sem\s+nenhuma)\s+(restri|filtro|censura)/i,
    severity: "high",
  },
  {
    category: "persona_hijack",
    regex: /pretend\s+(to\s+be|you\s+are)\s+/i,
    severity: "medium",
  },
  {
    category: "persona_hijack",
    regex: /finja\s+(que\s+você\s+é|ser)\s+/i,
    severity: "medium",
  },

  // template_injection (marcadores de chat template ou role)
  {
    category: "template_injection",
    regex: /<\|(im_start|im_end|system|user|assistant|endoftext)\|>/i,
    severity: "critical",
  },
  {
    category: "template_injection",
    regex: /\[(?:INST|\/INST|SYSTEM|USER|ASSISTANT)\]/i,
    severity: "high",
  },
  {
    category: "template_injection",
    regex: /^\s*(system|assistant)\s*:\s*(you\s+are|now\s+you)/im,
    severity: "high",
  },

  // prompt_exfiltration
  {
    category: "prompt_exfiltration",
    regex: /(print|show|reveal|repeat|output)\s+(your|the|all|every)\s+(system\s+)?(prompt|instructions?|rules?|context)/i,
    severity: "high",
  },
  {
    category: "prompt_exfiltration",
    regex: /(mostre|imprima|revele|repita|liste)\s+(seu|as?)\s+(prompt|instru(ç|c)(ão|ões|oes)|regras?|contexto)/i,
    severity: "high",
  },
  {
    category: "prompt_exfiltration",
    regex: /repeat\s+(everything|the\s+text|all\s+the\s+text)\s+(above|before)/i,
    severity: "medium",
  },

  // tutela_reveal — específico do produto: tentativa de fazer o LLM
  // expor os originais tarjados. Falha grave se acontecer.
  {
    category: "tutela_reveal",
    regex: /(reveal|show|output|print|list)\s+(the\s+)?(original|un-?tarjad|un-?mask|un-?anon|actual)\s+(names?|values?|entit|texts?|cpfs?)/i,
    severity: "critical",
  },
  {
    category: "tutela_reveal",
    regex: /(revele|mostre|imprima|liste|exiba)\s+(os?\s+)?(nomes?|valores?|dados?|cpfs?|originais?|originai)\s+(reais?|verdadeiros?|sem\s+tarjas?|sem\s+anonimiza|originais?)/i,
    severity: "critical",
  },
  {
    category: "tutela_reveal",
    regex: /(desanoniminiz|desmasqu|destarj|remova\s+as\s+tarjas?|remover\s+tarja)/i,
    severity: "critical",
  },
  {
    category: "tutela_reveal",
    regex: /(entity[_\s-]?map|token[_\s-]?map|reveal[_\s-]?map)/i,
    severity: "high",
  },

  // jailbreak_signal — sinalizadores conhecidos
  {
    category: "jailbreak_signal",
    regex: /\b(DAN\s+mode|do\s+anything\s+now|AIM\s+mode|developer\s+mode|jailbreak\s+mode)\b/i,
    severity: "high",
  },
  {
    category: "jailbreak_signal",
    regex: /(modo\s+desenvolvedor|modo\s+irrestrito|sem\s+nenhuma\s+restri|sem\s+filtros?\s+éticos?)/i,
    severity: "high",
  },
];

export function scanForInjection(text: string): InjectionMatch[] {
  const matches: InjectionMatch[] = [];
  for (const p of PATTERNS) {
    // Força flag `g` — sem ela, exec() ignora lastIndex e o while vira loop
    // infinito. Também `d` (indices) para consistência, mas não é obrigatório.
    const flags = p.regex.flags.includes("g") ? p.regex.flags : p.regex.flags + "g";
    const regex = new RegExp(p.regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        category: p.category,
        match: m[0],
        severity: p.severity,
        position: { start: m.index, end: m.index + m[0].length },
      });
      // Guarda contra match de comprimento zero
      if (m.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }
  return matches.sort((a, b) => a.position.start - b.position.start);
}

export interface InjectionSummary {
  totalCount: number;
  byCategory: Record<InjectionCategory, number>;
  severity: InjectionSeverity;
  /** Sample truncado dos primeiros 3 matches — útil para painel do sócio ver
   * o que aconteceu sem precisar acessar o conteúdo original. */
  samples: Array<{ category: InjectionCategory; snippet: string }>;
}

export function summarizeInjection(matches: InjectionMatch[]): InjectionSummary {
  const byCategory = {} as Record<InjectionCategory, number>;
  for (const m of matches) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }
  const order: InjectionSeverity[] = ["low", "medium", "high", "critical"];
  const worst = matches.reduce<InjectionSeverity>(
    (acc, m) => (order.indexOf(m.severity) > order.indexOf(acc) ? m.severity : acc),
    "low",
  );
  return {
    totalCount: matches.length,
    byCategory,
    severity: matches.length > 0 ? worst : "low",
    samples: matches.slice(0, 3).map((m) => ({
      category: m.category,
      snippet: m.match.length > 80 ? m.match.slice(0, 77) + "..." : m.match,
    })),
  };
}
