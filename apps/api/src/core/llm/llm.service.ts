import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { GeminiLlmService } from './drivers/gemini-llm.service.js';
import { MockLlmService } from './drivers/mock-llm.service.js';
import { OllamaLlmService } from './drivers/ollama-llm.service.js';
import {
  type LlmClient,
  type LlmDriver,
  type LlmJsonOptions,
  type LlmResult,
  type LlmTextOptions,
  LlmInvalidOutputException,
  LlmUnavailableException,
} from './llm.interface.js';

@Injectable()
export class LlmService implements LlmClient {
  private readonly logger = new Logger(LlmService.name);
  private readonly drivers: Map<string, LlmDriver> = new Map();

  private overridePrimary?: string;
  private overrideFallbacks?: string[];

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly geminiDriver: GeminiLlmService,
    private readonly ollamaDriver: OllamaLlmService,
    private readonly mockDriver: MockLlmService,
  ) {
    this.drivers.set('gemini', this.geminiDriver);
    this.drivers.set('ollama', this.ollamaDriver);
    this.drivers.set('mock', this.mockDriver);
  }

  get activePrimary(): string {
    return (
      this.overridePrimary ||
      this.configService.get<string>('LLM_PROVIDER') ||
      'gemini'
    );
  }

  get activeFallbacks(): string[] {
    if (this.overrideFallbacks) {
      return this.overrideFallbacks;
    }
    const raw =
      this.configService.get<string>('LLM_FALLBACK_PROVIDERS') ||
      'ollama,mock';
    return raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0 && item !== this.activePrimary);
  }

  setPrimaryProvider(name: string): void {
    this.overridePrimary = name.toLowerCase();
  }

  setFallbackProviders(names: string[]): void {
    this.overrideFallbacks = names.map((n) => n.toLowerCase());
  }

  resetProviderOverrides(): void {
    this.overridePrimary = undefined;
    this.overrideFallbacks = undefined;
  }

  getDriver(name: string): LlmDriver | undefined {
    return this.drivers.get(name.toLowerCase());
  }

  async generateText(options: LlmTextOptions): Promise<LlmResult<string>> {
    return this.executeWithFallback(async (driver) => {
      return driver.generateText(options);
    });
  }

  async generateJson<T>(options: LlmJsonOptions<T>): Promise<LlmResult<T>> {
    // 1. Initial attempt using active provider (with fallback support)
    const initialResult = await this.executeWithFallback(async (driver) => {
      return driver.generateJsonRaw({
        system: options.system,
        prompt: options.prompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
    });

    const firstParse = this.parseAndValidate(
      initialResult.text,
      options.schema,
    );
    if (firstParse.success) {
      return {
        ...initialResult,
        data: firstParse.data,
      };
    }

    this.logger.warn(
      `LLM structured output validation failed (${firstParse.error}). Retrying once with schema feedback...`,
    );

    // 2. Single retry with validation error feedback appended to prompt
    const retryPrompt = `${options.prompt}

CRITICAL INSTRUCTION: Your previous response failed validation with the following issue(s):
${firstParse.error}

Ensure you output strictly valid JSON conforming exactly to the required schema, with no markdown code fences and no commentary.`;

    const retryResult = await this.executeWithFallback(async (driver) => {
      return driver.generateJsonRaw({
        system: options.system,
        prompt: retryPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
    });

    const secondParse = this.parseAndValidate(
      retryResult.text,
      options.schema,
    );
    if (secondParse.success) {
      return {
        ...retryResult,
        data: secondParse.data,
      };
    }

    this.logger.error(
      `LLM structured output retry failed. Final error: ${secondParse.error}`,
    );

    throw new LlmInvalidOutputException(
      `AI model generated an invalid structured output after retry: ${secondParse.error}`,
      {
        initialError: firstParse.error,
        retryError: secondParse.error,
        rawOutput: retryResult.text,
      },
    );
  }

  /**
   * Dispatches a call to the primary provider and falls back sequentially
   * to alternative providers upon unavailability, timeouts, or quota errors.
   */
  private async executeWithFallback(
    action: (driver: LlmDriver) => Promise<LlmResult<string>>,
  ): Promise<LlmResult<string>> {
    const primaryName = this.activePrimary;
    const primaryDriver = this.getDriver(primaryName);

    const candidates = [
      { name: primaryName, driver: primaryDriver },
      ...this.activeFallbacks.map((name) => ({
        name,
        driver: this.getDriver(name),
      })),
    ];

    let lastError: Error | undefined;

    for (const { name, driver } of candidates) {
      if (!driver) {
        this.logger.debug(`Skipping unknown or unconfigured LLM driver: ${name}`);
        continue;
      }

      try {
        return await action(driver);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        this.logger.warn(
          `LLM driver "${name}" failed: ${error.message}. Attempting next available provider...`,
        );
      }
    }

    if (lastError instanceof LlmUnavailableException) {
      throw lastError;
    }

    throw new LlmUnavailableException(
      `All configured LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
      {
        primary: primaryName,
        fallbacks: this.activeFallbacks,
        lastErrorMessage: lastError?.message,
      },
    );
  }

  /**
   * Safely extracts JSON from model text (stripping markdown fences if present)
   * and verifies against the given Zod schema.
   */
  private parseAndValidate<T>(
    rawText: string,
    schema: import('zod').ZodType<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    let clean = rawText.trim();

    // Strip ```json ... ``` or ``` ... ``` if the LLM wrapped it in markdown codeblocks
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch (err: unknown) {
      const syntaxError = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Invalid JSON syntax: ${syntaxError}`,
      };
    }

    const zodResult = schema.safeParse(parsed);
    if (!zodResult.success) {
      const issues = zodResult.error.issues
        .map(
          (issue) =>
            `- path [${issue.path.join('.') || 'root'}]: ${issue.message}`,
        )
        .join('; ');
      return {
        success: false,
        error: `Schema mismatch: ${issues}`,
      };
    }

    return {
      success: true,
      data: zodResult.data,
    };
  }
}
