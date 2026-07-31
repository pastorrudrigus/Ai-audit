/**
 * POST /api/chat/reveal-map — devolve o mapa token → valor original.
 *
 * Usado pela UI do Portal do Advogado para trocar as tarjas ⟨TIPO_N⟩ pelo
 * texto real inline (hover/toggle), sem precisar processar diff de strings
 * no browser. ENCRYPTION_KEY nunca sai do servidor.
 *
 * Assim como o /reveal, verifica tenant do envelope contra a sessão.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { EntityMapEnvelope, EntityMapping } from "@aigate/core";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

const bodySchema = z.object({
  entityMap: z.string().min(1),
});

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

  if (!envelope.legacy) {
    const sessionOrgId = process.env.DEMO_ORG_ID ?? "";
    if (!sessionOrgId || envelope.orgId !== sessionOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

  return NextResponse.json({
    entries: envelope.entities.map((m) => ({
      token: m.token,
      original: m.original,
      type: m.type,
    })),
    legacy: envelope.legacy || undefined,
  });
}
