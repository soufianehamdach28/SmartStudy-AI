import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentUploadResponse } from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
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
}
