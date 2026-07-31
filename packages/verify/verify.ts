/**
 * Orquestrador de verificação: recebe as citações extraídas, consulta o cache
 * Upstash, roda os conectores plugáveis para o que não estiver em cache e
 * devolve a lista verificada com um sumário agregado.
 *
 * Cache: TTL configurável (default 7 dias). Chave = hash SHA-256 da referência
 * normalizada + tipoCitacao. Citações repetem muito entre peças jurídicas
 * (a mesma súmula é citada centenas de vezes) — o cache paga por si.
 */

import { createHash } from "crypto";
import type {
  Citation,
  CitationCheckResult,
  CitationSource,
  CitationStatus,
  VerifiedCitation,
} from "./types";
import { normalizeCitationRef } from "./extract";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias
const CACHE_PREFIX = "tutela:cite:";

/** Interface mínima do Redis que usamos — casa com @upstash/redis. */
export interface RedisLike {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<unknown>;
}

export interface VerifyOptions {
  sources: CitationSource[];
  redis?: RedisLike;
  cacheTtlSeconds?: number;
  /** Número máximo de citações verificadas em paralelo. Default 5. */
  concurrency?: number;
}

function cacheKey(c: Citation): string {
  const norm = `${c.tipoCitacao}::${normalizeCitationRef(c.referencia)}`;
  const hash = createHash("sha256").update(norm).digest("hex").slice(0, 32);
  return `${CACHE_PREFIX}${hash}`;
}

interface CachedVerification {
  status: CitationStatus;
  observacao: string;
  fonte?: string;
  sourceName?: string;
}

async function getFromCache(
  redis: RedisLike | undefined,
  key: string
): Promise<CachedVerification | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    if (typeof raw === "string") return JSON.parse(raw) as CachedVerification;
    // @upstash/redis já desserializa JSON em alguns modos
    return raw as CachedVerification;
  } catch {
    return null;
  }
}

async function setCache(
  redis: RedisLike | undefined,
  key: string,
  value: CachedVerification,
  ttl: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl });
  } catch {
    /* cache indisponível não deve derrubar a verificação */
  }
}

/**
 * Roda `tasks` em lotes de `concurrency`. Simples, sem dependência adicional.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Verifica uma única citação usando o primeiro source que suporta o tipo dela.
 */
export async function verifyCitation(
  citation: Citation,
  options: VerifyOptions
): Promise<VerifiedCitation> {
  const ttl = options.cacheTtlSeconds ?? CACHE_TTL_SECONDS;
  const key = cacheKey(citation);

  const cached = await getFromCache(options.redis, key);
  if (cached) {
    return {
      ...citation,
      status: cached.status,
      observacao: cached.observacao,
      fonte: cached.fonte,
      fromCache: true,
    };
  }

  const source = options.sources.find((s) => s.supports.includes(citation.tipoCitacao));
  if (!source) {
    return {
      ...citation,
      status: "erro",
      observacao: `Sem conector para tipo '${citation.tipoCitacao}'.`,
    };
  }

  const verification = await source.verify(citation);

  // Não cacheia erros (podem ser transitórios — provider fora do ar, timeout)
  if (verification.status !== "erro") {
    await setCache(
      options.redis,
      key,
      {
        status: verification.status,
        observacao: verification.observacao,
        fonte: verification.fonte,
        sourceName: source.name,
      },
      ttl
    );
  }

  return {
    ...citation,
    ...verification,
    fromCache: false,
  };
}

/**
 * Verifica em paralelo todas as citações de um texto extraídas previamente.
 */
export async function verifyCitations(
  citations: Citation[],
  options: VerifyOptions
): Promise<CitationCheckResult> {
  const started = Date.now();
  const concurrency = options.concurrency ?? 5;

  const verifications = await runWithConcurrency(
    citations.map((c) => () => verifyCitation(c, options)),
    concurrency
  );

  const summary = {
    total: verifications.length,
    confirmada: verifications.filter((v) => v.status === "confirmada").length,
    divergente: verifications.filter((v) => v.status === "divergente").length,
    nao_encontrada: verifications.filter((v) => v.status === "nao_encontrada").length,
    erro: verifications.filter((v) => v.status === "erro").length,
  };

  return {
    citations: verifications,
    latencyMs: Date.now() - started,
    summary,
  };
}
