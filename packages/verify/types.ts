/**
 * Tipos compartilhados do módulo de verificação de citações.
 */

export type TipoCitacao = "jurisprudencia" | "legislacao";

export type CitationStatus = "confirmada" | "divergente" | "nao_encontrada" | "erro";

export interface Citation {
  /** Referência canônica citada (ex.: "REsp 1.234.567/SP", "art. 5º, LV, CF/88"). */
  referencia: string;
  tipoCitacao: TipoCitacao;
  /** Trecho da resposta original onde a citação apareceu — dá contexto ao advogado. */
  trecho: string;
}

export interface VerifiedCitation extends Citation {
  status: CitationStatus;
  observacao: string;
  /** URL ou identificador da fonte usada para confirmar. */
  fonte?: string;
  /** Se veio do cache Redis (útil para debug e métricas de latência). */
  fromCache?: boolean;
}

export interface CitationCheckResult {
  citations: VerifiedCitation[];
  latencyMs: number;
  /**
   * Contagem por status — usado em request_logs.metadata sem expor os textos
   * das citações (podem ser sensíveis dependendo do documento).
   */
  summary: {
    total: number;
    confirmada: number;
    divergente: number;
    nao_encontrada: number;
    erro: number;
  };
}

/**
 * Interface plugável para conectores de verificação. v1 usa apenas o conector
 * de busca web; v2 poderá plugar DataJud, STJ etc. sem tocar no orquestrador.
 */
export interface CitationSource {
  /** Nome curto do conector, exibido na `fonte` quando ele confirma a citação. */
  readonly name: string;
  /** Quais tipos este conector sabe verificar. */
  readonly supports: TipoCitacao[];
  verify(citation: Citation): Promise<Omit<VerifiedCitation, "referencia" | "tipoCitacao" | "trecho">>;
}
