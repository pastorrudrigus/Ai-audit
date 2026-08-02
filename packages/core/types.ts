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
  status: "success" | "error" | "blocked_policy" | "blocked_budget" | "blocked_dlp" | "blocked_injection";
  blockedReason?: string;
  /** Contagens agregadas por tipo e severidade — SEM valores originais. */
  dlpFlags?: unknown;
  /**
   * Mapa de entidades cifrado com AES-256-GCM para desanonimização client-side.
   * Nunca contém dados em claro. Presente apenas quando a policy DLP roda em
   * modo "anonymize".
   */
  entityMapEncrypted?: string;
  /** Total de entidades tokenizadas — para exibição na UI ("N dados tarjados"). */
  anonymizedCount?: number;
}
