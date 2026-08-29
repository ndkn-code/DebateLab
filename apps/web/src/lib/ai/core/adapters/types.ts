import type {
  AiExecutionContext,
  AiFailureKind,
  AiPromptMessage,
  AiProvider,
  AiUsage,
} from "../contracts";

export interface AdapterRequest {
  provider: AiProvider;
  model: string;
  messages: AiPromptMessage[];
  temperature: number;
  maxOutputTokens: number;
  responseFormat: "json" | "text";
  signal: AbortSignal;
  context: AiExecutionContext;
  phase: "primary" | "schema_repair";
}

export interface AdapterResponse {
  text: string;
  usage: AiUsage;
  finishReason?: string | null;
  responseStatus?: number | null;
}

export interface AdapterFailure extends Error {
  kind?: AiFailureKind;
  retryAfterMs?: number;
}
