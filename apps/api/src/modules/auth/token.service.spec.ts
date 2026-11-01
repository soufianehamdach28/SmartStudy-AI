import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from './token.service.js';
import type { TokenPayload } from './token.service.js';

// ---------------------------------------------------------------------------
// Minimal mocks — we test business logic, not the framework.
// ---------------------------------------------------------------------------

/** A fake RefreshToken DB row. */
const makeTokenRow = (overrides: Partial<{
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  user: { id: string; email: string; role: string };
}> = {}) => ({
  id: 'token-id-1',
  userId: 'user-id-1',
  tokenHash: 'some-hash',
  expiresAt: new Date(Date.now() + 30 * 24 * 3600_000), // 30 days from now
  revokedAt: null,
  replacedById: null,
  user: { id: 'user-id-1', email: 'alice@example.com', role: 'STUDENT' },
  ...overrides,
});

const mockPrisma = {
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockJwt = {
  sign: vi.fn().mockReturnValue('mock.access.token'),
};

const mockConfig = {
  get: vi.fn((key: string) => {
    const cfg: Record<string, string> = {
      JWT_ACCESS_SECRET: 'a-test-secret-that-is-at-least-32-chars!!',
      JWT_REFRESH_SECRET: 'a-refresh-secret-at-least-32-chars-long!!',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
    };
    return cfg[key];
  }),
};

const payload: TokenPayload = {
  userId: 'user-id-1',
  email: 'alice@example.com',
  role: 'STUDENT',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenService(
      mockPrisma as never,
      mockJwt as never,
      mockConfig as never,
    );
  });

  // --- generateTokens -------------------------------------------------------

  describe('generateTokens', () => {
    it('returns access token, raw refresh token and correct shape', async () => {
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.generateTokens(payload);

      expect(result.tokenType).toBe('Bearer');
      expect(result.accessToken).toBe('mock.access.token');
      expect(result.expiresIn).toBe(900);
      // Raw refresh token is a 64-char hex string (32 random bytes).
      expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores only the SHA-256 hash — not the raw token — in the DB', async () => {
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.generateTokens(payload);
      const { tokenHash } = mockPrisma.refreshToken.create.mock.calls[0][0].data as { tokenHash: string };

      // The stored hash is a 64-char hex SHA-256 digest.
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
      // It must NOT be equal to the raw token itself.
      expect(tokenHash).not.toBe(result.refreshToken);
    });

    it('signs the access token with the correct subject and payload', async () => {
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      await service.generateTokens(payload);

      const [jwtPayload, opts] = mockJwt.sign.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(opts['subject']).toBe(payload.userId);
      expect(jwtPayload['email']).toBe(payload.email);
      expect(jwtPayload['role']).toBe(payload.role);
    });
  });

  // --- rotateRefreshToken ---------------------------------------------------

  describe('rotateRefreshToken', () => {
    it('issues a new pair and revokes the old token on success', async () => {
      const oldRow = makeTokenRow();
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(oldRow);

      const newRow = makeTokenRow({ id: 'token-id-2', tokenHash: 'new-hash' });
      // $transaction returns [updated-old, created-new]
      mockPrisma.$transaction.mockResolvedValueOnce([oldRow, newRow]);
      mockPrisma.refreshToken.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const rawToken = 'a'.repeat(64); // simulate a 64-char raw token
      const result = await service.rotateRefreshToken(rawToken);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(result.refreshToken).not.toBe(rawToken); // new token issued
      // Transaction was invoked (atomic revoke + create).
      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });

    it('throws and revokes active family members when a revoked token is reused', async () => {
      // The presented token is already revoked, but it links to a still-active
      // replacement (simulating an attacker using an old stolen token).
      const revokedRow = makeTokenRow({
        id: 'token-id-old',
        revokedAt: new Date(Date.now() - 1000),
        replacedById: 'token-id-new',
      });
      const activeReplacement = makeTokenRow({
        id: 'token-id-new',
        revokedAt: null,
        replacedById: null,
      });

      // First call: initial lookup by tokenHash (finds the revoked token)
      // Subsequent calls: revokeFamily traversal by ID
      mockPrisma.refreshToken.findUnique
        .mockResolvedValueOnce(revokedRow)       // initial lookup
        .mockResolvedValueOnce(revokedRow)       // revokeFamily: start node (already revoked, skip update)
        .mockResolvedValueOnce(activeReplacement); // revokeFamily: replacement (active → revoke it)

      mockPrisma.refreshToken.update.mockResolvedValue({});

      await expect(service.rotateRefreshToken('a'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );

      // The active replacement must have been revoked.
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-id-new' } }),
      );
    });

    it('throws when the token has expired', async () => {
      const expiredRow = makeTokenRow({
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(expiredRow);

      await expect(service.rotateRefreshToken('a'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when the token is not found in the database', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.rotateRefreshToken('a'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // --- revokeRefreshToken ---------------------------------------------------

  describe('revokeRefreshToken', () => {
    it('revokes the token matching the provided raw value', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.revokeRefreshToken('a'.repeat(64));

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { revokedAt: expect.any(Date) as Date },
        }),
      );
    });

    it('is a no-op (does not throw) when token is not found', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.revokeRefreshToken('unknown-token')).resolves.toBeUndefined();
    });
  });
});
