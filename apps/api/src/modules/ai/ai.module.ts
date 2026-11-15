import { Module } from '@nestjs/common';
import { LlmModule } from '../../core/llm/llm.module.js';
import { PrismaModule } from '../../core/prisma/prisma.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { SummaryService } from './summary.service.js';

@Module({
  imports: [PrismaModule, LlmModule, UsageModule],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class AiModule {}
