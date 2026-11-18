import {
  Injectable,
  type ExecutionContext,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler';
import type { Env } from '../../config/env.js';

/**
 * Custom Throttler Guard providing dual rate-limiting tracking:
 *
 * 1. Authenticated requests: Tracked per user (`user:<userId>`),
 *    preventing clients from bypassing rate limits by switching IP addresses.
 * 2. Unauthenticated requests: Tracked per client IP (`ip:<ip>`),
 *    defending against credential stuffing and brute-force attacks.
 *
 * In NestJS, global guards execute before controller guards like JwtAuthGuard.
 * Therefore, this guard inspects both `req.user` and the `Authorization: Bearer <jwt>`
 * header (verifying it against JWT_ACCESS_SECRET) to reliably identify users.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override errorMessage =
    'Too many requests. Please slow down and try again later.';

  private readonly jwtSecret: string;

  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService<Env, true>,
    @Optional() private readonly jwtService?: JwtService,
  ) {
    super(options, storageService, reflector);
    this.jwtSecret = this.configService.get('JWT_ACCESS_SECRET', {
      infer: true,
    });
  }

  /**
   * Identifies the request client for rate-limiting purposes.
   */
  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    // 1. If req.user is already populated by an upstream guard
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (userId) {
      return `user:${userId}`;
    }

    // 2. If an Authorization header is present with a valid Bearer token
    const authHeader = req.headers?.authorization;
    if (
      this.jwtService &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub?: string;
          id?: string;
        }>(token, { secret: this.jwtSecret });

        const verifiedId = payload?.sub ?? payload?.id;
        if (verifiedId) {
          return `user:${verifiedId}`;
        }
      } catch {
        // Expired or forged token: ignore and fall back to IP tracking
      }
    }

    // 3. Fall back to client IP (handling forwarded / proxy headers)
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const firstIp = forwarded.split(',')[0].trim();
      if (firstIp) {
        return `ip:${firstIp}`;
      }
    }

    const ip =
      req.ips?.length ? req.ips[0] : req.ip || req.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  protected override async getErrorMessage(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return this.errorMessage;
  }
}
