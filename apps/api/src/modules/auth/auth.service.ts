import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthResponse,
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  UserRole,
} from '@smartstudy/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Register a new student account, hash their password with Argon2,
   * save them to the database, and issue an initial token pair.
   *
   * @throws ConflictException if an account with the email already exists.
   */
  async register(dto: RegisterRequest): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'STUDENT',
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  /**
   * Authenticate a user by verifying their password against the stored Argon2 hash.
   *
   * @throws UnauthorizedException on unknown email or invalid password.
   * Uses generic error message to prevent account enumeration.
   */
  async login(dto: LoginRequest): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  /**
   * Rotate a refresh token and return a new token pair and updated user profile.
   *
   * @throws UnauthorizedException if the token is missing, expired, or already reused.
   */
  async refresh(dto: RefreshTokenRequest): Promise<AuthResponse> {
    const result = await this.tokenService.rotateRefreshToken(dto.refreshToken);

    return {
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        createdAt: result.user.createdAt.toISOString(),
      },
    };
  }

  /**
   * Revoke a refresh token on user logout.
   */
  async logout(dto: RefreshTokenRequest): Promise<void> {
    await this.tokenService.revokeRefreshToken(dto.refreshToken);
  }
}
