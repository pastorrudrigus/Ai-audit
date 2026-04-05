import type { ChatCompletionRequest, ChatCompletionResponse, OpenAIMessage } from "@aigate/core";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
}

interface AnthropicResponse {
  id: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

function toAnthropicMessages(messages: OpenAIMessage[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  const system = messages.find((m) => m.role === "system")?.content;
  const filtered = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  return { system, messages: filtered };
}

function fromAnthropicResponse(
  data: AnthropicResponse,
  originalModel: string
): ChatCompletionResponse {
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  return {
    id: data.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: originalModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: data.stop_reason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}

export async function forwardToAnthropic(
  modelId: string,
  apiKey: string,
  baseUrl: string | null,
  request: ChatCompletionRequest
): Promise<{ response: ChatCompletionResponse; inputTokens: number; outputTokens: number }> {
  const url = `${baseUrl ?? "https://api.anthropic.com"}/v1/messages`;
  const { system, messages } = toAnthropicMessages(request.messages);

  const body: AnthropicRequest = {
    model: modelId,
    max_tokens: request.max_tokens ?? 4096,
    messages,
    ...(system ? { system } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${error}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const response = fromAnthropicResponse(data, modelId);

  return {
    response,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
}
