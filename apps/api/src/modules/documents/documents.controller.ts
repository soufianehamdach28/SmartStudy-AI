import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  documentListQuerySchema,
  generateFlashcardsRequestSchema,
  generateQuizRequestSchema,
  type DocumentListQuery,
  type DocumentResponse,
  type DocumentSummaryResponse,
  type DocumentUploadResponse,
  type FlashcardsResponse,
  type GenerateFlashcardsRequest,
  type GenerateQuizRequest,
  type PaginatedDocumentsResponse,
  type QuizResponse,
} from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../core/common/pipes/zod-validation.pipe.js';
import { FlashcardsService } from '../ai/flashcards.service.js';
import { QuizService } from '../ai/quiz.service.js';
import { SummaryService } from '../ai/summary.service.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly summaryService: SummaryService,
    private readonly flashcardsService: FlashcardsService,
    private readonly quizService: QuizService,
  ) {}

  /**
   * Upload a course document (PDF or TXT).
   * Validates size, extension, and magic bytes, stores to S3, records in DB,
   * and returns 202 Accepted.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a course document (PDF or TXT)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF or TXT, max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Document accepted and queued for text extraction & chunking.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (unsupported file type, file too large, missing).',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  async upload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentUploadResponse> {
    return this.documentsService.upload(user.userId, file);
  }

  /**
   * Get paginated list of documents uploaded by the authenticated user.
   */
  @Get()
  @ApiOperation({
    summary: 'List user documents with cursor-based pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of items to return (1-100, default 20)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor ID for next page',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of documents.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(documentListQuerySchema))
    query: DocumentListQuery,
  ): Promise<PaginatedDocumentsResponse> {
    return this.documentsService.findAllForUser(user.userId, query);
  }

  /**
   * Get detail of a specific document owned by the authenticated user.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get document details and processing status' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 200,
    description: 'Document metadata and processing status.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DocumentResponse> {
    return this.documentsService.findOneForUser(user.userId, id);
  }

  /**
   * Delete a document and its cascade data (chunks, S3 object).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document and cascade delete derived data' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 204,
    description: 'Document and derived resources deleted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.documentsService.deleteForUser(user.userId, id);
  }

  /**
   * Summarize a document using AI.
   * Checks DB cache first, enforces user quota, isolates content against injection,
   * stores to DB cache, and returns 200 OK.
   */
  @Post(':id/summarize')
  @ApiOperation({
    summary: 'Generate or retrieve cached AI summary for document',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 200,
    description: 'Document summary generated or served from cache.',
  })
  @ApiResponse({ status: 400, description: 'Document not ready.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 429, description: 'AI quota or rate limit exceeded.' })
  async summarize(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DocumentSummaryResponse> {
    return this.summaryService.summarizeDocument(user.userId, id);
  }

  /**
   * Generate flashcards for a document using AI (or return cached flashcards).
   */
  @Post(':id/flashcards')
  @ApiOperation({
    summary: 'Generate AI flashcards from document content',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 201,
    description: 'Flashcards generated and stored successfully.',
  })
  @ApiResponse({ status: 400, description: 'Document not ready.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 429, description: 'AI quota or rate limit exceeded.' })
  async generateFlashcards(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(generateFlashcardsRequestSchema.optional().default({ count: 10 })))
    body: GenerateFlashcardsRequest,
  ): Promise<FlashcardsResponse> {
    return this.flashcardsService.generateFlashcards(user.userId, id, body.count);
  }

  /**
   * Get previously generated flashcards for a document.
   */
  @Get(':id/flashcards')
  @ApiOperation({
    summary: 'Get previously generated flashcards for document',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 200,
    description: 'Flashcard list for document.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async getFlashcards(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<FlashcardsResponse> {
    return this.flashcardsService.getFlashcards(user.userId, id);
  }

  /**
   * Generate a multi-choice quiz for a document using AI.
   */
  @Post(':id/quizzes')
  @ApiOperation({
    summary: 'Generate a multiple-choice quiz from document content',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 201,
    description: 'Quiz and questions generated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Document not ready.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 429, description: 'AI quota or rate limit exceeded.' })
  async generateQuiz(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(generateQuizRequestSchema.optional().default({ questionCount: 5 })))
    body: GenerateQuizRequest,
  ): Promise<QuizResponse> {
    return this.quizService.generateQuiz(user.userId, id, body);
  }

  /**
   * Get previously generated quizzes for a document.
   */
  @Get(':id/quizzes')
  @ApiOperation({
    summary: 'Get all quizzes created for a document',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Document UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of quizzes.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async getQuizzes(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<QuizResponse[]> {
    return this.quizService.getDocumentQuizzes(user.userId, id);
  }
}

