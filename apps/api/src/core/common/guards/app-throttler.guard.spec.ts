import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard.js';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  let mockConfigService: ConfigService<any, true>;
  let mockJwtService: JwtService;
  let mockReflector: Reflector;
  let mockStorage: ThrottlerStorage;
  const mockOptions: ThrottlerModuleOptions = [
    { name: 'default', ttl: 60000, limit: 60 },
  ];

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret-at-least-32-characters-long';
        return undefined;
      }),
    } as unknown as ConfigService<any, true>;

    mockJwtService = {
      verifyAsync: vi.fn(),
    } as unknown as JwtService;

    mockReflector = new Reflector();
    mockStorage = {
      increment: vi.fn(),
    } as unknown as ThrottlerStorage;

    guard = new AppThrottlerGuard(
      mockOptions,
      mockStorage,
      mockReflector,
      mockConfigService,
      mockJwtService,
    );
  });

  describe('getTracker', () => {
    it('returns user:<id> when req.user.id is populated', async () => {
      const req = {
        user: { id: 'user-123', email: 'test@example.com' },
        ip: '127.0.0.1',
      };

      // Call protected method
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:user-123');
    });

    it('returns user:<sub> when req.user.sub is populated', async () => {
      const req = {
        user: { sub: 'user-sub-456' },
        ip: '127.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:user-sub-456');
    });

    it('verifies Bearer token and returns user:<sub/id> when Authorization header is present', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
        ip: '127.0.0.1',
      };

      vi.mocked(mockJwtService.verifyAsync).mockResolvedValueOnce({
        sub: 'verified-user-789',
      });

      const tracker = await (guard as any).getTracker(req);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid.jwt.token',
        { secret: 'test-secret-at-least-32-characters-long' },
      );
      expect(tracker).toBe('user:verified-user-789');
    });

    it('falls back to IP when Bearer token verification fails', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token',
        },
        ip: '192.168.1.100',
      };

      vi.mocked(mockJwtService.verifyAsync).mockRejectedValueOnce(
        new Error('jwt expired'),
      );

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:192.168.1.100');
    });

    it('extracts first IP from x-forwarded-for header when unauthenticated', async () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
        ip: '10.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:203.0.113.195');
    });

    it('falls back to req.ip or socket remote address when no forwarded header', async () => {
      const req = {
        headers: {},
        ip: '192.168.1.50',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:192.168.1.50');
    });

    it('falls back to socket.remoteAddress when req.ip is empty', async () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '10.0.2.15' },
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:10.0.2.15');
    });

    it('returns ip:unknown when neither user, headers, nor ip exists', async () => {
      const req = {
        headers: {},
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('ip:unknown');
    });
  });

  describe('getErrorMessage', () => {
    it('returns custom user-friendly rate limit error message', async () => {
      const message = await (guard as any).getErrorMessage({} as any, {} as any);
      expect(message).toBe(
        'Too many requests. Please slow down and try again later.',
      );
    });
  });
});
