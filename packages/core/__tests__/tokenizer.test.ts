/**
 * Regressão do bug de colisão de tokens entre mensagens.
 *
 * O tokenizePII original mantinha o contador de tokens dentro do escopo da
 * função — cada chamada zerava. Chamado por mensagem, produzia ⟨PESSOA_1⟩
 * para "João" na mensagem A e ⟨PESSOA_1⟩ para "Maria" na mensagem B; o
 * dedup por token no pipeline então descartava um dos dois e a restauração
 * devolvia o nome errado.
 *
 * O fix é o TokenAllocator compartilhado entre chamadas.
 */

import { describe, it, expect } from "vitest";
import {
  tokenizePII,
  detokenize,
  TokenAllocator,
  type DLPMatch,
} from "../dlp";

function pessoa(match: string, start: number): DLPMatch {
  return {
    type: "PESSOA",
    label: "PESSOA",
    match,
    severity: "high",
    position: { start, end: start + match.length },
    source: "ner",
  };
}

describe("TokenAllocator — consistência entre mensagens", () => {
  it("aloca tokens distintos para pessoas diferentes em mensagens distintas", () => {
    const alloc = new TokenAllocator();

    const msg1 = "Analise o caso do autor João da Silva.";
    const msg2 = "Redija a réplica para Maria de Souza, réu.";

    const t1 = tokenizePII(msg1, [pessoa("João da Silva", msg1.indexOf("João"))], alloc);
    const t2 = tokenizePII(msg2, [pessoa("Maria de Souza", msg2.indexOf("Maria"))], alloc);

    // Cada pessoa recebeu um token diferente
    const map = alloc.getEntityMap();
    const tokens = map.map((e) => e.token);
    expect(new Set(tokens).size).toBe(2);
    expect(t1.maskedText).toContain("⟨PESSOA_1⟩");
    expect(t2.maskedText).toContain("⟨PESSOA_2⟩");

    // A restauração devolve cada nome no lugar certo
    expect(detokenize(t1.maskedText, map)).toBe(msg1);
    expect(detokenize(t2.maskedText, map)).toBe(msg2);
  });

  it("reusa o mesmo token quando o mesmo valor aparece em duas mensagens", () => {
    const alloc = new TokenAllocator();
    const msg1 = "O autor João da Silva alega...";
    const msg2 = "Concluímos que João da Silva tem razão.";

    const t1 = tokenizePII(msg1, [pessoa("João da Silva", msg1.indexOf("João"))], alloc);
    const t2 = tokenizePII(msg2, [pessoa("João da Silva", msg2.indexOf("João"))], alloc);

    expect(alloc.getEntityMap()).toHaveLength(1);
    expect(t1.maskedText).toContain("⟨PESSOA_1⟩");
    expect(t2.maskedText).toContain("⟨PESSOA_1⟩");
  });

  it("chamado sem alocador externo, mantém contador isolado (retrocompat)", () => {
    // Comportamento antigo — cada chamada isolada tem seu próprio contador.
    // Isso é útil para uso one-shot, mas é EXATAMENTE o que quebrava no
    // pipeline multi-mensagem; por isso o pipeline agora passa um alocador.
    const msg1 = "João da Silva.";
    const msg2 = "Maria de Souza.";
    const t1 = tokenizePII(msg1, [pessoa("João da Silva", 0)]);
    const t2 = tokenizePII(msg2, [pessoa("Maria de Souza", 0)]);
    expect(t1.maskedText).toContain("⟨PESSOA_1⟩");
    expect(t2.maskedText).toContain("⟨PESSOA_1⟩"); // contador reseta — comportamento esperado quando NÃO se passa alocador
  });
});

describe("tokenizePII — spans sobrepostos", () => {
  it("mantém o match mais longo quando dois padrões pegam trechos que se cruzam", () => {
    const alloc = new TokenAllocator();
    const text = "Doc 12345678900 emitido em 2024";
    // dois padrões hipotéticos sobrepostos: o mais longo cobre '12345678900',
    // o mais curto cobre '12345678' (parte do primeiro)
    const longer: DLPMatch = {
      type: "cpf",
      label: "CPF",
      match: "12345678900",
      severity: "high",
      position: { start: 4, end: 15 },
      source: "regex",
    };
    const shorter: DLPMatch = {
      type: "processo_cnj",
      label: "Nº de processo (CNJ)",
      match: "12345678",
      severity: "high",
      position: { start: 4, end: 12 },
      source: "regex",
    };
    const { maskedText, entityMap } = tokenizePII(text, [shorter, longer], alloc);
    // O texto resultante deve conter apenas 1 tarja, não corromper com dois substrings
    const tarjas = (maskedText.match(/⟨[A-Z_]+_\d+⟩/g) ?? []).length;
    expect(tarjas).toBe(1);
    // E o valor tarjado deve ser o do match mais longo (CPF)
    expect(entityMap.some((e) => e.original === "12345678900")).toBe(true);
    // Restaurando, o texto volta ao original
    expect(detokenize(maskedText, entityMap)).toBe(text);
  });
});
