import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

/** Minimal valid environment — only fields that have no default. */
const validEnv = {
  DATABASE_URL: 'postgresql://smartstudy:smartstudy@localhost:5432/smartstudy',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'a-test-secret-that-is-at-least-32-chars-long!!',
  JWT_REFRESH_SECRET: 'a-refresh-secret-that-is-at-least-32-chars-long',
};

describe('parseEnv', () => {
  it('applies safe defaults', () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.JWT_REFRESH_TTL).toBe('30d');
  });

  it('coerces numbers from strings', () => {
    const env = parseEnv({ ...validEnv, PORT: '8080', MAX_PAGES: '42' });

    expect(env.PORT).toBe(8080);
    expect(env.MAX_PAGES).toBe(42);
  });

  it('explains which variable is missing', () => {
    expect(() => parseEnv({ REDIS_URL: validEnv.REDIS_URL })).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      parseEnv({
        DATABASE_URL: validEnv.DATABASE_URL,
        REDIS_URL: validEnv.REDIS_URL,
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects invalid values', () => {
    expect(() => parseEnv({ ...validEnv, PORT: 'not-a-port' })).toThrow(/PORT/);
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
    expect(() =>
      parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
