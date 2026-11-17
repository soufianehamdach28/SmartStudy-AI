import { Module } from '@nestjs/common';
import { LlmModule } from '../../core/llm/llm.module.js';
import { PrismaModule } from '../../core/prisma/prisma.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { ChatPromptBuilder } from './chat/chat-prompt.builder.js';
import { ConversationsController } from './chat/conversations.controller.js';
import { ConversationsService } from './chat/conversations.service.js';
import { FlashcardsService } from './flashcards.service.js';
import { QuizService } from './quiz.service.js';
import { QuizzesController } from './quizzes.controller.js';
import { PostgresRetrieverService } from './retriever/postgres-retriever.service.js';
import { SummaryService } from './summary.service.js';

@Module({
  imports: [PrismaModule, LlmModule, UsageModule],
  controllers: [QuizzesController, ConversationsController],
  providers: [
    SummaryService,
    FlashcardsService,
    QuizService,
    PostgresRetrieverService,
    ChatPromptBuilder,
    ConversationsService,
  ],
  exports: [
    SummaryService,
    FlashcardsService,
    QuizService,
    PostgresRetrieverService,
    ChatPromptBuilder,
    ConversationsService,
  ],
})
export class AiModule {}

