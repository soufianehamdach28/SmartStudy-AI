import {
  type PipeTransform,
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates and transforms incoming request data against a Zod schema.
 * Throws a NestJS BadRequestException on validation failure.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Validation failed',
        details: { issues: parsed.error.issues },
      });
    }
    return parsed.data;
  }
}
