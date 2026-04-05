export const DLP_PATTERNS = {
  cpf: {
    regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
    label: "CPF",
    severity: "high" as const,
  },
  cnpj: {
    regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
    label: "CNPJ",
    severity: "high" as const,
  },
  credit_card: {
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    label: "Cartão de crédito",
    severity: "critical" as const,
  },
  email: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: "Email",
    severity: "medium" as const,
  },
  phone_br: {
    regex: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g,
    label: "Telefone BR",
    severity: "medium" as const,
  },
  api_key: {
    regex: /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16})\b/g,
    label: "API Key/Secret",
    severity: "critical" as const,
  },
};

export interface DLPMatch {
  type: string;
  label: string;
  match: string;
  severity: "medium" | "high" | "critical";
  position: { start: number; end: number };
}

export function scanForPII(
  text: string,
  enabledPatterns: string[] = Object.keys(DLP_PATTERNS)
): DLPMatch[] {
  const matches: DLPMatch[] = [];

  for (const patternKey of enabledPatterns) {
    const pattern = DLP_PATTERNS[patternKey as keyof typeof DLP_PATTERNS];
    if (!pattern) continue;

    // Reset regex lastIndex
    const regex = new RegExp(pattern.regex.source, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: patternKey,
        label: pattern.label,
        match: match[0],
        severity: pattern.severity,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }
  }

  return matches;
}

export function maskPII(text: string, matches: DLPMatch[]): string {
  // Sort by position descending to preserve indices when replacing
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

export function scanMessages(
  messages: Array<{ role: string; content: string }>,
  enabledPatterns?: string[]
): { hasViolation: boolean; matches: DLPMatch[]; severity: string } {
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
