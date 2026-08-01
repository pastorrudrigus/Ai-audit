import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { attachments, conversations, messages, requestLogs, providers, users } from "@aigate/db";
import { runPipeline, AppError, composeContentWithAttachments } from "@aigate/core";
import type { PipelineContext } from "@aigate/core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const {
    conversationId,
    message,
    model = "gpt-4o-mini",
    systemPrompt,
    attachmentIds = [],
  } = body as {
    conversationId?: string;
    message: string;
    model?: string;
    systemPrompt?: string;
    attachmentIds?: string[];
  };

  if (!message?.trim() && attachmentIds.length === 0) {
    return NextResponse.json({ error: "Message or attachments required" }, { status: 400 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: (u, { eq, and }) =>
      and(eq(u.orgId, orgId), eq(u.clerkId, clerkUserId)),
  });

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const title = (message || "Conversa com anexos").slice(0, 60) +
      ((message || "").length > 60 ? "..." : "");
    const [conv] = await db.insert(conversations).values({
      orgId,
      userId: user?.id ?? orgId,
      title,
    }).returning();
    convId = conv.id;
  }

  // Save user message (só o texto digitado — o anexo fica em attachments,
  // vinculado por messageId depois do insert)
  const [insertedUserMsg] = await db.insert(messages).values({
    conversationId: convId,
    role: "user",
    content: message ?? "",
  }).returning();

  // Vincula os anexos pendentes escolhidos ao novo message. WHERE amarra por
  // orgId + conversationId + status/pendente — impossível linkar anexo de
  // outra banca ou de outra conversa mesmo se o cliente mandar o id.
  if (attachmentIds.length > 0) {
    await db
      .update(attachments)
      .set({ messageId: insertedUserMsg.id, status: "attached" })
      .where(
        and(
          inArray(attachments.id, attachmentIds),
          eq(attachments.orgId, orgId),
          eq(attachments.conversationId, convId),
          isNull(attachments.messageId),
        ),
      );
  }

  // Build messages array for pipeline — juntando texto de anexos por message
  const allMessages = await db.query.messages.findMany({
    where: (m, { eq }) => eq(m.conversationId, convId!),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
    with: { attachments: true },
  });

  const requestMessages = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    ...allMessages.map((m) => {
      const usable = (m.attachments ?? []).filter((a) => a.status === "attached" && a.charCount > 0);
      const content = m.role === "user"
        ? composeContentWithAttachments(m.content, usable.map((a) => ({
            filename: a.filename,
            extractedText: a.extractedText,
          })))
        : m.content;
      return { role: m.role as "user" | "assistant", content };
    }),
  ];

  // Get provider
  const provider = await db.query.providers.findFirst({
    where: (p, { eq, and }) =>
      and(eq(p.orgId, orgId), eq(p.isActive, true)),
  });

  const ctx: PipelineContext = {
    requestId: crypto.randomUUID(),
    orgId,
    userId: user?.id,
    departmentId: user?.departmentId ?? undefined,
    source: "web_interface",
    request: { model, messages: requestMessages },
    resolvedProviderId: provider?.id,
    startTime: Date.now(),
  };

  const result = await runPipeline(ctx, {
    db,
    getProviderKey: async (providerId) => {
      const p = await db.query.providers.findFirst({
        where: (pr, { eq }) => eq(pr.id, providerId),
      });
      if (!p) throw new AppError("PROVIDER_NOT_FOUND", "Provider not found", 404);

      let apiKey = p.apiKeyEncrypted;
      if (apiKey.startsWith("enc:")) apiKey = apiKey.replace("enc:", "");

      return { apiKey, baseUrl: p.baseUrl ?? null, providerType: p.providerType };
    },
    forwardRequest: async (providerType, modelId, apiKey, baseUrl, req) => {
      // Use real provider in production; demo returns mock
      if (process.env.DEMO_MODE === "true") {
        const mockContent = `Esta é uma resposta demonstrativa para: "${req.messages[req.messages.length - 1]?.content?.slice(0, 80)}..."`;
        return {
          response: {
            id: `chatcmpl-demo-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelId,
            choices: [{ index: 0, message: { role: "assistant", content: mockContent }, finish_reason: "stop" }],
            usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
          },
          inputTokens: 50,
          outputTokens: 30,
        };
      }

      // Default to OpenAI-compatible
      const res = await fetch(`${baseUrl ?? "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...req, stream: false }),
      });
      const data = await res.json();
      return { response: data, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
    },
    // Cifra o entityMap com ENCRYPTION_KEY para viagem segura ao cliente.
    encryptEntityMap: (json) => encrypt(json),
  });

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message ?? "Error",
      status: result.status,
    }, { status: result.error?.status ?? 500 });
  }

  const assistantContent =
    result.response?.choices?.[0]?.message?.content ?? "";

  // Log request — grava contagens de anonimização SEM valores originais
  const [log] = await db.insert(requestLogs).values({
    orgId,
    userId: user?.id ?? null,
    departmentId: user?.departmentId ?? null,
    source: "web_interface",
    providerType: provider?.providerType ?? "openai",
    modelId: model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.inputTokens + result.outputTokens,
    costUsd: result.costUsd.toFixed(6),
    latencyMs: result.latencyMs,
    status: result.status,
    dlpFlags: (result.dlpFlags as object | undefined) ?? null,
  }).returning();

  // Save assistant message
  await db.insert(messages).values({
    conversationId: convId,
    requestLogId: log.id,
    role: "assistant",
    content: assistantContent,
  });

  return NextResponse.json({
    conversationId: convId,
    message: assistantContent,
    model,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd.toFixed(6),
    },
    latencyMs: result.latencyMs,
    tutela: {
      entity_map: result.entityMapEncrypted ?? null,
      anonymized_count: result.anonymizedCount ?? 0,
      dlp_flags: result.dlpFlags ?? null,
    },
  });
}
