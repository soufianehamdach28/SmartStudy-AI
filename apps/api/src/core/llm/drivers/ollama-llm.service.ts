import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import {
  type LlmDriver,
  type LlmResult,
  type LlmTextOptions,
  type LlmTokenUsage,
  LlmUnavailableException,
} from '../llm.interface.js';

interface OpenAiChatMessage {
  content?: string;
  role?: string;
}

interface OpenAiChatChoice {
  message?: OpenAiChatMessage;
}

interface OpenAiChatResponse {
  choices?: OpenAiChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
  };
}

interface NativeOllamaChatResponse {
  message?: {
    content?: string;
    role?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

@Injectable()
export class OllamaLlmService implements LlmDriver {
  readonly providerName = 'ollama';
  private readonly logger = new Logger(OllamaLlmService.name);

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async generateText(options: LlmTextOptions): Promise<LlmResult<string>> {
    return this.callOllama(options, false);
  }

  async generateJsonRaw(options: LlmTextOptions): Promise<LlmResult<string>> {
    return this.callOllama(options, true);
  }

  private async callOllama(
    options: LlmTextOptions,
    isJson: boolean,
  ): Promise<LlmResult<string>> {
    const rawBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434/v1';
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const model =
      this.configService.get<string>('OLLAMA_MODEL') || 'llama3.2';
    const timeoutMs =
      this.configService.get<number>('LLM_TIMEOUT_MS') || 30_000;

    const isOpenAiMode = baseUrl.endsWith('/v1');
    const endpoint = isOpenAiMode
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/api/chat`;

    const messages = [];
    if (options.system && options.system.trim() !== '') {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: options.prompt });

    const temperature = options.temperature ?? (isJson ? 0.1 : 0.2);

    const body: Record<string, unknown> = isOpenAiMode
      ? {
          model,
          messages,
          temperature,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }
      : {
          model,
          messages,
          stream: false,
          options: {
            temperature,
            ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
          },
          ...(isJson ? { format: 'json' } : {}),
        };

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new LlmUnavailableException(
          `Ollama request timed out after ${timeoutMs}ms`,
          { provider: this.providerName, model, timeoutMs },
        );
      }
      throw new LlmUnavailableException(
        `Failed to reach Ollama endpoint (${endpoint}): ${error.message}`,
        { provider: this.providerName, model },
      );
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }
      this.logger.warn(
        `Ollama returned HTTP ${response.status}: ${errorBody || response.statusText}`,
      );
      throw new LlmUnavailableException(
        `Ollama returned error (${response.status}): ${errorBody || response.statusText}`,
        { provider: this.providerName, model, httpStatus: response.status },
      );
    }

    if (isOpenAiMode) {
      const data = (await response.json()) as OpenAiChatResponse;
      const text = data.choices?.[0]?.message?.content;
      if (text === undefined || text === null) {
        throw new LlmUnavailableException(
          'Ollama returned empty response message content',
          { provider: this.providerName, model },
        );
      }

      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens =
        data.usage?.total_tokens ?? inputTokens + outputTokens;

      const usage: LlmTokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens,
      };

      return {
        text,
        usage,
        model,
        provider: this.providerName,
        latencyMs,
      };
    } else {
      const data = (await response.json()) as NativeOllamaChatResponse;
      const text = data.message?.content;
      if (text === undefined || text === null) {
        throw new LlmUnavailableException(
          'Ollama returned empty response message content',
          { provider: this.providerName, model },
        );
      }

      const inputTokens = data.prompt_eval_count ?? 0;
      const outputTokens = data.eval_count ?? 0;
      const totalTokens = inputTokens + outputTokens;

      const usage: LlmTokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens,
      };

      return {
        text,
        usage,
        model,
        provider: this.providerName,
        latencyMs,
      };
    }
  }
}
