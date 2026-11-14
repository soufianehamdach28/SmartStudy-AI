import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { OllamaLlmService } from './ollama-llm.service.js';
import { LlmUnavailableException } from '../llm.interface.js';

describe('OllamaLlmService', () => {
  let configMap: Record<string, unknown>;
  let mockConfigService: ConfigService<Env, true>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    configMap = {
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_MODEL: 'llama3.2',
      LLM_TIMEOUT_MS: 5000,
    };

    mockConfigService = {
      get: vi.fn((key: string) => configMap[key]),
    } as unknown as ConfigService<Env, true>;

    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls /v1/chat/completions in OpenAI compatibility mode', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { content: 'Photosynthesis is the process plants use.' },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        }),
      } as Response;
    });

    const service = new OllamaLlmService(mockConfigService);
    const result = await service.generateText({
      system: 'Biology teacher',
      prompt: 'Explain photosynthesis',
      maxTokens: 250,
      temperature: 0.5,
    });

    expect(capturedUrl).toBe('http://localhost:11434/v1/chat/completions');
    expect(capturedBody).toMatchObject({
      model: 'llama3.2',
      temperature: 0.5,
      max_tokens: 250,
      messages: [
        { role: 'system', content: 'Biology teacher' },
        { role: 'user', content: 'Explain photosynthesis' },
      ],
    });

    expect(result.text).toBe('Photosynthesis is the process plants use.');
    expect(result.usage.totalTokens).toBe(20);
    expect(result.provider).toBe('ollama');
  });

  it('calls /api/chat when baseUrl does not end with /v1', async () => {
    configMap.OLLAMA_BASE_URL = 'http://localhost:11434';
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: '{"answer": 42}' },
          prompt_eval_count: 14,
          eval_count: 6,
        }),
      } as Response;
    });

    const service = new OllamaLlmService(mockConfigService);
    const result = await service.generateJsonRaw({
      system: '',
      prompt: 'meaning of life',
    });

    expect(capturedUrl).toBe('http://localhost:11434/api/chat');
    expect(capturedBody).toMatchObject({
      model: 'llama3.2',
      format: 'json',
    });
    expect(result.text).toBe('{"answer": 42}');
    expect(result.usage.totalTokens).toBe(20);
  });

  it('throws LlmUnavailableException on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => 'Ollama daemon starting',
    } as Response);

    const service = new OllamaLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(LlmUnavailableException);
  });

  it('throws LlmUnavailableException on network timeout', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('Request timeout', 'TimeoutError'),
    );

    const service = new OllamaLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(/timed out/);
  });
});
