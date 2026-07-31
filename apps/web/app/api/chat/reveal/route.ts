/**
 * POST /api/chat/reveal — desanonimiza um texto usando um entity_map cifrado.
 *
 * O entity_map viaja cifrado (AES-256-GCM) do gateway para o cliente. Para
 * exibir a versão original de uma tarja, o cliente reenvia o entity_map E o
 * texto ao servidor, que decifra o mapa em memória e substitui os tokens
 * pelos valores originais. O ENCRYPTION_KEY nunca sai do servidor.
 *
 * O chamador precisa estar autenticado no Clerk — sem sessão, 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { detokenize, type EntityMapping } from "@aigate/core";
import { decrypt } from "@/lib/encryption";

const bodySchema = z.object({
  text: z.string(),
  entityMap: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let mapping: EntityMapping[];
  try {
    const json = decrypt(parse.data.entityMap);
    mapping = JSON.parse(json) as EntityMapping[];
  } catch {
    // entity_map inválido ou cifrado com outra chave → não vaza detalhe do erro
    return NextResponse.json({ error: "Invalid entity map" }, { status: 400 });
  }

  const revealed = detokenize(parse.data.text, mapping);
  return NextResponse.json({ text: revealed });
}
