import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import {
  type ApiError,
  type ErrorCode,
  ERROR_CODES,
} from '@smartstudy/shared';

/**
 * Checks whether a given string is one of the stable ErrorCode enum values.
 */
function isKnownErrorCode(code: unknown): code is ErrorCode {
  return (
    typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code)
  );
}

/**
 * Duck-typing check for Prisma Client Known Request Errors (e.g. P2002, P2025).
 */
interface PrismaKnownError {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    (err as { code: string }).code.startsWith('P')
  );
}

/**
 * Maps standard HTTP status codes to our unified ErrorCode enum.
 */
function defaultErrorCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'VALIDATION_ERROR';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'FILE_TOO_LARGE';
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return 'UNSUPPORTED_FILE_TYPE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Global exception filter ensuring EVERY error returned by the API strictly conforms
 * to the unified error contract:
 *
 * ```json
 * {
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "...",
 *     "details": {}
 *   }
 * }
 * ```
 *
 * It prevents leaking internal server details/stack traces, standardizes Prisma exceptions,
 * and preserves structured validation issues.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected internal error occurred.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = defaultErrorCodeForStatus(status);

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;

        // If the exception already provided a known ErrorCode, preserve it
        if (isKnownErrorCode(resObj.code)) {
          code = resObj.code;
        } else if (
          status === HttpStatus.UNAUTHORIZED &&
          typeof resObj.message === 'string' &&
          resObj.message.toLowerCase().includes('expired')
        ) {
          code = 'TOKEN_EXPIRED';
        }

        if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else if (Array.isArray(resObj.message)) {
          message = resObj.message.join(', ');
        }

        if (
          typeof resObj.details === 'object' &&
          resObj.details !== null &&
          !Array.isArray(resObj.details)
        ) {
          details = resObj.details as Record<string, unknown>;
        }
      }
    } else if (isPrismaKnownError(exception)) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'VALIDATION_ERROR';
        const target = exception.meta?.target;
        message = Array.isArray(target)
          ? `Unique constraint failed on: ${target.join(', ')}`
          : 'A record with this identifier already exists.';
        details = exception.meta;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'The requested resource was not found.';
      } else {
        this.logger.error(
          `Unhandled Prisma error [${exception.code}]: ${exception.message}`,
          request.url,
        );
      }
    } else {
      // Unhandled error (e.g. programmer bug, unexpected runtime crash)
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `Unhandled exception on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${err.message}`,
        err.stack,
      );
    }

    const payload: ApiError = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(payload);
  }
}
