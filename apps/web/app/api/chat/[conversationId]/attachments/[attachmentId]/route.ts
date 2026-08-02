import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { attachments } from "@aigate/db";
import { and, eq, isNull } from "drizzle-orm";
import { deleteObject } from "@/lib/storage";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

/**
 * DELETE — remove um anexo pendente (ainda não linkado a message). Anexos já
 * enviados (status='attached') não podem ser removidos por aqui: fazem parte
 * do histórico e do log de auditoria.
 */
export async function DELETE(
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

  if (att.messageId) {
    return NextResponse.json(
      { error: "Anexo já enviado — faz parte do histórico e não pode ser removido" },
      { status: 409 },
    );
  }

  await db.delete(attachments).where(
    and(
      eq(attachments.id, params.attachmentId),
      eq(attachments.orgId, orgId),
      isNull(attachments.messageId),
    ),
  );

  // Best-effort — se falhar aqui o objeto vira lixo no bucket mas o registro
  // do banco já foi. Prefiro isso a um DELETE que só finaliza se R2 responder.
  if (att.storageKey) {
    try {
      await deleteObject(att.storageKey);
    } catch (err) {
      console.error("[attachments] R2 deleteObject failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
