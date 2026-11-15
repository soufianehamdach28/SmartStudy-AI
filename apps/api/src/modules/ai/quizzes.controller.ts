import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  submitQuizAttemptRequestSchema,
  type QuizAttemptResponse,
  type SubmitQuizAttemptRequest,
} from '@smartstudy/shared';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../core/common/pipes/zod-validation.pipe.js';
import { QuizService } from './quiz.service.js';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizService: QuizService) {}

  @Post(':id/attempts')
  @HttpCode(HttpStatus.OK)
  async submitAttempt(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) quizId: string,
    @Body(new ZodValidationPipe(submitQuizAttemptRequestSchema))
    body: SubmitQuizAttemptRequest,
  ): Promise<QuizAttemptResponse> {
    return this.quizService.submitAttempt(user.userId, quizId, body);
  }
}
