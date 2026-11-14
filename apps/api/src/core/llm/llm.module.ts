import { Global, Module } from '@nestjs/common';
import { GeminiLlmService } from './drivers/gemini-llm.service.js';
import { MockLlmService } from './drivers/mock-llm.service.js';
import { OllamaLlmService } from './drivers/ollama-llm.service.js';
import { LlmService } from './llm.service.js';

@Global()
@Module({
  providers: [
    GeminiLlmService,
    OllamaLlmService,
    MockLlmService,
    LlmService,
  ],
  exports: [
    GeminiLlmService,
    OllamaLlmService,
    MockLlmService,
    LlmService,
  ],
})
export class LlmModule {}
