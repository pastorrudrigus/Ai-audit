/**
 * Junta o texto de anexos (extraído do PDF/DOCX/TXT) com o texto que o
 * advogado digitou, produzindo o `content` que o pipeline vai tokenizar e
 * enviar ao LLM.
 *
 * Formato:
 *   [Anexo: contrato.pdf]
 *   <texto extraído raw>
 *   [/Anexo]
 *
 *   [Anexo: peticao.docx]
 *   <texto extraído raw>
 *   [/Anexo]
 *
 *   <texto digitado>
 *
 * Deliberadamente o texto do anexo entra CRU — sem tokenização prévia. O
 * TokenAllocator do pipeline é per-request, e tokenizar o anexo em separado
 * causaria colisão de tokens ⟨PESSOA_N⟩ com o resto da mensagem. Deixando o
 * DLP correr por cima do conteúdo composto, todos os nomes/CPF/CNPJ (venham
 * do anexo ou do texto digitado) recebem tokens únicos e consistentes.
 */
export interface AttachmentForPrompt {
  filename: string;
  extractedText: string;
}

export function composeContentWithAttachments(
  typedContent: string,
  attachments: AttachmentForPrompt[],
): string {
  if (attachments.length === 0) return typedContent;
  const blocks = attachments.map(
    (a) => `[Anexo: ${a.filename}]\n${a.extractedText}\n[/Anexo]`,
  );
  return `${blocks.join("\n\n")}\n\n${typedContent}`;
}
