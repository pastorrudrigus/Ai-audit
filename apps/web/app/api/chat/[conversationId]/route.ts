import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conv = await db.query.conversations.findFirst({
    where: (c, { eq }) => eq(c.id, params.conversationId),
  });

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const msgs = await db.query.messages.findMany({
    where: (m, { eq }) => eq(m.conversationId, params.conversationId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
    with: { requestLog: true, attachments: true },
  });

  const messages = msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    requestLogId: m.requestLogId,
    // Metadados apenas — extractedText não sai daqui (só o servidor precisa).
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      charCount: a.charCount,
      pageCount: a.pageCount,
      status: a.status,
      hasOriginal: Boolean(a.storageKey),
    })),
    usage: m.requestLog
      ? {
          inputTokens: m.requestLog.inputTokens,
          outputTokens: m.requestLog.outputTokens,
          costUsd: m.requestLog.costUsd,
          model: m.requestLog.modelId,
        }
      : undefined,
  }));

  return NextResponse.json({ conversation: conv, messages });
}
