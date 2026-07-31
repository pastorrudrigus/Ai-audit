/**
 * POST /api/verify — verifica citações jurídicas em um texto.
 *
 * O Portal do Advogado chama esta rota quando o usuário clica em
 * "Verificar antes do protocolo". Aceita o texto (para extração via LLM) ou
 * uma lista de citações já extraídas.
 *
 * Grava um log em request_logs com metadata.kind = "citation_check" para o
 * painel do sócio conseguir contar quantas verificações foram feitas.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import {
  extractCitations,
  verifyCitations,
  createWebSearchSource,
  type Citation,
  type CitationSource,
} from "@aigate/verify";
import { db } from "@/lib/db";
import { requestLogs } from "@aigate/db";

const bodySchema = z.union([
  z.object({
    text: z.string().min(1),
    citations: z.undefined().optional(),
  }),
  z.object({
    text: z.string().optional(),
    citations: z
      .array(
        z.object({
          referencia: z.string().min(1),
          tipoCitacao: z.enum(["jurisprudencia", "legislacao"]),
          trecho: z.string().min(1),
        })
      )
      .min(1),
  }),
]);

let cachedRedis: Redis | undefined;
function getRedis(): Redis | undefined {
  if (cachedRedis) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

const sources: CitationSource[] = [createWebSearchSource()];

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = process.env.DEMO_ORG_ID ?? "";
  if (!orgId) return NextResponse.json({ error: "org not configured" }, { status: 500 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq, and }) => and(eq(u.orgId, orgId), eq(u.clerkId, clerkUserId)),
  });

  let citations: Citation[];
  if ("citations" in parse.data && parse.data.citations) {
    citations = parse.data.citations;
  } else if (parse.data.text) {
    citations = await extractCitations(parse.data.text);
  } else {
    return NextResponse.json({ error: "Provide 'text' or 'citations'" }, { status: 400 });
  }

  if (citations.length === 0) {
    return NextResponse.json({
      citations: [],
      summary: { total: 0, confirmada: 0, divergente: 0, nao_encontrada: 0, erro: 0 },
      latencyMs: 0,
    });
  }

  // Upstash Redis satisfaz o RedisLike do @aigate/verify — cast controlado.
  const redis = getRedis() as unknown as
    | import("@aigate/verify").RedisLike
    | undefined;
  const result = await verifyCitations(citations, { sources, redis });

  await db.insert(requestLogs).values({
    orgId,
    userId: user?.id ?? null,
    departmentId: user?.departmentId ?? null,
    source: "web_interface",
    providerType: "internal",
    modelId: "citation_check",
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: "0",
    latencyMs: result.latencyMs,
    status: "success",
    metadata: {
      kind: "citation_check",
      ...result.summary,
      fromCacheCount: result.citations.filter((c) => c.fromCache).length,
    },
  });

  return NextResponse.json(result);
}
