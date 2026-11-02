import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type AuthResponse,
  type LoginRequest,
  loginRequestSchema,
  type RefreshTokenRequest,
  refreshTokenRequestSchema,
  type RegisterRequest,
  registerRequestSchema,
  type UserProfile,
} from '@smartstudy/shared';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../core/common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest,
  ): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) dto: LoginRequest,
  ): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    dto: RefreshTokenRequest,
  ): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    dto: RefreshTokenRequest,
  ): Promise<void> {
    await this.authService.logout(dto);
  }
}

/**
 * Separate controller to serve GET /api/me outside the /api/auth prefix.
 *
 * Why a second controller in the same file: it is a thin endpoint that shares
 * the same AuthService (for the DB lookup). A dedicated me.controller.ts
 * would be justified only if the feature grew. One file keeps commit 06
 * focused.
 */
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Return the authenticated user's public profile.
   * The JWT guard validates the Bearer token and populates @CurrentUser().
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: CurrentUserPayload): Promise<UserProfile> {
    return this.authService.getMe(user.userId);
  }
}
