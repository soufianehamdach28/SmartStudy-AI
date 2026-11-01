import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockPasswordService = {
    hash: vi.fn(),
    verify: vi.fn(),
  };

  const mockTokenService = {
    generateTokens: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
  };

  const fakeDate = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      mockPasswordService as any,
      mockTokenService as any,
    );
  });

  describe('register', () => {
    it('creates a new user and returns AuthResponse', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPasswordService.hash.mockResolvedValueOnce('argon2.hash');
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'alice@example.com',
        role: 'STUDENT',
        createdAt: fakeDate,
      });
      mockTokenService.generateTokens.mockResolvedValueOnce({
        accessToken: 'access.jwt',
        refreshToken: 'raw.refresh.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      const result = await service.register({
        email: 'Alice@Example.com ',
        password: 'password123',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(mockPasswordService.hash).toHaveBeenCalledWith('password123');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'alice@example.com',
          passwordHash: 'argon2.hash',
          role: 'STUDENT',
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).toEqual({
        tokens: {
          accessToken: 'access.jwt',
          refreshToken: 'raw.refresh.token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
        user: {
          id: 'user-uuid-1',
          email: 'alice@example.com',
          role: 'STUDENT',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });

    it('throws ConflictException if email is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns AuthResponse when email and password match', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'alice@example.com',
        passwordHash: 'stored.hash',
        role: 'STUDENT',
        createdAt: fakeDate,
      });
      mockPasswordService.verify.mockResolvedValueOnce(true);
      mockTokenService.generateTokens.mockResolvedValueOnce({
        accessToken: 'access.jwt',
        refreshToken: 'raw.refresh.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      const result = await service.login({
        email: 'Alice@Example.com',
        password: 'password123',
      });

      expect(mockPasswordService.verify).toHaveBeenCalledWith(
        'stored.hash',
        'password123',
      );
      expect(result.tokens.accessToken).toBe('access.jwt');
      expect(result.user.email).toBe('alice@example.com');
    });

    it('throws UnauthorizedException if email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPasswordService.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException if password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'alice@example.com',
        passwordHash: 'stored.hash',
        role: 'STUDENT',
        createdAt: fakeDate,
      });
      mockPasswordService.verify.mockResolvedValueOnce(false);

      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockTokenService.generateTokens).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates refresh token and returns AuthResponse', async () => {
      mockTokenService.rotateRefreshToken.mockResolvedValueOnce({
        accessToken: 'new.access.jwt',
        refreshToken: 'new.refresh.token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-uuid-1',
          email: 'alice@example.com',
          role: 'STUDENT',
          createdAt: fakeDate,
        },
      });

      const result = await service.refresh({
        refreshToken: 'old.refresh.token',
      });

      expect(mockTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old.refresh.token',
      );
      expect(result.tokens.accessToken).toBe('new.access.jwt');
      expect(result.user.id).toBe('user-uuid-1');
    });
  });

  describe('logout', () => {
    it('calls tokenService.revokeRefreshToken', async () => {
      mockTokenService.revokeRefreshToken.mockResolvedValueOnce(undefined);

      await service.logout({ refreshToken: 'active.token' });

      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'active.token',
      );
    });
  });
});
