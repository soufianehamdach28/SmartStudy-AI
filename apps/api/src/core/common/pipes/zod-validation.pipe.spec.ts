import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().min(18),
  });

  const pipe = new ZodValidationPipe(schema);

  it('passes and transforms valid input', () => {
    const input = { email: 'test@example.com', age: 25 };
    const result = pipe.transform(input, { type: 'body' });
    expect(result).toEqual(input);
  });

  it('throws BadRequestException on invalid input', () => {
    const input = { email: 'not-an-email', age: 10 };
    expect(() => pipe.transform(input, { type: 'body' })).toThrow(
      BadRequestException,
    );
  });
});
