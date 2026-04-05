export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface PipelineContext {
  requestId: string;
  orgId: string;
  userId?: string;
  apiKeyId?: string;
  departmentId?: string;
  projectId?: string;
  source: "gateway" | "web_interface";
  request: ChatCompletionRequest;
  resolvedProviderId?: string;
  resolvedProviderType?: string;
  resolvedModelId?: string;
  estimatedCost?: number;
  startTime: number;
}

export interface PipelineResult {
  success: boolean;
  response?: ChatCompletionResponse;
  error?: AppError;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "success" | "error" | "blocked_policy" | "blocked_budget" | "blocked_dlp";
  blockedReason?: string;
  dlpFlags?: unknown;
}
