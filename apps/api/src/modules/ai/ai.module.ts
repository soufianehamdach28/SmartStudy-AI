import { Module } from '@nestjs/common';
import { LlmModule } from '../../core/llm/llm.module.js';
import { PrismaModule } from '../../core/prisma/prisma.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { FlashcardsService } from './flashcards.service.js';
import { QuizService } from './quiz.service.js';
import { QuizzesController } from './quizzes.controller.js';
import { SummaryService } from './summary.service.js';

@Module({
  imports: [PrismaModule, LlmModule, UsageModule],
  controllers: [QuizzesController],
  providers: [SummaryService, FlashcardsService, QuizService],
  exports: [SummaryService, FlashcardsService, QuizService],
})
export class AiModule {}
