import { describe, expect, it } from 'vitest';
import { MockLlmService } from './mock-llm.service.js';

describe('MockLlmService', () => {
  it('returns default text when no response is queued', async () => {
    const service = new MockLlmService();
    const result = await service.generateText({
      system: 'You are an assistant',
      prompt: 'Hello',
    });

    expect(result.text).toBe('Mock LLM text response');
    expect(result.provider).toBe('mock');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(service.history).toHaveLength(1);
    expect(service.history[0]?.options.prompt).toBe('Hello');
  });

  it('dequeues queued text responses in FIFO order', async () => {
    const service = new MockLlmService();
    service.queueText('First queued', { inputTokens: 5, outputTokens: 5, totalTokens: 10 });
    service.queueText('Second queued');

    const res1 = await service.generateText({ system: '', prompt: '1' });
    const res2 = await service.generateText({ system: '', prompt: '2' });
    const res3 = await service.generateText({ system: '', prompt: '3' });

    expect(res1.text).toBe('First queued');
    expect(res1.usage.totalTokens).toBe(10);
    expect(res2.text).toBe('Second queued');
    expect(res3.text).toBe(service.defaultText);
  });

  it('dequeues queued JSON responses', async () => {
    const service = new MockLlmService();
    service.queueJsonObject({ foo: 'bar' });

    const result = await service.generateJsonRaw({
      system: '',
      prompt: 'give me json',
    });

    expect(result.text).toBe('{"foo":"bar"}');
    expect(result.provider).toBe('mock');
  });

  it('throws simulated failure when set', async () => {
    const service = new MockLlmService();
    service.setFailure(new Error('Simulated upstream outage'));

    await expect(
      service.generateText({ system: '', prompt: 'test' }),
    ).rejects.toThrow('Simulated upstream outage');

    service.setFailure(null);
    const res = await service.generateText({ system: '', prompt: 'test' });
    expect(res.text).toBe(service.defaultText);
  });

  it('resets queues and history on reset()', () => {
    const service = new MockLlmService();
    service.queueText('hello');
    service.queueJsonRaw('{}');
    service.reset();

    expect(service.history).toHaveLength(0);
  });
});
