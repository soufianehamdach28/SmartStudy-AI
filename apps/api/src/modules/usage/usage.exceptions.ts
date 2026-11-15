import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@smartstudy/shared';

export class QuotaExceededException extends HttpException {
  constructor(
    message = 'Daily AI quota reached.',
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code: 'QUOTA_EXCEEDED' as ErrorCode,
        message,
        details,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
