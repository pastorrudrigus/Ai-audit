import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { attachments } from "@aigate/db";
import { eq } from "drizzle-orm";
import {
  extractText,
  guessMimeFromFilename,
  isSupportedMime,
  SUPPORTED_MIMES,
} from "@/lib/extract";
import { buildKey, getBucket, isStorageConfigured, putObject } from "@/lib/storage";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

// Limites do MVP. Ajustável por env sem redeploy do código.
const MAX_FILE_BYTES = parseInt(process.env.ATTACHMENT_MAX_BYTES ?? String(10 * 1024 * 1024), 10);
const MAX_EXTRACTED_CHARS = parseInt(process.env.ATTACHMENT_MAX_CHARS ?? "200000", 10);

async function assertConversation(orgId: string, conversationId: string) {
  const conv = await db.query.conversations.findFirst({
    where: (c, { eq, and }) => and(eq(c.id, conversationId), eq(c.orgId, orgId)),
  });
  return conv ?? null;
}

/**
 * GET — lista anexos da conversa. Retorna metadados só (sem `extractedText`,
 * que é sensível e só o servidor precisa). O parâmetro `?pending=1` filtra
 * apenas os ainda não linkados a uma message (para renderizar chips acima do
 * input antes do envio).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const conv = await assertConversation(orgId, params.conversationId);
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const pendingOnly = req.nextUrl.searchParams.get("pending") === "1";

  const rows = await db.query.attachments.findMany({
    where: (a, { eq, and, isNull: dIsNull }) => {
      const base = and(eq(a.orgId, orgId), eq(a.conversationId, params.conversationId));
      return pendingOnly ? and(base, dIsNull(a.messageId)) : base;
    },
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  });

  return NextResponse.json({
    attachments: rows.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      charCount: a.charCount,
      pageCount: a.pageCount,
      status: a.status,
      messageId: a.messageId,
      errorMessage: a.errorMessage,
      hasOriginal: Boolean(a.storageKey),
      createdAt: a.createdAt,
    })),
  });
}

/**
 * POST — recebe um arquivo (multipart/form-data, campo `file`) e extrai texto.
 * Volta com o id do attachment, pronto para o cliente juntar em `attachmentIds`
 * no próximo POST /api/chat.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const conv = await assertConversation(orgId, params.conversationId);
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const user = await db.query.users.findFirst({
    where: (u, { eq, and }) => and(eq(u.orgId, orgId), eq(u.clerkId, clerkId)),
  });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Field 'file' is required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo excede o limite de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB` },
      { status: 413 },
    );
  }

  const rawMime = file.type || guessMimeFromFilename(file.name) || "";
  if (!isSupportedMime(rawMime)) {
    return NextResponse.json(
      {
        error: `Formato não suportado. Aceitos: ${SUPPORTED_MIMES.join(", ")}`,
        received: rawMime,
      },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extractedText = "";
  let charCount = 0;
  let pageCount: number | undefined;
  let status: "uploaded" | "failed" = "uploaded";
  let errorMessage: string | null = null;

  try {
    const result = await extractText(buffer, rawMime);
    extractedText = result.text;
    charCount = result.charCount;
    pageCount = result.pageCount;

    if (charCount === 0) {
      errorMessage = "Não foi possível extrair texto (PDF escaneado como imagem?)";
      status = "failed";
    } else if (charCount > MAX_EXTRACTED_CHARS) {
      // Não descarta — trunca e avisa. Melhor UX que rejeitar peça grande.
      extractedText = extractedText.slice(0, MAX_EXTRACTED_CHARS);
      charCount = extractedText.length;
      errorMessage = `Texto truncado em ${MAX_EXTRACTED_CHARS} caracteres`;
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message.slice(0, 500) : "Falha na extração";
  }

  const [row] = await db.insert(attachments).values({
    orgId,
    conversationId: params.conversationId,
    userId: user?.id ?? null,
    filename: file.name.slice(0, 255),
    mimeType: rawMime,
    sizeBytes: file.size,
    extractedText,
    charCount,
    pageCount,
    status,
    errorMessage,
  }).returning();

  // Sobe o binário original para R2 depois do insert (para ter attId na key).
  // Falha aqui não é fatal — o texto extraído já está persistido; o usuário só
  // perde a opção "baixar original". Anexo falhou-extração igualmente sobe:
  // deixar para o sócio auditar depois.
  let hasOriginal = false;
  if (isStorageConfigured()) {
    const key = buildKey(orgId, params.conversationId, row.id, row.filename);
    try {
      await putObject({
        key,
        body: buffer,
        contentType: rawMime,
        originalFilename: row.filename,
      });
      await db.update(attachments)
        .set({ storageBucket: getBucket(), storageKey: key })
        .where(eq(attachments.id, row.id));
      hasOriginal = true;
    } catch (err) {
      console.error("[attachments] R2 putObject failed:", err);
    }
  }

  return NextResponse.json({
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    charCount: row.charCount,
    pageCount: row.pageCount,
    hasOriginal,
    status: row.status,
    errorMessage: row.errorMessage,
  });
}
