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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Quizzes')
@ApiBearerAuth('JWT-auth')
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizService: QuizService) {}

  @Post(':id/attempts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit answers for a quiz attempt and compute score',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Quiz UUID' })
  @ApiResponse({
    status: 200,
    description: 'Quiz scored with detailed question-by-question explanations.',
  })
  @ApiResponse({ status: 400, description: 'Invalid attempt payload.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Quiz not found.' })
  async submitAttempt(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) quizId: string,
    @Body(new ZodValidationPipe(submitQuizAttemptRequestSchema))
    body: SubmitQuizAttemptRequest,
  ): Promise<QuizAttemptResponse> {
    return this.quizService.submitAttempt(user.userId, quizId, body);
  }
}
