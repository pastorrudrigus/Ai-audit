/**
 * Regressão dos anexos do advogado.
 *
 * Contrato: quando o texto extraído de um PDF/DOCX é injetado na mensagem via
 * composeContentWithAttachments, ele passa pela mesma DLP/tokenização que o
 * texto colado. Isso é o coração da promessa do Tutela: "envie o PDF que os
 * dados sensíveis dentro dele também são tarjados".
 */

import { describe, it, expect } from "vitest";
import { composeContentWithAttachments } from "../attachments";
import { scanForPII, tokenizePII, TokenAllocator, detokenize } from "../dlp";

describe("composeContentWithAttachments", () => {
  it("retorna o texto digitado quando não há anexos", () => {
    expect(composeContentWithAttachments("consulta", [])).toBe("consulta");
  });

  it("insere blocos [Anexo: ...] antes do texto digitado", () => {
    const out = composeContentWithAttachments("resuma o contrato", [
      { filename: "contrato.pdf", extractedText: "cláusula primeira..." },
    ]);
    expect(out).toContain("[Anexo: contrato.pdf]");
    expect(out).toContain("cláusula primeira...");
    expect(out).toContain("[/Anexo]");
    expect(out.endsWith("resuma o contrato")).toBe(true);
  });

  it("preserva a ordem de múltiplos anexos", () => {
    const out = composeContentWithAttachments("compare", [
      { filename: "a.pdf", extractedText: "AAA" },
      { filename: "b.pdf", extractedText: "BBB" },
    ]);
    expect(out.indexOf("a.pdf")).toBeLessThan(out.indexOf("b.pdf"));
  });
});

describe("DLP sobre conteúdo com anexos", () => {
  it("tarja CPF dentro do texto do anexo, não só do texto digitado", () => {
    const attText = "Cliente identificado pelo CPF 123.456.789-09 assina abaixo.";
    const composed = composeContentWithAttachments("analise o contrato anexo", [
      { filename: "contrato.pdf", extractedText: attText },
    ]);

    const alloc = new TokenAllocator();
    const matches = scanForPII(composed);
    const cpfMatch = matches.find((m) => m.type === "cpf");
    expect(cpfMatch, "regex de CPF precisa achar o CPF dentro do anexo").toBeDefined();

    const { maskedText } = tokenizePII(composed, matches, alloc);
    expect(maskedText).not.toContain("123.456.789-09");
    expect(maskedText).toMatch(/⟨CPF_\d+⟩/);

    // Round-trip: reveal recupera o valor original
    const restored = detokenize(maskedText, alloc.getEntityMap());
    expect(restored).toContain("123.456.789-09");
  });

  it("tarja número de processo CNJ dentro do anexo", () => {
    const attText = "Nos autos do processo 1234567-89.2020.8.26.0100, o autor pede...";
    const composed = composeContentWithAttachments("resuma esse processo", [
      { filename: "peticao.pdf", extractedText: attText },
    ]);

    const alloc = new TokenAllocator();
    const matches = scanForPII(composed);
    const proc = matches.find((m) => m.type === "processo_cnj");
    expect(proc, "regex de processo_cnj precisa casar dentro do anexo").toBeDefined();

    const { maskedText } = tokenizePII(composed, matches, alloc);
    expect(maskedText).not.toContain("1234567-89.2020.8.26.0100");
    expect(maskedText).toMatch(/⟨PROCESSO_\d+⟩/);
  });

  it("tokens são consistentes entre CPF do anexo e CPF do texto digitado", () => {
    // Mesmo CPF em dois lugares → mesmo token (dedup do TokenAllocator).
    const cpf = "111.222.333-96";
    const attText = `Documento assinado por titular do CPF ${cpf}.`;
    const composed = composeContentWithAttachments(
      `Confirme se o CPF ${cpf} é do mesmo titular.`,
      [{ filename: "declaracao.pdf", extractedText: attText }],
    );

    const alloc = new TokenAllocator();
    const matches = scanForPII(composed);
    const { maskedText } = tokenizePII(composed, matches, alloc);

    // Se dedup funcionou, só existe UM token distinto para o CPF.
    const distinctTokens = new Set(maskedText.match(/⟨CPF_\d+⟩/g) ?? []);
    expect(distinctTokens.size).toBe(1);
  });
});
