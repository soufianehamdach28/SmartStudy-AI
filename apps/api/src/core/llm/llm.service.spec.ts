import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { GeminiLlmService } from './drivers/gemini-llm.service.js';
import { MockLlmService } from './drivers/mock-llm.service.js';
import { OllamaLlmService } from './drivers/ollama-llm.service.js';
import { LlmService } from './llm.service.js';
import {
  LlmInvalidOutputException,
  LlmUnavailableException,
} from './llm.interface.js';

describe('LlmService', () => {
  let configMap: Record<string, unknown>;
  let mockConfigService: ConfigService<Env, true>;
  let geminiDriver: GeminiLlmService;
  let ollamaDriver: OllamaLlmService;
  let mockDriver: MockLlmService;
  let llmService: LlmService;

  beforeEach(() => {
    configMap = {
      LLM_PROVIDER: 'gemini',
      LLM_FALLBACK_PROVIDERS: 'ollama,mock',
    };

    mockConfigService = {
      get: vi.fn((key: string) => configMap[key]),
    } as unknown as ConfigService<Env, true>;

    geminiDriver = {
      providerName: 'gemini',
      generateText: vi.fn(),
      generateJsonRaw: vi.fn(),
    } as unknown as GeminiLlmService;

    ollamaDriver = {
      providerName: 'ollama',
      generateText: vi.fn(),
      generateJsonRaw: vi.fn(),
    } as unknown as OllamaLlmService;

    mockDriver = new MockLlmService();

    llmService = new LlmService(
      mockConfigService,
      geminiDriver,
      ollamaDriver,
      mockDriver,
    );
  });

  describe('generateText', () => {
    it('uses the primary provider (gemini) on success', async () => {
      vi.mocked(geminiDriver.generateText).mockResolvedValue({
        text: 'Hello from Gemini',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        latencyMs: 120,
      });

      const result = await llmService.generateText({
        system: 'System prompt',
        prompt: 'User prompt',
      });

      expect(result.text).toBe('Hello from Gemini');
      expect(result.provider).toBe('gemini');
      expect(geminiDriver.generateText).toHaveBeenCalledTimes(1);
      expect(ollamaDriver.generateText).not.toHaveBeenCalled();
    });

    it('falls back to ollama if gemini fails with LlmUnavailableException', async () => {
      vi.mocked(geminiDriver.generateText).mockRejectedValue(
        new LlmUnavailableException('Gemini quota reached'),
      );
      vi.mocked(ollamaDriver.generateText).mockResolvedValue({
        text: 'Fallback from Ollama',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        model: 'llama3.2',
        provider: 'ollama',
        latencyMs: 300,
      });

      const result = await llmService.generateText({
        system: '',
        prompt: 'test prompt',
      });

      expect(result.text).toBe('Fallback from Ollama');
      expect(result.provider).toBe('ollama');
      expect(geminiDriver.generateText).toHaveBeenCalledTimes(1);
      expect(ollamaDriver.generateText).toHaveBeenCalledTimes(1);
    });

    it('throws LlmUnavailableException if all providers fail', async () => {
      vi.mocked(geminiDriver.generateText).mockRejectedValue(
        new LlmUnavailableException('Gemini unavailable'),
      );
      vi.mocked(ollamaDriver.generateText).mockRejectedValue(
        new LlmUnavailableException('Ollama unavailable'),
      );
      mockDriver.setFailure(new Error('Mock failure'));

      await expect(
        llmService.generateText({ system: '', prompt: 'test' }),
      ).rejects.toThrow(LlmUnavailableException);
    });
  });

  describe('generateJson', () => {
    const testSchema = z.object({
      title: z.string(),
      points: z.array(z.number()),
    });

    it('parses valid JSON matching schema on first attempt', async () => {
      vi.mocked(geminiDriver.generateJsonRaw).mockResolvedValue({
        text: JSON.stringify({ title: 'Physics 101', points: [1, 2, 3] }),
        usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        latencyMs: 150,
      });

      const result = await llmService.generateJson({
        system: '',
        prompt: 'Give physics points',
        schema: testSchema,
      });

      expect(result.data).toEqual({
        title: 'Physics 101',
        points: [1, 2, 3],
      });
      expect(geminiDriver.generateJsonRaw).toHaveBeenCalledTimes(1);
    });

    it('strips markdown code blocks around JSON', async () => {
      const markdownJson =
        '```json\n{"title": "Chemistry", "points": [99]}\n```';

      vi.mocked(geminiDriver.generateJsonRaw).mockResolvedValue({
        text: markdownJson,
        usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        model: 'gemini-2.5-flash',
        provider: 'gemini',
        latencyMs: 100,
      });

      const result = await llmService.generateJson({
        system: '',
        prompt: 'Chemistry test',
        schema: testSchema,
      });

      expect(result.data).toEqual({
        title: 'Chemistry',
        points: [99],
      });
      expect(geminiDriver.generateJsonRaw).toHaveBeenCalledTimes(1);
    });

    it('retries once if output fails schema validation and succeeds on retry', async () => {
      vi.mocked(geminiDriver.generateJsonRaw)
        .mockResolvedValueOnce({
          // Missing required 'title' field
          text: JSON.stringify({ points: [1, 2] }),
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          latencyMs: 100,
        })
        .mockResolvedValueOnce({
          // Valid output on retry
          text: JSON.stringify({ title: 'Fixed Title', points: [1, 2] }),
          usage: { inputTokens: 25, outputTokens: 15, totalTokens: 40 },
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          latencyMs: 120,
        });

      const result = await llmService.generateJson({
        system: '',
        prompt: 'generate summary points',
        schema: testSchema,
      });

      expect(geminiDriver.generateJsonRaw).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({
        title: 'Fixed Title',
        points: [1, 2],
      });
    });

    it('throws LlmInvalidOutputException if output remains invalid after retry', async () => {
      vi.mocked(geminiDriver.generateJsonRaw)
        .mockResolvedValueOnce({
          text: 'This is not JSON at all',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          latencyMs: 100,
        })
        .mockResolvedValueOnce({
          text: 'Still not JSON',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gemini-2.5-flash',
          provider: 'gemini',
          latencyMs: 100,
        });

      await expect(
        llmService.generateJson({
          system: '',
          prompt: 'generate invalid',
          schema: testSchema,
        }),
      ).rejects.toThrow(LlmInvalidOutputException);

      expect(geminiDriver.generateJsonRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('provider overrides', () => {
    it('allows changing primary and fallback providers dynamically', async () => {
      llmService.setPrimaryProvider('mock');
      mockDriver.queueText('Mock text');

      const result = await llmService.generateText({ system: '', prompt: 'hi' });
      expect(result.provider).toBe('mock');
      expect(result.text).toBe('Mock text');

      llmService.resetProviderOverrides();
      expect(llmService.activePrimary).toBe('gemini');
    });
  });
});
