import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@smartstudy/shared';

/**
 * The shape injected into every request by JwtStrategy.validate().
 * These fields come directly from the JWT access-token payload.
 */
export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Parameter decorator that extracts the authenticated user payload from the
 * request object. Use it in any controller method protected by JwtAuthGuard:
 *
 * ```ts
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * getMe(@CurrentUser() user: CurrentUserPayload) { … }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentUserPayload }>();
    return request.user;
  },
);
