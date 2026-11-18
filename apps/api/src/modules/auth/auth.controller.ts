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
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../core/common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../core/common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new student account' })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully; access and refresh tokens returned.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or email already registered.',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest,
  ): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate student with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful; access and refresh tokens returned.',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) dto: LoginRequest,
  ): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a fresh access token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token rotated successfully; new pair issued.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or revoked refresh token.',
  })
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    dto: RefreshTokenRequest,
  ): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke active refresh token family' })
  @ApiResponse({ status: 204, description: 'Session terminated successfully.' })
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
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Return the authenticated user's public profile.
   * The JWT guard validates the Bearer token and populates @CurrentUser().
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile information retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  async getMe(@CurrentUser() user: CurrentUserPayload): Promise<UserProfile> {
    return this.authService.getMe(user.userId);
  }
}
