import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@smartstudy/shared';

export class DocumentNotReadyException extends HttpException {
  constructor(message = 'Document is still processing and not ready yet.') {
    super(
      {
        code: 'DOCUMENT_NOT_READY' as ErrorCode,
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DocumentProcessingFailedException extends HttpException {
  constructor(message = 'Document processing failed. Cannot perform AI operations on this document.') {
    super(
      {
        code: 'DOCUMENT_PROCESSING_FAILED' as ErrorCode,
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
