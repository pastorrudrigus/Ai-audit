/**
 * Prova que planilhas seguem o mesmo caminho de proteção do PDF/DOCX.
 *
 * A extração produz um bloco `[Aba: <nome>]\n<csv>` por planilha, e esse texto
 * entra no pipeline via composeContentWithAttachments. O que a gente precisa
 * garantir aqui é que CPF/CNPJ dentro de uma célula (formato natural de
 * planilha de custas / cadastro de clientes) recebe tarja igual a CPF dentro
 * de um parágrafo — senão o valor do XLSX seria zero para uma banca.
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { composeContentWithAttachments } from "../attachments";
import { scanForPII, tokenizePII, TokenAllocator } from "../dlp";

function buildWorkbookText(sheets: Array<{ name: string; rows: (string | number)[][] }>): string {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (csv) parts.push(`[Aba: ${name}]\n${csv}`);
  }
  return parts.join("\n\n");
}

describe("XLSX como anexo — DLP tarja PII dentro de células", () => {
  it("tarja CPF numa célula de planilha de clientes", () => {
    const extracted = buildWorkbookText([
      {
        name: "Clientes",
        rows: [
          ["Nome", "CPF", "Valor do contrato"],
          ["Titular A", "123.456.789-09", 50000],
          ["Titular B", "987.654.321-00", 12000],
        ],
      },
    ]);

    // Sanidade: o texto extraído contém as células brutas
    expect(extracted).toContain("[Aba: Clientes]");
    expect(extracted).toContain("123.456.789-09");

    const composed = composeContentWithAttachments("resuma os contratos", [
      { filename: "clientes.xlsx", extractedText: extracted },
    ]);

    const alloc = new TokenAllocator();
    const matches = scanForPII(composed);
    const cpfs = matches.filter((m) => m.type === "cpf");
    expect(cpfs.length, "regex de CPF acha os dois CPFs da planilha").toBe(2);

    const { maskedText } = tokenizePII(composed, matches, alloc);
    expect(maskedText).not.toContain("123.456.789-09");
    expect(maskedText).not.toContain("987.654.321-00");
    expect(maskedText).toMatch(/⟨CPF_1⟩/);
    expect(maskedText).toMatch(/⟨CPF_2⟩/);
  });

  it("preserva o nome da aba como header — LLM sabe qual planilha lê", () => {
    const extracted = buildWorkbookText([
      { name: "Custas", rows: [["Processo", "Valor"], ["0001", 1500]] },
      { name: "Honorários", rows: [["Advogado", "Valor"], ["Dra X", 8000]] },
    ]);
    expect(extracted).toContain("[Aba: Custas]");
    expect(extracted).toContain("[Aba: Honorários]");
    // Ordem preservada
    expect(extracted.indexOf("[Aba: Custas]")).toBeLessThan(extracted.indexOf("[Aba: Honorários]"));
  });

  it("CNPJ em célula também vira tarja", () => {
    const extracted = buildWorkbookText([
      {
        name: "Fornecedores",
        rows: [
          ["Razão social", "CNPJ"],
          ["Empresa X", "11.222.333/0001-81"],
        ],
      },
    ]);
    const composed = composeContentWithAttachments("audite os fornecedores", [
      { filename: "fornecedores.xlsx", extractedText: extracted },
    ]);
    const alloc = new TokenAllocator();
    const { maskedText } = tokenizePII(composed, scanForPII(composed), alloc);
    expect(maskedText).not.toContain("11.222.333/0001-81");
    expect(maskedText).toMatch(/⟨CNPJ_\d+⟩/);
  });
});
