import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Route guard that enforces JWT authentication.
 *
 * Apply it with @UseGuards(JwtAuthGuard) on any controller or route handler.
 * On success, the authenticated user payload is available via @CurrentUser().
 * On failure, it throws a 401 Unauthorized with a stable error code.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T | false): T {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required.');
    }
    return user;
  }
}
