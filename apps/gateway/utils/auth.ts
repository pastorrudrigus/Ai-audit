/**
 * Middleware de auth compartilhado entre as rotas do gateway.
 * Contrato idêntico ao de chat-completions: header Authorization: Bearer aig_sk_...
 * → resolve orgId/departmentId/projectId a partir da api_key ativa correspondente
 * ao SHA-256 da chave enviada.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import type { createDb } from "@aigate/db";
import { hashApiKey } from "./encryption";

export interface AuthedApiKey {
  id: string;
  orgId: string;
  departmentId: string | null;
  projectId: string | null;
}

/**
 * Extrai a chave do header, checa hash + isActive, e devolve a linha da api_key.
 * Responde 401 e devolve null quando algo falha — os callers só precisam
 * checar `if (!apiKey) return;`.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  db: ReturnType<typeof createDb>
): Promise<AuthedApiKey | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing API key" });
    return null;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = hashApiKey(rawKey);

  const apiKey = await db.query.apiKeys.findFirst({
    where: (k, { eq, and }) => and(eq(k.keyHash, keyHash), eq(k.isActive, true)),
  });

  if (!apiKey) {
    reply.status(401).send({ error: "Invalid API key" });
    return null;
  }

  return {
    id: apiKey.id,
    orgId: apiKey.orgId,
    departmentId: apiKey.departmentId,
    projectId: apiKey.projectId,
  };
}
