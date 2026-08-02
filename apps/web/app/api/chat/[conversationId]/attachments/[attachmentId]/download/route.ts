import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getSignedDownloadUrl, isStorageConfigured } from "@/lib/storage";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

/**
 * GET — devolve 302 para uma URL R2 assinada (5 min de validade). O arquivo
 * baixa direto do R2, sem passar pelo Vercel — economiza egress e serve rápido.
 *
 * Isolamento de tenant: a query casa attachmentId + orgId + conversationId.
 * Um login válido de outra banca não decifra este link mesmo se o URL vazasse
 * (a checagem acontece aqui, antes de assinar; a URL assinada só existe
 * porque o dono acessou a rota).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { conversationId: string; attachmentId: string } },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();

  const att = await db.query.attachments.findFirst({
    where: (a, { eq, and }) =>
      and(
        eq(a.id, params.attachmentId),
        eq(a.orgId, orgId),
        eq(a.conversationId, params.conversationId),
      ),
  });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!att.storageKey) {
    return NextResponse.json(
      { error: "Original não armazenado (R2 não configurado no upload deste anexo)" },
      { status: 404 },
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "R2 não configurado neste ambiente" },
      { status: 503 },
    );
  }

  try {
    const url = await getSignedDownloadUrl(att.storageKey, 300);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[download] getSignedDownloadUrl failed:", err);
    return NextResponse.json({ error: "Falha ao gerar URL de download" }, { status: 500 });
  }
}
