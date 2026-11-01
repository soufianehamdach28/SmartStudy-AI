import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  type AuthResponse,
  type LoginRequest,
  loginRequestSchema,
  type RefreshTokenRequest,
  refreshTokenRequestSchema,
  type RegisterRequest,
  registerRequestSchema,
} from '@smartstudy/shared';
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
