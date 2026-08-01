/**
 * Extração de texto de anexos do advogado.
 *
 * Suporta PDF (texto nativo — não faz OCR), DOCX e TXT/Markdown. O texto
 * volta cru; a tokenização (CPF, nomes, número de processo) acontece depois,
 * quando o texto entra no pipeline via /api/chat.
 *
 * PDFs escaneados como imagem retornam texto vazio ou muito curto — cabe ao
 * chamador decidir (avisar o usuário, rejeitar). Não fazemos OCR aqui porque
 * OCR de terceiros implicaria dado saindo antes das tarjas.
 */

export interface ExtractedText {
  text: string;
  charCount: number;
  pageCount?: number;
}

export type SupportedMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown";

export const SUPPORTED_MIMES: readonly SupportedMime[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

export function isSupportedMime(mime: string): mime is SupportedMime {
  return (SUPPORTED_MIMES as readonly string[]).includes(mime);
}

/** Fallback simples por extensão quando o MIME vem vazio (Safari, curl). */
export function guessMimeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  return null;
}

export async function extractText(
  buffer: Buffer,
  mimeType: SupportedMime,
): Promise<ExtractedText> {
  if (mimeType === "application/pdf") {
    // pdf-parse é CJS; require dinâmico evita que o Next tente pré-empacotar
    // o arquivo de "test" que ele importa no top-level.
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string; numpages: number }>;
    const parsed = await pdfParse(buffer);
    const text = normalize(parsed.text);
    return { text, charCount: text.length, pageCount: parsed.numpages };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    const text = normalize(value);
    return { text, charCount: text.length };
  }

  // text/plain e text/markdown
  const text = normalize(buffer.toString("utf-8"));
  return { text, charCount: text.length };
}

function normalize(raw: string): string {
  // Colapsa múltiplas linhas em branco e trims. Mantém quebras — o pipeline
  // não depende de estrutura, mas o LLM lê melhor sem entulho.
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
