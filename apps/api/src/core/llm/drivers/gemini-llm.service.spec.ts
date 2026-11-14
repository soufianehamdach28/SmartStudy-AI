import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { GeminiLlmService } from './gemini-llm.service.js';
import { LlmUnavailableException } from '../llm.interface.js';

describe('GeminiLlmService', () => {
  let configMap: Record<string, unknown>;
  let mockConfigService: ConfigService<Env, true>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    configMap = {
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.5-flash',
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

  it('throws LlmUnavailableException if GEMINI_API_KEY is not configured', async () => {
    configMap.GEMINI_API_KEY = '';
    const service = new GeminiLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(LlmUnavailableException);
  });

  it('sends valid payload and extracts text & tokens on success', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Calculus is the mathematical study of change.' }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 10,
            totalTokenCount: 25,
          },
        }),
      } as Response;
    });

    const service = new GeminiLlmService(mockConfigService);
    const result = await service.generateText({
      system: 'You are a tutor',
      prompt: 'What is calculus?',
      maxTokens: 500,
      temperature: 0.3,
    });

    expect(capturedUrl).toContain('models/gemini-2.5-flash:generateContent');
    expect(capturedUrl).toContain('key=test-gemini-key');
    expect(capturedBody).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'What is calculus?' }] }],
      systemInstruction: { parts: [{ text: 'You are a tutor' }] },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
      },
    });

    expect(result.text).toBe('Calculus is the mathematical study of change.');
    expect(result.usage).toEqual({
      inputTokens: 15,
      outputTokens: 10,
      totalTokens: 25,
    });
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('requests JSON mode in generateJsonRaw', async () => {
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"key": "value"}' }],
                role: 'model',
              },
            },
          ],
        }),
      } as Response;
    });

    const service = new GeminiLlmService(mockConfigService);
    const result = await service.generateJsonRaw({
      system: '',
      prompt: 'give json',
    });

    expect(result.text).toBe('{"key": "value"}');
    const genConfig = capturedBody.generationConfig as Record<string, unknown>;
    expect(genConfig.responseMimeType).toBe('application/json');
  });

  it('maps HTTP 429 quota exhaustion to LlmUnavailableException', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          code: 429,
          message: 'Resource has been exhausted (check quota).',
          status: 'RESOURCE_EXHAUSTED',
        },
      }),
    } as Response);

    const service = new GeminiLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(LlmUnavailableException);
  });

  it('handles safety blocks or missing text parts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [] },
            finishReason: 'SAFETY',
          },
        ],
      }),
    } as Response);

    const service = new GeminiLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(/finishReason: SAFETY/);
  });

  it('maps network timeouts to LlmUnavailableException', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );

    const service = new GeminiLlmService(mockConfigService);

    await expect(
      service.generateText({ system: '', prompt: 'hello' }),
    ).rejects.toThrow(/timed out/);
  });
});
