import {
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
  documentListQuerySchema,
  type DocumentListQuery,
  type DocumentResponse,
  type DocumentUploadResponse,
  type PaginatedDocumentsResponse,
} from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../core/common/pipes/zod-validation.pipe.js';
import { DocumentsService } from './documents.service.js';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Upload a course document (PDF or TXT).
   * Validates size, extension, and magic bytes, stores to S3, records in DB,
   * and returns 202 Accepted.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
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
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.documentsService.deleteForUser(user.userId, id);
  }
}

