/**
 * POST /api/chat/reveal-map — devolve o mapa token → valor original.
 *
 * Usado pela UI do Portal do Advogado para trocar as tarjas ⟨TIPO_N⟩ pelo
 * texto real inline (hover/toggle), sem precisar processar diff de strings
 * no browser. ENCRYPTION_KEY nunca sai do servidor.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { EntityMapping } from "@aigate/core";
import { decrypt } from "@/lib/encryption";

const bodySchema = z.object({
  entityMap: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const json = decrypt(parse.data.entityMap);
    const mapping = JSON.parse(json) as EntityMapping[];
    return NextResponse.json({
      entries: mapping.map((m) => ({ token: m.token, original: m.original, type: m.type })),
    });
  } catch {
    return NextResponse.json({ error: "Invalid entity map" }, { status: 400 });
  }
}
