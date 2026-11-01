import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@smartstudy/shared';
import type { Env } from '../../core/config/env.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface IssuedTokens {
  accessToken: string;
  /** Raw opaque refresh token. Returned once to the client; only its hash is stored. */
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds (matches JWT_ACCESS_TTL). */
  expiresIn: number;
}

export interface RotatedTokens extends IssuedTokens {
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
  };
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Hash a high-entropy opaque token with SHA-256.
   *
   * Why SHA-256 (not Argon2id here): Argon2id is designed to slow down
   * brute-force attacks on *low-entropy* secrets (passwords). A 32-byte
   * cryptographically random token has 256 bits of entropy — brute-forcing
   * it is computationally infeasible regardless of the hash algorithm.
   * Using SHA-256 keeps token verification fast on every authenticated request.
   */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Generate a 32-byte cryptographically random hex string. */
  private generateRawToken(): string {
    return randomBytes(32).toString('hex');
  }

  /** Sign and return a short-lived JWT access token. */
  private signAccessToken(payload: TokenPayload): string {
    return this.jwt.sign(
      { email: payload.email, role: payload.role },
      {
        subject: payload.userId,
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  /**
   * Parse a TTL string ("15m", "30d") into an absolute expiry Date.
   * Supported units: s, m, h, d.
   */
  private ttlToDate(ttl: string): Date {
    const unit = ttl.slice(-1);
    const value = parseInt(ttl.slice(0, -1), 10);

    if (isNaN(value)) throw new Error(`Invalid TTL value: "${ttl}"`);

    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    const ms = multipliers[unit];
    if (ms === undefined) throw new Error(`Unknown TTL unit: "${unit}"`);

    return new Date(Date.now() + value * ms);
  }

  /**
   * Walk the replacement chain starting at `startId` and revoke every token
   * in the family. Called when a revoked token is presented a second time
   * (reuse detection — the token was likely stolen).
   */
  private async revokeFamily(startId: string): Promise<void> {
    const now = new Date();
    const visited = new Set<string>();
    const queue: string[] = [startId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const token = await this.prisma.refreshToken.findUnique({
        where: { id },
      });
      if (!token) continue;

      if (token.revokedAt === null) {
        await this.prisma.refreshToken.update({
          where: { id },
          data: { revokedAt: now },
        });
      }

      if (token.replacedById) {
        queue.push(token.replacedById);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Issue a new access + refresh token pair.
   *
   * The raw refresh token is returned to the caller exactly once. Only its
   * SHA-256 hash is written to the database so a DB breach cannot be used
   * to hijack sessions.
   */
  async generateTokens(payload: TokenPayload): Promise<IssuedTokens> {
    const rawRefresh = this.generateRawToken();
    const tokenHash = this.hashToken(rawRefresh);
    const expiresAt = this.ttlToDate(
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );

    await this.prisma.refreshToken.create({
      data: { userId: payload.userId, tokenHash, expiresAt },
    });

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: rawRefresh,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 900 s — mirrors JWT_ACCESS_TTL default
    };
  }

  /**
   * Rotate a refresh token.
   *
   * Happy path: the old token is revoked and a new pair is issued atomically.
   * Reuse detection: if the token was already revoked the whole family is
   * immediately revoked to contain a potential token theft.
   *
   * @throws UnauthorizedException on any invalid condition.
   */
  async rotateRefreshToken(rawRefreshToken: string): Promise<RotatedTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token not found.');
    }

    if (stored.revokedAt !== null) {
      // Reuse detected — revoke the entire family and alert the caller.
      await this.revokeFamily(stored.id);
      throw new UnauthorizedException(
        'Refresh token already used. All sessions have been terminated.',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const payload: TokenPayload = {
      userId: stored.user.id,
      email: stored.user.email,
      role: stored.user.role as UserRole,
    };

    // Generate the new pair and link the old token to it — all in one
    // transaction so we never end up with two live tokens for one slot.
    const rawNew = this.generateRawToken();
    const newHash = this.hashToken(rawNew);
    const expiresAt = this.ttlToDate(
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );

    const [, newRecord] = await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: { userId: payload.userId, tokenHash: newHash, expiresAt },
      }),
    ]);

    // Write replacedById after we know the new record's ID (outside the
    // transaction batch above, which does not guarantee order).
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: newRecord.id },
    });

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: rawNew,
      tokenType: 'Bearer',
      expiresIn: 15 * 60,
      user: {
        id: stored.user.id,
        email: stored.user.email,
        role: stored.user.role as UserRole,
        createdAt: stored.user.createdAt,
      },
    };
  }

  /**
   * Revoke a refresh token on logout.
   * A no-op (rather than an error) if the token is not found or already revoked,
   * so that idempotent logout calls always succeed.
   */
  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
