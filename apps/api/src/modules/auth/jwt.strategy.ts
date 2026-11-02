import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { UserRole } from '@smartstudy/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../core/config/env.js';
import type { CurrentUserPayload } from '../../core/common/decorators/current-user.decorator.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/**
 * Raw JWT payload shape as signed by TokenService.signAccessToken().
 * `sub` is the userId, and Passport populates it from the JWT "sub" claim.
 */
interface JwtAccessPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Passport JWT strategy.
 *
 * What it does:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Verifies the signature against JWT_ACCESS_SECRET and checks expiry.
 * 3. Calls validate() with the decoded payload.
 * 4. If valid, attaches the result to request.user.
 *
 * A missing or invalid token makes Passport throw a 401 before validate() runs.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Called by Passport after the token has been verified.
   * We confirm the user still exists in the database so that deleted accounts
   * cannot keep using valid tokens within the 15-minute window.
   *
   * Returns the CurrentUserPayload that will be attached to request.user.
   */
  async validate(payload: JwtAccessPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
  }
}
