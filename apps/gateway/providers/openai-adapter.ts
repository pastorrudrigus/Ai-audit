import type { ChatCompletionRequest, ChatCompletionResponse } from "@aigate/core";

export async function forwardToOpenAI(
  modelId: string,
  apiKey: string,
  baseUrl: string | null,
  request: ChatCompletionRequest
): Promise<{ response: ChatCompletionResponse; inputTokens: number; outputTokens: number }> {
  const url = `${baseUrl ?? "https://api.openai.com"}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...request, stream: false }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${error}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  return {
    response: data,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
