import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { conversations, messages, requestLogs, providers, users } from "@aigate/db";
import { runPipeline, AppError } from "@aigate/core";
import type { PipelineContext } from "@aigate/core";
import { eq } from "drizzle-orm";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const { conversationId, message, model = "gpt-4o-mini", systemPrompt } = body as {
    conversationId?: string;
    message: string;
    model?: string;
    systemPrompt?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: (u, { eq, and }) =>
      and(eq(u.orgId, orgId), eq(u.clerkId, clerkUserId)),
  });

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
    const [conv] = await db.insert(conversations).values({
      orgId,
      userId: user?.id ?? orgId,
      title,
    }).returning();
    convId = conv.id;
  }

  // Save user message
  await db.insert(messages).values({
    conversationId: convId,
    role: "user",
    content: message,
  });

  // Build messages array for pipeline
  const allMessages = await db.query.messages.findMany({
    where: (m, { eq }) => eq(m.conversationId, convId!),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  const requestMessages = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    ...allMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
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
  });

  if (!result.success) {
    return NextResponse.json({
      error: result.error?.message ?? "Error",
      status: result.status,
    }, { status: result.error?.status ?? 500 });
  }

  const assistantContent =
    result.response?.choices?.[0]?.message?.content ?? "";

  // Log request
  const [log] = await db.insert(requestLogs).values({
    orgId,
    userId: user?.id ?? null,
    source: "web_interface",
    providerType: provider?.providerType ?? "openai",
    modelId: model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.inputTokens + result.outputTokens,
    costUsd: result.costUsd.toFixed(6),
    latencyMs: result.latencyMs,
    status: result.status,
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
  });
}
