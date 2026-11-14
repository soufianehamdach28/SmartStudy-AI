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

interface GeminiContentPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiContentPart[];
    role?: string;
  };
  finishReason?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

@Injectable()
export class GeminiLlmService implements LlmDriver {
  readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiLlmService.name);

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async generateText(options: LlmTextOptions): Promise<LlmResult<string>> {
    return this.callGemini(options, false);
  }

  async generateJsonRaw(options: LlmTextOptions): Promise<LlmResult<string>> {
    return this.callGemini(options, true);
  }

  private async callGemini(
    options: LlmTextOptions,
    isJson: boolean,
  ): Promise<LlmResult<string>> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      throw new LlmUnavailableException(
        'GEMINI_API_KEY is not configured or is empty.',
        { provider: this.providerName },
      );
    }

    const model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const timeoutMs =
      this.configService.get<number>('LLM_TIMEOUT_MS') || 30_000;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? (isJson ? 0.1 : 0.2),
        ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(isJson ? { responseMimeType: 'application/json' } : {}),
      },
    };

    if (options.system && options.system.trim() !== '') {
      body.systemInstruction = {
        parts: [{ text: options.system }],
      };
    }

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
          `Google Gemini request timed out after ${timeoutMs}ms`,
          { provider: this.providerName, model, timeoutMs },
        );
      }
      throw new LlmUnavailableException(
        `Failed to reach Google Gemini API: ${error.message}`,
        { provider: this.providerName, model },
      );
    }

    const latencyMs = Date.now() - startTime;
    let data: GeminiApiResponse;

    try {
      data = (await response.json()) as GeminiApiResponse;
    } catch {
      throw new LlmUnavailableException(
        `Google Gemini returned non-JSON response with HTTP status ${response.status}`,
        { provider: this.providerName, status: response.status },
      );
    }

    if (!response.ok) {
      const errorDetails = data.error?.message || response.statusText;
      const status = data.error?.code || response.status;
      this.logger.warn(
        `Gemini API error (HTTP ${response.status}): ${errorDetails}`,
      );

      throw new LlmUnavailableException(
        `Google Gemini error (${status}): ${errorDetails}`,
        {
          provider: this.providerName,
          model,
          httpStatus: response.status,
          geminiStatus: data.error?.status,
        },
      );
    }

    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (textPart === undefined || textPart === null) {
      const finishReason = candidate?.finishReason || 'UNKNOWN';
      throw new LlmUnavailableException(
        `Google Gemini returned no text content (finishReason: ${finishReason})`,
        { provider: this.providerName, model, finishReason },
      );
    }

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens =
      data.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

    const usage: LlmTokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
    };

    return {
      text: textPart,
      usage,
      model,
      provider: this.providerName,
      latencyMs,
    };
  }
}
