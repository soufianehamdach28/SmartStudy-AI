import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../core/config/env.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { QuotaExceededException } from './usage.exceptions.js';
import { UsageService } from './usage.service.js';

describe('UsageService', () => {
  let usageService: UsageService;
  let prismaMock: {
    usageRecord: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let configServiceMock: {
    get: ReturnType<typeof vi.fn>;
  };

  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    prismaMock = {
      usageRecord: {
        count: vi.fn(),
        create: vi.fn(),
      },
    };

    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'QUOTA_AI_REQUESTS_PER_DAY') return 20;
        if (key === 'QUOTA_AI_REQUESTS_PER_MONTH') return 300;
        return undefined;
      }),
    };

    usageService = new UsageService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService<Env, true>,
    );
  });

  describe('checkQuota', () => {
    it('passes when daily and monthly usage are below limits', async () => {
      prismaMock.usageRecord.count
        .mockResolvedValueOnce(5) // dailyUsed
        .mockResolvedValueOnce(50); // monthlyUsed

      await expect(usageService.checkQuota(userId)).resolves.toBeUndefined();
    });

    it('throws QuotaExceededException when daily limit is reached', async () => {
      prismaMock.usageRecord.count
        .mockResolvedValueOnce(20) // dailyUsed reached
        .mockResolvedValueOnce(50); // monthlyUsed

      await expect(usageService.checkQuota(userId)).rejects.toThrow(QuotaExceededException);
    });

    it('throws QuotaExceededException when monthly limit is reached', async () => {
      prismaMock.usageRecord.count
        .mockResolvedValueOnce(5) // dailyUsed
        .mockResolvedValueOnce(300); // monthlyUsed reached

      await expect(usageService.checkQuota(userId)).rejects.toThrow(QuotaExceededException);
    });
  });

  describe('recordUsage', () => {
    it('creates a usage record with input details', async () => {
      prismaMock.usageRecord.create.mockResolvedValue({ id: 'rec-1' });

      await usageService.recordUsage({
        userId,
        kind: 'SUMMARY',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        tokensIn: 500,
        tokensOut: 200,
        latencyMs: 1200,
      });

      expect(prismaMock.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          kind: 'SUMMARY',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          tokensIn: 500,
          tokensOut: 200,
          latencyMs: 1200,
          status: 'SUCCESS',
        }),
      });
    });

    it('does not throw when database recording encounters an error', async () => {
      prismaMock.usageRecord.create.mockRejectedValue(new Error('DB failure'));

      await expect(
        usageService.recordUsage({
          userId,
          kind: 'QUIZ',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getUsageQuota', () => {
    it('returns consumption and remaining allowance correctly', async () => {
      prismaMock.usageRecord.count
        .mockResolvedValueOnce(8) // dailyUsed
        .mockResolvedValueOnce(60); // monthlyUsed

      const quota = await usageService.getUsageQuota(userId);

      expect(quota).toEqual({
        dailyLimit: 20,
        dailyUsed: 8,
        dailyRemaining: 12,
        monthlyLimit: 300,
        monthlyUsed: 60,
        monthlyRemaining: 240,
      });
    });
  });
});
