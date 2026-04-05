// Model pricing per million tokens
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
};

export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[modelId] ?? { input: 1.0, output: 3.0 };
  return (
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output
  );
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  estimatedOutputTokens = 500
): number {
  return calculateCost(modelId, inputTokens, estimatedOutputTokens);
}

// Rough token estimator (4 chars ≈ 1 token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4,
    0
  );
}
