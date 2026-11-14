import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@smartstudy/shared';
import type { z } from 'zod';

/**
 * Token usage telemetry reported by LLM providers.
 */
export interface LlmTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Standardized result returned by all LLM drivers and the composite client.
 */
export interface LlmResult<T = string> {
  /** Raw text response from the model (or JSON string if JSON mode). */
  text: string;
  /** Parsed and Zod-validated data payload when generateJson is used. */
  data?: T;
  /** Token usage statistics. */
  usage: LlmTokenUsage;
  /** Specific model name used (e.g. 'gemini-2.5-flash', 'llama3.2'). */
  model: string;
  /** Provider identifier ('gemini', 'ollama', 'mock', etc.). */
  provider: string;
  /** Time taken by the provider to complete the request in milliseconds. */
  latencyMs: number;
}

/**
 * Options for text generation requests.
 */
export interface LlmTextOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Options for structured JSON generation requests.
 */
export interface LlmJsonOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Interface implemented by low-level LLM drivers (Gemini, Ollama, Mock).
 */
export interface LlmDriver {
  readonly providerName: string;
  generateText(options: LlmTextOptions): Promise<LlmResult<string>>;
  generateJsonRaw(
    options: Omit<LlmJsonOptions<unknown>, 'schema'>,
  ): Promise<LlmResult<string>>;
}

/**
 * Main application-level LLM client contract used across services.
 */
export interface LlmClient {
  generateText(options: LlmTextOptions): Promise<LlmResult<string>>;
  generateJson<T>(options: LlmJsonOptions<T>): Promise<LlmResult<T>>;
}

/**
 * Thrown when an LLM provider is down, timed out, unreachable, or quota-exhausted.
 */
export class LlmUnavailableException extends HttpException {
  constructor(
    message = 'AI provider is currently unavailable.',
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code: 'LLM_UNAVAILABLE' as ErrorCode,
        message,
        details,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Thrown when an LLM model produces invalid JSON or fails Zod schema validation after retry.
 */
export class LlmInvalidOutputException extends HttpException {
  constructor(
    message = 'AI model generated an invalid structured output.',
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code: 'LLM_INVALID_OUTPUT' as ErrorCode,
        message,
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
