import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes password into a valid argon2id string', async () => {
    const plain = 'SuperSecret123!';
    const hash = await service.hash(plain);

    expect(hash).toBeTypeOf('string');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(plain);
  });

  it('generates unique salts for identical passwords', async () => {
    const plain = 'SamePassword123!';
    const hash1 = await service.hash(plain);
    const hash2 = await service.hash(plain);

    expect(hash1).not.toBe(hash2);
    expect(await service.verify(hash1, plain)).toBe(true);
    expect(await service.verify(hash2, plain)).toBe(true);
  });

  it('verifies correct password returns true', async () => {
    const plain = 'ValidPassword#2026';
    const hash = await service.hash(plain);

    const isValid = await service.verify(hash, plain);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect password returning false', async () => {
    const plain = 'ValidPassword#2026';
    const hash = await service.hash(plain);

    const isValid = await service.verify(hash, 'WrongPassword#2026');
    expect(isValid).toBe(false);
  });

  it('safely returns false for malformed hash strings without throwing', async () => {
    const malformedHash = 'not-a-valid-argon2-hash';

    const isValid = await service.verify(malformedHash, 'anyPassword');
    expect(isValid).toBe(false);
  });
});
