import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { fileTypeFromBuffer } from 'file-type';
import path from 'node:path';
import type {
  DocumentExtension,
  DocumentMimeType,
  DocumentUploadResponse,
} from '@smartstudy/shared';
import type { Env } from '../../core/config/env.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { StorageService } from '../../core/storage/storage.service.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  PROCESS_DOCUMENT_JOB,
  type ProcessDocumentJobData,
} from './documents.constants.js';

export interface ValidatedFile {
  buffer: Buffer;
  mimeType: DocumentMimeType;
  extension: DocumentExtension;
  originalName: string;
  sizeBytes: number;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE)
    private readonly documentQueue: Queue<ProcessDocumentJobData>,
  ) {
    this.maxUploadBytes = this.config.get('MAX_UPLOAD_BYTES', { infer: true });
  }

  /**
   * Validate file presence, size, extension, and binary magic bytes.
   */
  async validateFile(file?: Express.Multer.File): Promise<ValidatedFile> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No file provided. Please attach a PDF or TXT file.',
      });
    }

    if (file.buffer.length > this.maxUploadBytes) {
      const maxMb = Math.round(this.maxUploadBytes / (1024 * 1024));
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the ${maxMb} MB limit.`,
      });
    }

    const rawExt = path.extname(file.originalname || '').toLowerCase();
    if (rawExt !== '.pdf' && rawExt !== '.txt') {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Only PDF and TXT files are supported.',
      });
    }

    // Magic-byte detection
    const detectedType = await fileTypeFromBuffer(file.buffer);

    if (rawExt === '.pdf') {
      const isPdfHeader =
        file.buffer.length >= 5 &&
        file.buffer[0] === 0x25 && // %
        file.buffer[1] === 0x50 && // P
        file.buffer[2] === 0x44 && // D
        file.buffer[3] === 0x46 && // F
        file.buffer[4] === 0x2d; // -

      if (detectedType?.mime !== 'application/pdf' && !isPdfHeader) {
        throw new UnsupportedMediaTypeException({
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'The uploaded file does not match valid PDF content.',
        });
      }

      return {
        buffer: file.buffer,
        mimeType: 'application/pdf',
        extension: '.pdf',
        originalName: file.originalname || 'document.pdf',
        sizeBytes: file.buffer.length,
      };
    }

    // rawExt === '.txt'
    // If magic bytes match a known binary format (e.g. image, zip, exe), reject it
    if (detectedType !== undefined) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'The uploaded file is not a valid plain text file.',
      });
    }

    if (!this.isValidUtf8Text(file.buffer)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'The uploaded file contains binary or invalid text characters.',
      });
    }

    return {
      buffer: file.buffer,
      mimeType: 'text/plain',
      extension: '.txt',
      originalName: file.originalname || 'document.txt',
      sizeBytes: file.buffer.length,
    };
  }

  /**
   * Handle document upload:
   * 1. Validate file (size, extension, magic bytes)
   * 2. Upload to S3 storage under safe path
   * 3. Insert Document row in database with status UPLOADED
   * 4. Return 202 Accepted payload
   */
  async upload(
    userId: string,
    file?: Express.Multer.File,
  ): Promise<DocumentUploadResponse> {
    const validated = await this.validateFile(file);

    const storageKey = this.storage.generateStorageKey(
      userId,
      validated.extension,
    );

    // Store the file in S3-compatible storage
    await this.storage.upload(
      storageKey,
      validated.buffer,
      validated.mimeType,
    );

    // Create database record
    const document = await this.prisma.document.create({
      data: {
        userId,
        title: validated.originalName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        storageKey,
        status: 'UPLOADED',
      },
    });

    // Enqueue document for background text extraction & chunking
    await this.documentQueue.add(
      PROCESS_DOCUMENT_JOB,
      { documentId: document.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    );

    this.logger.log(
      `Document "${document.title}" (${document.id}) uploaded and queued by user ${userId}`,
    );

    return {
      document: {
        id: document.id,
        userId: document.userId,
        title: document.title,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        errorMessage: document.errorMessage,
        pageCount: document.pageCount,
        summary: document.summary,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      },
      message: 'Document uploaded successfully and queued for processing',
    };
  }

  /**
   * Check if a buffer is valid UTF-8 text without embedded binary null characters.
   */
  private isValidUtf8Text(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 4096);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) {
        return false;
      }
    }

    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return true;
    } catch {
      return false;
    }
  }
}
