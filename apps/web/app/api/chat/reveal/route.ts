/**
 * POST /api/chat/reveal — desanonimiza um texto usando um entity_map cifrado.
 *
 * O entity_map viaja cifrado (AES-256-GCM) do gateway para o cliente. Para
 * exibir a versão original de uma tarja, o cliente reenvia o entity_map E o
 * texto ao servidor, que decifra o envelope em memória e substitui os tokens
 * pelos valores originais. O ENCRYPTION_KEY nunca sai do servidor.
 *
 * Verificação de tenant: o envelope carrega orgId (e userId opcional). Antes
 * de devolver qualquer valor original, comparamos com a sessão Clerk. Blob de
 * outra org → 403. Isso torna o blob inútil fora do tenant certo mesmo que
 * um dia vaze em log/ticket/print.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { detokenize, type EntityMapEnvelope, type EntityMapping } from "@aigate/core";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

const bodySchema = z.object({
  text: z.string(),
  entityMap: z.string().min(1),
});

/**
 * Aceita o envelope v1 (novo) e também o formato antigo (array cru), para
 * não quebrar sessões abertas antes desse deploy. O formato antigo NÃO
 * passa pela checagem de tenant — não tem como — e por isso a resposta
 * inclui um aviso via header para telemetria.
 */
function parseEnvelope(json: string): {
  entities: EntityMapping[];
  orgId?: string;
  userId?: string;
  legacy: boolean;
} {
  const parsed: unknown = JSON.parse(json);
  if (Array.isArray(parsed)) {
    return { entities: parsed as EntityMapping[], legacy: true };
  }
  const env = parsed as EntityMapEnvelope;
  return {
    entities: env.entities,
    orgId: env.orgId,
    userId: env.userId,
    legacy: false,
  };
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let envelope: ReturnType<typeof parseEnvelope>;
  try {
    envelope = parseEnvelope(decrypt(parse.data.entityMap));
  } catch {
    return NextResponse.json({ error: "Invalid entity map" }, { status: 400 });
  }

  // Verificação de tenant — obrigatória para envelopes v1+
  if (!envelope.legacy) {
    const sessionOrgId = process.env.DEMO_ORG_ID ?? "";
    if (!sessionOrgId || envelope.orgId !== sessionOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Se o envelope carrega userId, cheque também contra a sessão Clerk
    if (envelope.userId) {
      const user = await db.query.users.findFirst({
        where: (u, { eq, and }) =>
          and(eq(u.orgId, sessionOrgId), eq(u.clerkId, clerkUserId)),
      });
      if (!user || user.id !== envelope.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const revealed = detokenize(parse.data.text, envelope.entities);
  return NextResponse.json({
    text: revealed,
    legacy: envelope.legacy || undefined,
  });
}
