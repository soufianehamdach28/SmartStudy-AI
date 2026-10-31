import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Service handling one-way password hashing and verification using Argon2id.
 *
 * Argon2id is the current OWASP recommendation for password storage:
 * it is memory-hard to resist GPU/ASIC-based brute-force cracking attacks
 * and automatically generates unique cryptographically secure salts.
 */
@Injectable()
export class PasswordService {
  /**
   * Hashes a plain-text password using Argon2id.
   *
   * Parameters:
   * - memoryCost: 65536 KiB (64 MiB)
   * - timeCost: 3 iterations
   * - parallelism: 4 threads
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a plain-text password against an Argon2id hash.
   *
   * Safely returns `false` if the password does not match or if the
   * provided hash string is malformed / invalid.
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
