import { Injectable } from '@nestjs/common';
import type {
  LlmDriver,
  LlmResult,
  LlmTextOptions,
  LlmTokenUsage,
} from '../llm.interface.js';

export interface RecordedLlmCall {
  type: 'text' | 'json';
  options: LlmTextOptions;
  timestamp: number;
}

@Injectable()
export class MockLlmService implements LlmDriver {
  readonly providerName = 'mock';

  private textQueue: Array<{ text: string; usage?: Partial<LlmTokenUsage> }> =
    [];
  private jsonQueue: Array<{ json: string; usage?: Partial<LlmTokenUsage> }> =
    [];
  private failureError: Error | null = null;
  private readonly callHistory: RecordedLlmCall[] = [];

  defaultText = 'Mock LLM text response';
  defaultJson = '{"result": "mock"}';

  get history(): ReadonlyArray<RecordedLlmCall> {
    return this.callHistory;
  }

  queueText(text: string, usage?: Partial<LlmTokenUsage>): this {
    this.textQueue.push({ text, usage });
    return this;
  }

  queueJsonRaw(json: string, usage?: Partial<LlmTokenUsage>): this {
    this.jsonQueue.push({ json, usage });
    return this;
  }

  queueJsonObject(data: unknown, usage?: Partial<LlmTokenUsage>): this {
    this.jsonQueue.push({ json: JSON.stringify(data), usage });
    return this;
  }

  setFailure(error: Error | null): this {
    this.failureError = error;
    return this;
  }

  reset(): void {
    this.textQueue = [];
    this.jsonQueue = [];
    this.failureError = null;
    this.callHistory.length = 0;
  }

  async generateText(options: LlmTextOptions): Promise<LlmResult<string>> {
    this.callHistory.push({
      type: 'text',
      options,
      timestamp: Date.now(),
    });

    if (this.failureError) {
      throw this.failureError;
    }

    const queued = this.textQueue.shift();
    const text = queued ? queued.text : this.defaultText;
    const usage = this.resolveUsage(queued?.usage);

    return {
      text,
      usage,
      model: 'mock-model',
      provider: this.providerName,
      latencyMs: 5,
    };
  }

  async generateJsonRaw(
    options: LlmTextOptions,
  ): Promise<LlmResult<string>> {
    this.callHistory.push({
      type: 'json',
      options,
      timestamp: Date.now(),
    });

    if (this.failureError) {
      throw this.failureError;
    }

    const queued = this.jsonQueue.shift();
    const json = queued ? queued.json : this.defaultJson;
    const usage = this.resolveUsage(queued?.usage);

    return {
      text: json,
      usage,
      model: 'mock-model',
      provider: this.providerName,
      latencyMs: 5,
    };
  }

  private resolveUsage(partial?: Partial<LlmTokenUsage>): LlmTokenUsage {
    return {
      inputTokens: partial?.inputTokens ?? 20,
      outputTokens: partial?.outputTokens ?? 15,
      totalTokens: partial?.totalTokens ?? 35,
    };
  }
}
